"use node";

import { createHash } from "node:crypto";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import {
  DEFAULT_PROMPT_TEMPLATE,
  admitVerdict,
  buildGeneratorPrompt,
  capRejectionReasons,
  checkBlockLength,
  checkDailyRunCap,
  clampBatchCount,
  computeAdmitRate,
  normalizeForHash,
  parseDistilledPrompt,
  parseGeneratedBlocks,
  parseJudgeVerdicts,
  pickLeastCoveredCell,
  validateBlockBody,
  validateGeneratedBlockCandidate,
  validatePromptTemplate,
} from "./lessonDbLogic";
import { callOpenRouter } from "./openRouterClient";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const SKILLS = [
  "grammar",
  "vocabulary",
  "reading",
  "listening",
  "writing",
  "speaking",
  "pronunciation",
  "mixed",
] as const;
const BLOCK_TYPES = [
  "vocabSet",
  "sentencePair",
  "dialogue",
  "grammarExplainer",
  "exerciseAtom",
  "readingPassage",
  "listeningScript",
  "culturalNote",
  "imagePromptTemplate",
  "speakingPrompt",
] as const;

type Level = (typeof LEVELS)[number];
type Skill = (typeof SKILLS)[number];
type BlockType = (typeof BLOCK_TYPES)[number];
type TargetCell = { level: Level; skill: Skill; blockType: BlockType };

type GenerationBatchResult =
  | { success: false; error: string; runId?: Id<"generationRuns"> }
  | {
      success: true;
      generated: number;
      admitted: number;
      rejected: number;
      runId: Id<"generationRuns">;
      target: TargetCell;
      promptVersion: number;
      tokensUsed?: number;
    };

type DistillPromptResult =
  | { success: false; error: string }
  | {
      success: true;
      promptId: Id<"generationPrompts">;
      version: number;
      activated: boolean;
      admitRate: number;
    };

// Spell these out for compatibility with the Convex 1.16 validator API.
const levelValidator = v.union(
  v.literal("A1"),
  v.literal("A2"),
  v.literal("B1"),
  v.literal("B2"),
  v.literal("C1"),
  v.literal("C2"),
);
const skillValidator = v.union(
  v.literal("grammar"),
  v.literal("vocabulary"),
  v.literal("reading"),
  v.literal("listening"),
  v.literal("writing"),
  v.literal("speaking"),
  v.literal("pronunciation"),
  v.literal("mixed"),
);
const blockTypeValidator = v.union(
  v.literal("vocabSet"),
  v.literal("sentencePair"),
  v.literal("dialogue"),
  v.literal("grammarExplainer"),
  v.literal("exerciseAtom"),
  v.literal("readingPassage"),
  v.literal("listeningScript"),
  v.literal("culturalNote"),
  v.literal("imagePromptTemplate"),
  v.literal("speakingPrompt"),
);

function hashNormalizedContent(blockType: string, body: unknown): string {
  return createHash("sha256").update(normalizeForHash(blockType, body)).digest("hex");
}

