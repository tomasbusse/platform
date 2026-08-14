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

describe("generatePodcast", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("turns DB dialogue blocks into a Hume-voiced mp3 in storage", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("contentBlocks", {
        blockType: "dialogue",
        level: "A2",
        skill: "speaking",
        topic: "Office small talk",
        title: "Monday morning chat",
        body: { turns: [{ speaker: "A", text: "How was your weekend?" }, { speaker: "B", text: "Great, thanks!" }] },
        source: "seed_corpus",
        rightsStatus: "public_domain",
        reviewStatus: "unreviewed",
        exemplarEligible: true,
        contentHash: "podcasttesthash1",
        usageCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    vi.stubEnv("HUME_API_KEY", "hume-test");
    const scriptJson = JSON.stringify({
      title: "Small Talk am Montag",
      segments: [
        { speaker: "host", text: "Welcome to the Simmonds podcast!" },
        { speaker: "guest", text: "How was your weekend?" },
      ],
    });
    const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04]).buffer;
    const calls: Array<[string, { headers: Record<string, string> }]> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      calls.push([url, init]);
      if (calls.length === 1) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: scriptJson } }], usage: { total_tokens: 50 } }) };
      }
      return { ok: true, arrayBuffer: async () => mp3Bytes };
    }));

    const result = await t.action(internal.ai.podcast.generatePodcast, {
      companyId,
      level: "A2",
      topic: "Office small talk",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.title).toBe("Small Talk am Montag");
      expect(result.audioUrl).toMatch(/^https?:\/\//);
      expect(result.segments).toBe(2);
    }
    expect(calls[0][0]).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(calls[1][0]).toBe("https://api.hume.ai/v0/tts/file");
    expect(calls[1][1].headers["X-Hume-Api-Key"]).toBe("hume-test");
  });
});

describe("Cerebras provider routing", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("sends a cerebras/ generator model to the Cerebras endpoint with the env key", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    const fetchMock = stubFetchQueue([VALID_EXERCISE_BLOCKS, PASSING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.runGenerationBatch, {
      companyId,
      count: 2,
      level: "A2",
      skill: "grammar",
      blockType: "exerciseAtom",
      generatorModel: "cerebras/gemma-4-31b",
    });

    expect(result.success).toBe(true);
    const generatorCall = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(generatorCall[0]).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(generatorCall[1].headers.Authorization).toBe("Bearer csk-test");
    expect(JSON.parse(generatorCall[1].body).model).toBe("gemma-4-31b");
    // Judge stays on OpenRouter.
    const judgeCall = fetchMock.mock.calls[1] as unknown as [string];
    expect(judgeCall[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("routes an explicit cerebras/ judge model to the Cerebras endpoint too", async () => {
    const t = convexTest(schema, modules);
    const companyId = await seedCompanyAndRuns(t);
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    const fetchMock = stubFetchQueue([VALID_EXERCISE_BLOCKS, PASSING_VERDICTS]);

    const result = await t.action(internal.ai.generateBlocks.runGenerationBatch, {
      companyId,
      count: 2,
      level: "A2",
      skill: "grammar",
      blockType: "exerciseAtom",
      generatorModel: "cerebras/gemma-4-31b",
      judgeModel: "cerebras/gpt-oss-120b",
    });

    expect(result.success).toBe(true);
    const judgeCall = fetchMock.mock.calls[1] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(judgeCall[0]).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(JSON.parse(judgeCall[1].body).model).toBe("gpt-oss-120b");
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
