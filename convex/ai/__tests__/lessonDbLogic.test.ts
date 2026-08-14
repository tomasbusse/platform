import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROMPT_TEMPLATE,
  admitVerdict,
  buildGeneratorPrompt,
  checkBlockLength,
  clampBatchCount,
  capRejectionReasons,
  checkDailyRunCap,
  computeAdmitRate,
  computeExemplarEligible,
  normalizeForHash,
  parseDistilledPrompt,
  parseGeneratedBlocks,
  parseJudgeVerdicts,
  pickLeastCoveredCell,
  resolvePromptTemplate,
  validateBlockBody,
  validateGeneratedBlockCandidate,
  validatePromptTemplate,
  shouldActivateCandidate,
  validateDistilledTemplate,
  wordLevelEditDistance,
} from "../lessonDbLogic";

describe("validateBlockBody", () => {
  const validBodies = {
    vocabSet: { words: ["brief", { en: "meeting", de: "Besprechung" }] },
    sentencePair: { en: "The meeting starts now.", de: "Die Besprechung beginnt jetzt." },
    dialogue: { turns: [{ speaker: "A", text: "Good morning." }] },
    grammarExplainer: { explanation: "Use the present simple for routines.", examples: ["I commute daily."] },
    exerciseAtom: { exerciseType: "multiple-choice", prompt: "Choose one.", answerKey: "goes", options: ["go", "goes"] },
    readingPassage: { text: "A short workplace text.", questions: ["What is it about?"] },
    listeningScript: { script: "Please join the call.", questions: ["What should you join?"] },
    culturalNote: { note: "Punctuality expectations vary by workplace." },
    imagePromptTemplate: { prompt: "A professional team meeting in Berlin" },
    speakingPrompt: { prompt: "Describe how you organise your workday." },
  } as const;

  for (const [blockType, body] of Object.entries(validBodies)) {
    it(`accepts a valid ${blockType} body`, () => {
      expect(validateBlockBody(blockType, body)).toEqual({ valid: true, errors: [] });
    });
  }

  it("rejects missing, empty, and incorrectly typed required fields", () => {
    expect(validateBlockBody("vocabSet", { words: [] }).valid).toBe(false);
    expect(validateBlockBody("sentencePair", { en: "Hello", de: 3 }).valid).toBe(false);
    expect(validateBlockBody("dialogue", { turns: [] }).valid).toBe(false);
    expect(validateBlockBody("grammarExplainer", { explanation: "", examples: [] }).valid).toBe(false);
    expect(validateBlockBody("readingPassage", { text: "Text", questions: [] }).valid).toBe(false);
    expect(validateBlockBody("listeningScript", { script: "", questions: [] }).valid).toBe(false);
    expect(validateBlockBody("culturalNote", { note: "" }).valid).toBe(false);
    expect(validateBlockBody("imagePromptTemplate", { prompt: 1 }).valid).toBe(false);
    expect(validateBlockBody("speakingPrompt", {}).valid).toBe(false);
    expect(validateBlockBody("unknown", {}).valid).toBe(false);
  });

  it("accepts an exercise answerKey matching an option value", () => {
    const result = validateBlockBody("exerciseAtom", {
      exerciseType: "multiple-choice",
      prompt: "Choose the past form.",
      answerKey: "went",
      options: ["go", "went"],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a zero-based exercise answerKey index", () => {
    const result = validateBlockBody("exerciseAtom", {
      exerciseType: "multiple-choice",
      prompt: "Choose the past form.",
      answerKey: 1,
      options: ["go", "went"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects an exercise answerKey inconsistent with its options", () => {
    const result = validateBlockBody("exerciseAtom", {
      exerciseType: "multiple-choice",
      prompt: "Choose the past form.",
      answerKey: 3,
      options: ["go", "went"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("answerKey");
  });
});

describe("computeExemplarEligible", () => {
  it("never admits model content approved only by AI", () => {
    expect(computeExemplarEligible("model", "ai_approved")).toBe(false);
  });

  it("admits teacher-approved model content", () => {
    expect(computeExemplarEligible("model", "teacher_approved")).toBe(true);
  });

  it("admits unreviewed human and seed-corpus content", () => {
    expect(computeExemplarEligible("human", "unreviewed")).toBe(true);
    expect(computeExemplarEligible("seed_corpus", "unreviewed")).toBe(true);
  });
});

describe("normalizeForHash", () => {
  it("normalizes strings and sorts object keys deterministically", () => {
    const left = normalizeForHash("sentencePair", {
      de: "  GUTEN   Morgen ",
      en: " Good\nMorning ",
      nested: { z: " VALUE ", a: 2 },
    });
    const right = normalizeForHash(" SentencePair ", {
      nested: { a: 2, z: "value" },
      en: "good morning",
      de: "guten morgen",
    });
    expect(left).toBe(right);
  });

  it("keeps array order significant", () => {
    expect(normalizeForHash("vocabSet", { words: ["one", "two"] })).not.toBe(
      normalizeForHash("vocabSet", { words: ["two", "one"] }),
    );
  });
});

describe("wordLevelEditDistance", () => {
  it("computes classic word-token edit distance", () => {
    expect(wordLevelEditDistance("The quick fox", "The slow brown fox")).toBe(2);
    expect(wordLevelEditDistance("", "one two")).toBe(2);
    expect(wordLevelEditDistance("HELLO, world!", "hello world")).toBe(0);
  });

  it("accepts inputs at the 1500-word boundary", () => {
    const text = Array.from({ length: 1500 }, (_, index) => `word${index}`).join(" ");
    expect(wordLevelEditDistance(text, text)).toBe(0);
  });

  it("throws a documented error above the 1500-word boundary", () => {
    const text = Array.from({ length: 1501 }, () => "word").join(" ");
    expect(() => wordLevelEditDistance(text, "short")).toThrow(/1500 words/);
  });
});

describe("DEFAULT_PROMPT_TEMPLATE", () => {
  it("contains every supported placeholder", () => {
    for (const placeholder of ["count", "level", "skill", "blockType", "topic", "exemplars"]) {
      expect(DEFAULT_PROMPT_TEMPLATE).toContain(`{{${placeholder}}}`);
    }
  });
});

describe("buildGeneratorPrompt", () => {
  const baseArgs = {
    template: DEFAULT_PROMPT_TEMPLATE,
    count: 4,
    level: "B1",
    skill: "speaking",
    blockType: "speakingPrompt",
    topic: "project updates",
    exemplars: [] as unknown[],
  };

  it("substitutes placeholders and emits fixed Simmonds constraints with empty exemplars", () => {
    const prompt = buildGeneratorPrompt(baseArgs);
    expect(prompt).toContain("4");
    expect(prompt).toContain("B1");
    expect(prompt).toContain("speakingPrompt");
    expect(prompt).toContain("No exemplars available");
    expect(prompt).toMatch(/adult German-L1 learners/i);
    expect(prompt).toMatch(/never childish/i);
    expect(prompt).toMatch(/CEFR-strict/i);
    expect(prompt).not.toContain("{{");
  });

  it("prepends the optional company system prompt and includes exemplars", () => {
    const prompt = buildGeneratorPrompt({
      ...baseArgs,
      systemPrompt: "Use Simmonds' concise brand voice.",
      exemplars: [{ title: "Stand-up update", body: { prompt: "Summarise yesterday's progress." } }],
    });
    expect(prompt.startsWith("Use Simmonds' concise brand voice.")).toBe(true);
    expect(prompt).toContain("Stand-up update");
    expect(prompt).toContain("Summarise yesterday's progress.");
  });

  it("works when systemPrompt and topic are missing", () => {
    const prompt = buildGeneratorPrompt({ ...baseArgs, topic: undefined });
    expect(prompt).toContain("general professional English");
    expect(prompt).not.toContain("undefined");
  });
});

describe("parseJudgeVerdicts", () => {
  it("parses a markdown-wrapped verdict array", () => {
    const result = parseJudgeVerdicts(`Here are the results:\n\`\`\`json\n[
      {"index":0,"pass":true,"pedagogy":4,"cefrFit":5,"voice":3,"reasons":[]}
    ]\n\`\`\``);
    expect(result).toEqual([
      { index: 0, pass: true, pedagogy: 4, cefrFit: 5, voice: 3, reasons: [] },
    ]);
  });

  it("rejects verdicts with missing or invalid fields", () => {
    expect(() => parseJudgeVerdicts('[{"index":0,"pass":true,"pedagogy":4}]')).toThrow(/verdict/i);
    expect(() => parseJudgeVerdicts('{"index":0}')).toThrow(/array/i);
    expect(() => parseJudgeVerdicts('[{"index":0,"pass":"yes","pedagogy":4,"cefrFit":5,"voice":3,"reasons":[]}]')).toThrow(/verdict/i);
    expect(() => parseJudgeVerdicts('[{"index":0,"pass":true,"pedagogy":6,"cefrFit":5,"voice":3,"reasons":[]}]')).toThrow(/verdict/i);
  });
});

describe("admitVerdict", () => {
  it("admits only passing verdicts at every score threshold", () => {
    expect(admitVerdict({ index: 0, pass: true, pedagogy: 3, cefrFit: 4, voice: 3, reasons: [] })).toBe(true);
    expect(admitVerdict({ index: 0, pass: false, pedagogy: 5, cefrFit: 5, voice: 5, reasons: [] })).toBe(false);
    expect(admitVerdict({ index: 0, pass: true, pedagogy: 2, cefrFit: 5, voice: 5, reasons: [] })).toBe(false);
    expect(admitVerdict({ index: 0, pass: true, pedagogy: 5, cefrFit: 3, voice: 5, reasons: [] })).toBe(false);
    expect(admitVerdict({ index: 0, pass: true, pedagogy: 5, cefrFit: 5, voice: 2, reasons: [] })).toBe(false);
  });
});

describe("checkDailyRunCap", () => {
  const now = 2_000_000_000_000;
  const recent = (count: number) => Array.from({ length: count }, (_, index) => now - index * 1_000);

  it("allows 19 recent runs", () => {
    expect(checkDailyRunCap(recent(19), now)).toEqual({ allowed: true });
  });

  it("refuses exactly 20 or 21 recent runs", () => {
    expect(checkDailyRunCap(recent(20), now)).toMatchObject({ allowed: false });
    expect(checkDailyRunCap(recent(21), now)).toMatchObject({ allowed: false });
  });

  it("ignores runs older than 24 hours", () => {
    expect(checkDailyRunCap([...recent(19), now - 86_400_001], now)).toEqual({ allowed: true });
  });
});

describe("capRejectionReasons", () => {
  it("caps rejection reasons at 20 while preserving order", () => {
    const reasons = Array.from({ length: 25 }, (_, index) => `reason-${index}`);
    expect(capRejectionReasons(reasons)).toEqual(reasons.slice(0, 20));
  });
});

describe("generation batch helpers", () => {
  it("clamps batch counts to finite integers from 1 through 40", () => {
    expect(clampBatchCount(undefined)).toBe(10);
    expect(clampBatchCount(Number.NaN)).toBe(10);
    expect(clampBatchCount(0)).toBe(1);
    expect(clampBatchCount(12.9)).toBe(12);
    expect(clampBatchCount(100)).toBe(40);
  });

  it("parses markdown-wrapped generated block arrays", () => {
    expect(parseGeneratedBlocks('```json\n[{"title":"One","topic":"Work","body":{"note":"Useful context"}}]\n```')).toHaveLength(1);
    expect(() => parseGeneratedBlocks('{"title":"not an array"}')).toThrow(/array/i);
  });

  it("validates the generated block envelope before body-specific checks", () => {
    expect(validateGeneratedBlockCandidate({ title: "Useful title", topic: "Work", body: { note: "Context" } })).toMatchObject({ valid: true });
    expect(validateGeneratedBlockCandidate({ title: "", body: null })).toMatchObject({ valid: false });
  });

  it("enforces the documented serialized body length ceiling", () => {
    expect(checkBlockLength({ note: "A useful note" })).toEqual({ valid: true });
    expect(checkBlockLength({ note: "x".repeat(20_001) })).toMatchObject({ valid: false });
  });

  it("picks the first least-covered cell deterministically", () => {
    const first = { level: "A1", skill: "grammar", blockType: "exerciseAtom" };
    const second = { level: "B1", skill: "speaking", blockType: "speakingPrompt" };
    expect(pickLeastCoveredCell([
      { cell: first, count: 10 },
      { cell: second, count: 2 },
      { cell: { level: "C1", skill: "reading", blockType: "readingPassage" }, count: 2 },
    ])).toEqual(second);
    expect(() => pickLeastCoveredCell([])).toThrow(/candidate/i);
  });

  it("computes aggregate admit rate safely", () => {
    expect(computeAdmitRate([{ generated: 8, admitted: 4 }, { generated: 2, admitted: 1 }])).toBe(0.5);
    expect(computeAdmitRate([{ generated: 0, admitted: 0 }])).toBe(0);
  });

  it("parses a distilled prompt object and rejects incomplete output", () => {
    expect(parseDistilledPrompt('```json\n{"template":"Generate {{count}} items","changeNotes":"Tightened CEFR rules"}\n```')).toEqual({
      template: "Generate {{count}} items",
      changeNotes: "Tightened CEFR rules",
    });
    expect(() => parseDistilledPrompt('{"template":""}')).toThrow(/template/i);
  });

  it("requires every generator placeholder in a distilled template", () => {
    expect(validatePromptTemplate(DEFAULT_PROMPT_TEMPLATE)).toEqual({ valid: true, missing: [] });
    expect(validatePromptTemplate("Generate {{count}} at {{level}}")).toEqual({
      valid: false,
      missing: ["skill", "blockType", "topic", "exemplars"],
    });
  });
});

describe("buildGeneratorPrompt hard contract (v2-drift regression)", () => {
  const promptFor = (blockType: string, template = DEFAULT_PROMPT_TEMPLATE) =>
    buildGeneratorPrompt({
      template,
      count: 5,
      level: "A2",
      skill: "grammar",
      blockType,
      topic: "Office small talk",
      exemplars: [],
    });

  it("marks the code-owned constraints as overriding any conflicting template text", () => {
    const prompt = promptFor("exerciseAtom");
    expect(prompt.toLowerCase()).toContain("override any conflicting");
  });

  it("pins learner-facing content to English even if the template says otherwise", () => {
    const hostileTemplate = `${DEFAULT_PROMPT_TEMPLATE}\nAll body text must be in German.`;
    const prompt = promptFor("exerciseAtom", hostileTemplate);
    expect(prompt).toMatch(/content (must be|is) (written )?in English/i);
  });

  it("gives exerciseAtom a concrete example and the exact-option answerKey rule", () => {
    const prompt = promptFor("exerciseAtom");
    expect(prompt).toContain('"exerciseType"');
    expect(prompt).toMatch(/answerKey.*(exactly one of|copied verbatim from).*options/i);
    expect(prompt).toContain('"goes"');
  });
});

describe("validateDistilledTemplate", () => {
  it("accepts a template with all placeholders under the size cap", () => {
    const result = validateDistilledTemplate(DEFAULT_PROMPT_TEMPLATE);
    expect(result.valid).toBe(true);
  });

  it("rejects a template missing placeholders", () => {
    const result = validateDistilledTemplate("Generate {{count}} things.");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder/i);
  });

  it("rejects an oversized template", () => {
    const bloated = DEFAULT_PROMPT_TEMPLATE + "x".repeat(6001);
    const result = validateDistilledTemplate(bloated);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/6000|size|long/i);
  });
});

describe("shouldActivateCandidate", () => {
  it("activates when the canary beats the baseline", () => {
    expect(shouldActivateCandidate(0.8, 0.6)).toBe(true);
  });

  it("activates when the canary equals a non-zero baseline", () => {
    expect(shouldActivateCandidate(0.6, 0.6)).toBe(true);
  });

  it("refuses when the canary is worse than the baseline", () => {
    expect(shouldActivateCandidate(0.4, 0.6)).toBe(false);
  });

  it("refuses a zero-admit canary regardless of baseline", () => {
    expect(shouldActivateCandidate(0, 0)).toBe(false);
  });
});

describe("resolvePromptTemplate", () => {
  const active = { version: 3, template: "active {{count}} {{level}} {{skill}} {{blockType}} {{topic}} {{exemplars}}" };

  it("prefers an explicit override template and its version label", () => {
    const resolved = resolvePromptTemplate({
      activePrompt: active,
      templateOverride: "candidate template",
      promptVersionOverride: 9,
    });
    expect(resolved).toEqual({ template: "candidate template", version: 9, needsSeed: false });
  });

  it("falls back to the active prompt when there is no override", () => {
    const resolved = resolvePromptTemplate({ activePrompt: active });
    expect(resolved).toEqual({ template: active.template, version: 3, needsSeed: false });
  });

  it("uses the built-in default and flags seeding when nothing is active", () => {
    const resolved = resolvePromptTemplate({ activePrompt: null });
    expect(resolved).toEqual({ template: DEFAULT_PROMPT_TEMPLATE, version: 1, needsSeed: true });
  });

  it("override without a version label falls back to the active version", () => {
    const resolved = resolvePromptTemplate({ activePrompt: active, templateOverride: "candidate" });
    expect(resolved).toEqual({ template: "candidate", version: 3, needsSeed: false });
  });
});