export const runGenerationBatch = internalAction({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    level: v.optional(levelValidator),
    skill: v.optional(skillValidator),
    blockType: v.optional(blockTypeValidator),
    topic: v.optional(v.string()),
    count: v.optional(v.number()),
    generatorModel: v.optional(v.string()),
    judgeModel: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerationBatchResult> => {
    const requested = clampBatchCount(args.count);
    const generatorModel = args.generatorModel ?? "google/gemini-2.5-flash";
    // A different judge provider is a useful anti-bias preference, but is intentionally not enforced.
    const judgeModel = args.judgeModel ?? "openai/gpt-5-mini";
    let runId: Id<"generationRuns"> | undefined;
    let generated = 0;
    let admitted = 0;
    let rejectionReasons: string[] = [];
    let tokensUsed = 0;

    try {
      const recentRuns = await ctx.runQuery(internal.lessonDb.recentRuns, {});
      const spendGuard = checkDailyRunCap(
        recentRuns.map((run) => run.startedAt),
        Date.now(),
      );
      if (!spendGuard.allowed) {
        return { success: false, error: spendGuard.reason ?? "daily run cap reached" };
      }

      const apiKey = args.apiKey ?? await ctx.runQuery(internal.lessonDb.getCompanyAiKey, {
        companyId: args.companyId,
      });
      if (!apiKey) return { success: false, error: "no api key" };

      const activePrompt = await ctx.runQuery(internal.lessonDb.getActivePrompt, {});
      let promptVersion: number;
      let promptTemplate: string;
      if (activePrompt) {
        promptVersion = activePrompt.version;
        promptTemplate = activePrompt.template;
      } else {
        await ctx.runMutation(internal.lessonDb.insertPromptVersion, {
          version: 1,
          template: DEFAULT_PROMPT_TEMPLATE,
          active: true,
          changeNotes: "Built-in initial content-block prompt",
        });
        promptVersion = 1;
        promptTemplate = DEFAULT_PROMPT_TEMPLATE;
      }

      let target: TargetCell;
      if (args.level && args.skill && args.blockType) {
        target = { level: args.level, skill: args.skill, blockType: args.blockType };
      } else {
        const levels = args.level ? [args.level] : [...LEVELS];
        const skills = args.skill ? [args.skill] : [...SKILLS];
        const blockTypes = args.blockType ? [args.blockType] : [...BLOCK_TYPES];
        const allCandidates: TargetCell[] = [];
        for (const level of levels) {
          for (const skill of skills) {
            for (const blockType of blockTypes) {
              allCandidates.push({ level, skill, blockType });
            }
          }
        }
        // Actions may be nondeterministic; random sampling prevents the same small subset from monopolizing checks.
        const sampled = allCandidates
          .map((cell) => ({ cell, order: Math.random() }))
          .sort((left, right) => left.order - right.order)
          .slice(0, Math.min(8, allCandidates.length))
          .map(({ cell }) => cell);
        const coverage = await Promise.all(
          sampled.map(async (cell) => ({
            cell,
            count: await ctx.runQuery(internal.lessonDb.countCell, cell),
          })),
        );
        target = pickLeastCoveredCell(coverage);
      }

      const exemplars = await ctx.runQuery(internal.lessonDb.getExemplars, {
        level: target.level,
        skill: target.skill,
      });
      const systemPrompt = await ctx.runQuery(internal.lessonDb.getCompanySystemPrompt, {
        companyId: args.companyId,
      });
      const prompt = buildGeneratorPrompt({
        template: promptTemplate,
        count: requested,
        ...target,
        topic: args.topic,
        exemplars,
        systemPrompt: systemPrompt ?? undefined,
      });

      runId = await ctx.runMutation(internal.lessonDb.createRun, {
        companyId: args.companyId,
        target: { ...target, ...(args.topic ? { topic: args.topic } : {}) },
        promptVersion,
        generatorModel,
        judgeModel,
        requested,
      });

      const generatorResponse = await callOpenRouter({
        apiKey,
        model: generatorModel,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 12_000,
      });
      if (!generatorResponse.success) throw new Error(generatorResponse.error);
      tokensUsed += generatorResponse.usage?.total_tokens ?? 0;

      const rawItems = parseGeneratedBlocks(generatorResponse.content).slice(0, requested);
      generated = rawItems.length;
      const batchHashes = new Set<string>();
      const survivors: Array<{
        index: number;
        title: string;
        topic: string;
        body: unknown;
        contentHash: string;
      }> = [];

      for (const [index, rawItem] of rawItems.entries()) {
        const envelope = validateGeneratedBlockCandidate(rawItem);
        if (!envelope.valid) {
          rejectionReasons.push(`item ${index}: ${envelope.errors.join("; ")}`);
          continue;
        }
        const bodyValidation = validateBlockBody(target.blockType, envelope.value.body);
        if (!bodyValidation.valid) {
          rejectionReasons.push(`item ${index}: ${bodyValidation.errors.join("; ")}`);
          continue;
        }
        const lengthValidation = checkBlockLength(envelope.value.body);
        if (!lengthValidation.valid) {
          rejectionReasons.push(`item ${index}: ${lengthValidation.reason}`);
          continue;
        }

        const contentHash = hashNormalizedContent(target.blockType, envelope.value.body);
        if (batchHashes.has(contentHash)) {
          rejectionReasons.push(`item ${index}: duplicate within generation batch`);
          continue;
        }
        batchHashes.add(contentHash);
        const existing = await ctx.runQuery(internal.lessonDb.findByHash, { contentHash });
        if (existing) {
          rejectionReasons.push(`item ${index}: duplicate of existing content block`);
          continue;
        }
        survivors.push({ index, ...envelope.value, contentHash });
      }

      if (survivors.length > 0) {
        const judgePrompt = `You are an independent expert judge for adult English-language pedagogy.
Evaluate every candidate against pedagogy, strict ${target.level} CEFR fit, and professional Simmonds voice.
Score pedagogy, cefrFit, and voice from 1 (poor) to 5 (excellent). Set pass=false for factual errors, ambiguous answers, childish tone, or CEFR leakage.
Return ONLY a JSON array with exactly one object per candidate using this shape:
{"index": number, "pass": boolean, "pedagogy": number, "cefrFit": number, "voice": number, "reasons": string[]}

Candidates:
${JSON.stringify(survivors.map(({ index, title, topic, body }) => ({ index, title, topic, body })))}`;
        const judgeResponse = await callOpenRouter({
          apiKey,
          model: judgeModel,
          messages: [{ role: "user", content: judgePrompt }],
          maxTokens: 6_000,
        });
        if (!judgeResponse.success) throw new Error(judgeResponse.error);
        tokensUsed += judgeResponse.usage?.total_tokens ?? 0;
        const verdicts = parseJudgeVerdicts(judgeResponse.content);
        const verdictByIndex = new Map(verdicts.map((verdict) => [verdict.index, verdict]));

        for (const survivor of survivors) {
          const verdict = verdictByIndex.get(survivor.index);
          if (!verdict) {
            rejectionReasons.push(`item ${survivor.index}: judge returned no verdict`);
            continue;
          }
          if (!admitVerdict(verdict)) {
            const reasons = verdict.reasons.length ? verdict.reasons.join(", ") : "scores below admission threshold";
            rejectionReasons.push(`item ${survivor.index}: judge rejected: ${reasons}`);
            continue;
          }

          await ctx.runMutation(internal.lessonDb.insertBlock, {
            companyId: args.companyId,
            blockType: target.blockType,
            level: target.level,
            skill: target.skill,
            topic: survivor.topic,
            title: survivor.title,
            body: survivor.body,
            source: "model",
            provenance: `generator=${generatorModel}; judge=${judgeModel}; promptVersion=${promptVersion}`,
            rightsStatus: "unknown",
            reviewStatus: "ai_approved",
            graderScores: {
              pedagogy: verdict.pedagogy,
              cefrFit: verdict.cefrFit,
              voice: verdict.voice,
              judgeModel,
              ...(verdict.reasons.length ? { notes: verdict.reasons.join("; ") } : {}),
            },
            contentHash: survivor.contentHash,
            generationRunId: runId,
          });
          admitted += 1;
        }
      }

      const rejected = generated - admitted;
      rejectionReasons = capRejectionReasons(rejectionReasons);
      await ctx.runMutation(internal.lessonDb.finishRun, {
        runId,
        status: "completed",
        generated,
        admitted,
        rejected,
        rejectionReasons,
        ...(tokensUsed ? { tokensUsed } : {}),
      });
      return {
        success: true,
        generated,
        admitted,
        rejected,
        runId,
        target,
        promptVersion,
        ...(tokensUsed ? { tokensUsed } : {}),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown generation error";
      if (runId) {
        try {
          await ctx.runMutation(internal.lessonDb.finishRun, {
            runId,
            status: "failed",
            generated,
            admitted,
            rejected: Math.max(0, generated - admitted),
            rejectionReasons: capRejectionReasons(rejectionReasons),
            ...(tokensUsed ? { tokensUsed } : {}),
            error: errorMessage,
          });
        } catch (finishError) {
          console.error("Failed to mark generation run as failed", finishError);
        }
      }
      return runId
        ? { success: false, error: errorMessage, runId }
        : { success: false, error: errorMessage };
    }
  },
});

export const distillPrompt = internalAction({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    apiKey: v.optional(v.string()),
    judgeModel: v.optional(v.string()),
    autoActivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<DistillPromptResult> => {
    const recentRuns = await ctx.runQuery(internal.lessonDb.recentRuns, {});
    const completedRuns = recentRuns.filter((run) => run.status === "completed");
    if (completedRuns.length < 3) return { success: false, error: "not enough runs" };

    const apiKey = args.apiKey ?? await ctx.runQuery(internal.lessonDb.getCompanyAiKey, {
      companyId: args.companyId,
    });
    if (!apiKey) return { success: false, error: "no api key" };

    const activePrompt = await ctx.runQuery(internal.lessonDb.getActivePrompt, {});
    if (!activePrompt) return { success: false, error: "no active prompt" };
    const latestPrompt = await ctx.runQuery(internal.lessonDb.getLatestPrompt, {});
    const admitRate = computeAdmitRate(completedRuns);
    const rejectionReasons = completedRuns.flatMap((run) => run.rejectionReasons).slice(0, 100);
    const judgeModel = args.judgeModel ?? "openai/gpt-5-mini";
    const distillationRequest = `Improve the content-block generator template using the run evidence below.
Preserve all six placeholders exactly: {{count}}, {{level}}, {{skill}}, {{blockType}}, {{topic}}, {{exemplars}}.
Keep the template model-agnostic, concise, and strict about adult German-L1 learners, professional voice, CEFR fit, valid JSON, and block body shapes.
Return ONLY JSON: {"template":"...", "changeNotes":"..."}.

Current template:
${activePrompt.template}

Completed runs: ${completedRuns.length}
Aggregate admit rate: ${admitRate}
Rejection reasons:
${JSON.stringify(rejectionReasons)}`;
    const response = await callOpenRouter({
      apiKey,
      model: judgeModel,
      messages: [{ role: "user", content: distillationRequest }],
      maxTokens: 4_000,
    });
    if (!response.success) return { success: false, error: response.error };

    try {
      const distilled = parseDistilledPrompt(response.content);
      const templateValidation = validatePromptTemplate(distilled.template);
      if (!templateValidation.valid) {
        throw new Error(
          `Distilled template is missing placeholders: ${templateValidation.missing.join(", ")}`,
        );
      }
      const version = (latestPrompt?.version ?? activePrompt.version) + 1;
      const promptId = await ctx.runMutation(internal.lessonDb.insertPromptVersion, {
        version,
        template: distilled.template,
        active: false,
        parentVersion: activePrompt.version,
        ...(distilled.changeNotes ? { changeNotes: distilled.changeNotes } : {}),
        stats: { runs: completedRuns.length, admitRate },
      });
      if (args.autoActivate ?? false) {
        await ctx.runMutation(internal.lessonDb.activatePromptVersion, { version });
      }
      return {
        success: true,
        promptId,
        version,
        activated: args.autoActivate ?? false,
        admitRate,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to distill prompt",
      };
    }
  },
});
