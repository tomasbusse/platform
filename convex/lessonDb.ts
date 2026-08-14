import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  capRejectionReasons,
  computeExemplarEligible,
  validateBlockBody,
  wordLevelEditDistance,
} from "./ai/lessonDbLogic";

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

const sourceValidator = v.union(
  v.literal("human"),
  v.literal("model"),
  v.literal("seed_corpus"),
);

const reviewStatusValidator = v.union(
  v.literal("unreviewed"),
  v.literal("ai_approved"),
  v.literal("teacher_approved"),
  v.literal("rejected"),
);

const rightsStatusValidator = v.union(
  v.literal("proprietary"),
  v.literal("public_domain"),
  v.literal("cc_by"),
  v.literal("cc_by_sa"),
  v.literal("unknown"),
);

export const getActivePrompt = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("generationPrompts")
      .withIndex("by_purpose_active", (q) =>
        q.eq("purpose", "contentBlock").eq("active", true),
      )
      .first(),
});

export const getLatestPrompt = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("generationPrompts")
      .withIndex("by_purpose_version", (q) => q.eq("purpose", "contentBlock"))
      .order("desc")
      .first(),
});

export const insertPromptVersion = internalMutation({
  args: {
    version: v.number(),
    template: v.string(),
    active: v.boolean(),
    parentVersion: v.optional(v.number()),
    changeNotes: v.optional(v.string()),
    stats: v.optional(v.object({ runs: v.number(), admitRate: v.number() })),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("generationPrompts", {
      purpose: "contentBlock",
      ...args,
      createdAt: Date.now(),
    }),
});

export const activatePromptVersion = internalMutation({
  args: { version: v.number() },
  handler: async (ctx, args) => {
    const target = await ctx.db
      .query("generationPrompts")
      .withIndex("by_purpose_version", (q) =>
        q.eq("purpose", "contentBlock").eq("version", args.version),
      )
      .first();
    if (!target) throw new Error(`Prompt version ${args.version} not found`);

    const current = await ctx.db
      .query("generationPrompts")
      .withIndex("by_purpose_active", (q) =>
        q.eq("purpose", "contentBlock").eq("active", true),
      )
      .first();
    if (current && current._id !== target._id) {
      await ctx.db.patch(current._id, { active: false });
    }
    await ctx.db.patch(target._id, { active: true });
    return target._id;
  },
});

export const getCompanyAiKey = internalQuery({
  args: { companyId: v.union(v.id("companies"), v.string()) },
  handler: async (ctx, args) => {
    const companyId = ctx.db.normalizeId("companies", args.companyId);
    if (!companyId) return null;
    const company = await ctx.db.get(companyId);
    return company?.settings?.openRouterApiKey ?? null;
  },
});

export const getCompanySystemPrompt = internalQuery({
  args: { companyId: v.union(v.id("companies"), v.string()) },
  handler: async (ctx, args) => {
    const companyId = ctx.db.normalizeId("companies", args.companyId);
    if (!companyId) return null;
    const company = await ctx.db.get(companyId);
    return company?.aiPromptTemplates?.systemPrompt ?? null;
  },
});

export const countCell = internalQuery({
  args: { level: levelValidator, skill: skillValidator, blockType: blockTypeValidator },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("contentBlocks")
      .withIndex("by_level_skill_type", (q) =>
        q.eq("level", args.level).eq("skill", args.skill).eq("blockType", args.blockType),
      )
      .take(500);
    return rows.length;
  },
});

export const getExemplars = internalQuery({
  args: { level: levelValidator, skill: skillValidator },
  handler: async (ctx, args) =>
    await ctx.db
      .query("contentBlocks")
      .withIndex("by_exemplar", (q) =>
        q.eq("exemplarEligible", true).eq("level", args.level).eq("skill", args.skill),
      )
      .take(3),
});

