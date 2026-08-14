import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

function openRouterResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { total_tokens: 100 },
    }),
  };
}

/** Queue-based fetch stub: each call shifts the next canned OpenRouter reply. */
function stubFetchQueue(contents: string[]) {
  const queue = [...contents];
  const mock = vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("fetch queue exhausted");
    return openRouterResponse(next);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const VALID_EXERCISE_BLOCKS = JSON.stringify([
  {
    title: "Present simple check",
    topic: "Office small talk",
    body: {
      exerciseType: "multiple_choice",
      prompt: "She ___ to work every day.",
      options: ["go", "goes", "going"],
      answerKey: "goes",
    },
  },
  {
    title: "Question forms",
    topic: "Office small talk",
    body: {
      exerciseType: "multiple_choice",
      prompt: "___ you like coffee?",
      options: ["Do", "Does", "Doing"],
      answerKey: "Do",
    },
  },
]);

const PASSING_VERDICTS = JSON.stringify([
  { index: 0, pass: true, pedagogy: 5, cefrFit: 5, voice: 5, reasons: [] },
  { index: 1, pass: true, pedagogy: 5, cefrFit: 5, voice: 5, reasons: [] },
]);

async function seedCompanyAndRuns(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const companyId = await ctx.db.insert("companies", {
      name: "Simmonds Test",
      contactEmail: "test@example.com",
      currentStudentCount: 0,
      settings: { openRouterApiKey: "test-key" },
      createdAt: 1,
      updatedAt: 1,
    });
    for (let index = 0; index < 3; index += 1) {
      await ctx.db.insert("generationRuns", {
        companyId,
        status: "completed",
        target: { level: "A2", skill: "grammar", blockType: "exerciseAtom" },
        promptVersion: 1,
        generatorModel: "g",
        judgeModel: "j",
        requested: 10,
        generated: 10,
        admitted: 5,
        rejected: 5,
        rejectionReasons: ["item 0: answerKey must be a non-empty string or number"],
        startedAt: Date.now() - 1000 - index,
        finishedAt: Date.now() - 900 - index,
      });
    }
    await ctx.db.insert("generationPrompts", {
      purpose: "contentBlock",
      version: 1,
      template:
        "Base {{count}} {{level}} {{skill}} {{blockType}} {{topic}} {{exemplars}}",
      active: true,
      createdAt: 1,
    });
    return companyId;
  });
}

async function activePromptVersion(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const prompts = await ctx.db.query("generationPrompts").collect();
    return prompts.find((prompt) => prompt.active)?.version;
  });
}

describe("runGenerationBatch templateOverride canary support", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("runs with an override template and records the override prompt version", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    stubFetchQueue([VALID_EXERCISE_BLOCKS, PASSING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.runGenerationBatch, {
      companyId,
      count: 2,
      level: "A2",
      skill: "grammar",
      blockType: "exerciseAtom",
      topic: "Office small talk",
      templateOverride:
        "Candidate {{count}} {{level}} {{skill}} {{blockType}} {{topic}} {{exemplars}}",
      promptVersionOverride: 9,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.promptVersion).toBe(9);
      expect(result.admitted).toBe(2);
    }
    // The override must NOT change which prompt is active.
    expect(await activePromptVersion(t)).toBe(1);
    // Model-generated content is the school's own work product.
    const blocks = await t.run(async (ctx) => await ctx.db.query("contentBlocks").collect());
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.rightsStatus).toBe("proprietary");
    }
  });
});

describe("nightlyGeneration cron wrapper", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("resolves the company from SIMMONDS_COMPANY_ID and runs one batch", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    vi.stubEnv("SIMMONDS_COMPANY_ID", companyId);
    stubFetchQueue([VALID_EXERCISE_BLOCKS, PASSING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.nightlyGeneration, {});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.admitted).toBe(2);
    }
  });

  it("weeklyDistill resolves the company from SIMMONDS_COMPANY_ID and distills with canary", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    vi.stubEnv("SIMMONDS_COMPANY_ID", companyId);
    stubFetchQueue([DISTILLED_TEMPLATE, VALID_EXERCISE_BLOCKS, PASSING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.weeklyDistill, {});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.activated).toBe(true);
    }
  });
});

const DISTILLED_TEMPLATE = JSON.stringify({
  template:
    "Improved: {{count}} blocks at {{level}} for {{skill}} / {{blockType}} on {{topic}}.\nExemplars: {{exemplars}}\nReturn a JSON array of objects with title, topic, body.",
  changeNotes: "test-distilled",
});

describe("distillPrompt canary gate", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("activates the candidate only after a canary batch beats the baseline admit rate", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    // Call order: distiller, then canary generator, then canary judge.
    // All canary blocks admitted → canary rate 1.0 > 0.5 baseline → must activate v2.
    stubFetchQueue([DISTILLED_TEMPLATE, VALID_EXERCISE_BLOCKS, PASSING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.distillPrompt, {
      companyId,
      autoActivate: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.activated).toBe(true);
      expect(result.canary).toEqual({ generated: 2, admitted: 2 });
    }
    expect(await activePromptVersion(t)).toBe(2);
  });

  it("refuses activation and keeps the old prompt when the canary is worse", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    // Canary judge rejects everything → canary rate 0 < 0.5 baseline → keep v1 active.
    const FAILING_VERDICTS = JSON.stringify([
      { index: 0, pass: false, pedagogy: 2, cefrFit: 2, voice: 2, reasons: ["off level"] },
      { index: 1, pass: false, pedagogy: 2, cefrFit: 2, voice: 2, reasons: ["off level"] },
    ]);
    stubFetchQueue([DISTILLED_TEMPLATE, VALID_EXERCISE_BLOCKS, FAILING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.distillPrompt, {
      companyId,
      autoActivate: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.activated).toBe(false);
      expect(result.canary).toEqual({ generated: 2, admitted: 0 });
    }
    expect(await activePromptVersion(t)).toBe(1);
  });
});