export const findByHash = internalQuery({
  args: { contentHash: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("contentBlocks")
      .withIndex("by_hash", (q) => q.eq("contentHash", args.contentHash))
      .first(),
});

export const insertBlock = internalMutation({
  args: {
    companyId: v.optional(v.union(v.id("companies"), v.string())),
    blockType: blockTypeValidator,
    level: levelValidator,
    skill: skillValidator,
    topic: v.string(),
    title: v.string(),
    body: v.any(),
    source: sourceValidator,
    provenance: v.optional(v.string()),
    rightsStatus: rightsStatusValidator,
    attribution: v.optional(v.string()),
    reviewStatus: reviewStatusValidator,
    graderScores: v.optional(v.object({
      pedagogy: v.number(),
      cefrFit: v.number(),
      voice: v.number(),
      judgeModel: v.string(),
      notes: v.optional(v.string()),
    })),
    contentHash: v.string(),
    generationRunId: v.optional(v.id("generationRuns")),
  },
  handler: async (ctx, args) => {
    const validation = validateBlockBody(args.blockType, args.body);
    if (!validation.valid) {
      throw new Error(`Invalid ${args.blockType} body: ${validation.errors.join("; ")}`);
    }
    const now = Date.now();
    return await ctx.db.insert("contentBlocks", {
      ...args,
      exemplarEligible: computeExemplarEligible(args.source, args.reviewStatus),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createRun = internalMutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    target: v.object({
      level: v.string(),
      skill: v.string(),
      blockType: v.string(),
      topic: v.optional(v.string()),
    }),
    promptVersion: v.number(),
    generatorModel: v.string(),
    judgeModel: v.string(),
    requested: v.number(),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("generationRuns", {
      ...args,
      status: "running",
      generated: 0,
      admitted: 0,
      rejected: 0,
      rejectionReasons: [],
      startedAt: Date.now(),
    }),
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("generationRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    generated: v.number(),
    admitted: v.number(),
    rejected: v.number(),
    rejectionReasons: v.array(v.string()),
    tokensUsed: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { runId, rejectionReasons, ...updates } = args;
    await ctx.db.patch(runId, {
      ...updates,
      rejectionReasons: capRejectionReasons(rejectionReasons),
      finishedAt: Date.now(),
    });
    return runId;
  },
});

export const recentRuns = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("generationRuns").withIndex("by_started").order("desc").take(20),
});

const COVERAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const COVERAGE_BLOCK_TYPES = [
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

export const coverage = query({
  args: {},
  handler: async (ctx) => {
    const result: Array<{ level: (typeof COVERAGE_LEVELS)[number]; blockType: (typeof COVERAGE_BLOCK_TYPES)[number]; count: number; capped: boolean }> = [];
    // All 60 requested level/type cells are retained, with every index read hard-capped at 250.
    for (const level of COVERAGE_LEVELS) {
      for (const blockType of COVERAGE_BLOCK_TYPES) {
        const rows = await ctx.db
          .query("contentBlocks")
          .withIndex("by_type_level", (q) => q.eq("blockType", blockType).eq("level", level))
          .take(250);
        result.push({ level, blockType, count: rows.length, capped: rows.length === 250 });
      }
    }
    return result;
  },
});

export const listBlocks = query({
  args: {
    paginationOpts: paginationOptsValidator,
    reviewStatus: v.optional(reviewStatusValidator),
    blockType: v.optional(blockTypeValidator),
    level: v.optional(levelValidator),
  },
  handler: async (ctx, args) => {
    const { reviewStatus, blockType, level, paginationOpts } = args;
    if (reviewStatus) {
      let indexed = ctx.db
        .query("contentBlocks")
        .withIndex("by_review_status", (q) => q.eq("reviewStatus", reviewStatus));
      if (blockType) indexed = indexed.filter((q) => q.eq(q.field("blockType"), blockType));
      if (level) indexed = indexed.filter((q) => q.eq(q.field("level"), level));
      return await indexed.paginate(paginationOpts);
    }

    if (blockType) {
      const indexed = ctx.db
        .query("contentBlocks")
        .withIndex("by_type_level", (q) =>
          level ? q.eq("blockType", blockType).eq("level", level) : q.eq("blockType", blockType),
        );
      return await indexed.paginate(paginationOpts);
    }

    let indexed = ctx.db.query("contentBlocks").withIndex("by_type_level");
    if (level) indexed = indexed.filter((q) => q.eq(q.field("level"), level));
    return await indexed.paginate(paginationOpts);
  },
});

export const reviewBlock = mutation({
  args: {
    blockId: v.id("contentBlocks"),
    verdict: v.union(v.literal("teacher_approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId);
    if (!block) throw new Error("Content block not found");

    await ctx.db.patch(args.blockId, {
      reviewStatus: args.verdict,
      exemplarEligible: computeExemplarEligible(block.source, args.verdict),
      updatedAt: Date.now(),
    });
  },
});

export const blocksForReview = query({
  args: {
    paginationOpts: paginationOptsValidator,
    level: v.optional(levelValidator),
  },
  handler: async (ctx, args) => {
    let indexed = ctx.db
      .query("contentBlocks")
      .withIndex("by_review_status", (q) => q.eq("reviewStatus", "ai_approved"));
    if (args.level) indexed = indexed.filter((q) => q.eq(q.field("level"), args.level));
    return await indexed.paginate(args.paginationOpts);
  },
});

export const recordPublishedOutput = mutation({
  args: { aiContentId: v.id("aiContent"), publishedOutput: v.string() },
  handler: async (ctx, args) => {
    const content = await ctx.db.get(args.aiContentId);
    if (!content) throw new Error("AI content not found");

    let editDistance: number | undefined;
    let editDistanceSkipped = false;
    try {
      editDistance = wordLevelEditDistance(content.generatedContent, args.publishedOutput);
    } catch (error) {
      // Oversized texts are published normally; the metric is omitted rather than truncating or crashing.
      if (!(error instanceof RangeError)) throw error;
      editDistanceSkipped = true;
    }

    await ctx.db.patch(args.aiContentId, {
      publishedOutput: args.publishedOutput,
      publishedAt: Date.now(),
      editDistance,
    });
    return { success: true, editDistance, editDistanceSkipped };
  },
});
