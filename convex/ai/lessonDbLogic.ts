export type BlockSource = "human" | "model" | "seed_corpus";
export type ReviewStatus = "unreviewed" | "ai_approved" | "teacher_approved" | "rejected";

export type JudgeVerdict = {
  index: number;
  pass: boolean;
  pedagogy: number;
  cefrFit: number;
  voice: number;
  reasons: string[];
};

export const DEFAULT_PROMPT_TEMPLATE = `Generate exactly {{count}} reusable lesson-content blocks for this target cell:
- CEFR level: {{level}}
- Skill: {{skill}}
- Block type: {{blockType}}
- Topic: {{topic}}

Use these trusted exemplars only as quality and voice references; do not copy them:
{{exemplars}}

Return only a valid JSON array of exactly {{count}} objects. Each object must contain "title", "topic", and "body".`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNonEmptyArray = (value: unknown): value is unknown[] =>
  Array.isArray(value) && value.length > 0;

export function validateBlockBody(
  blockType: string,
  body: unknown,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(body)) {
    return { valid: false, errors: ["body must be an object"] };
  }

  const requireString = (field: string) => {
    if (!isNonEmptyString(body[field])) errors.push(`${field} must be a non-empty string`);
  };
  const requireArray = (field: string) => {
    if (!isNonEmptyArray(body[field])) errors.push(`${field} must be a non-empty array`);
  };

  switch (blockType) {
    case "vocabSet":
      requireArray("words");
      break;
    case "sentencePair":
      requireString("en");
      requireString("de");
      if (body.attribution !== undefined && !isNonEmptyString(body.attribution)) {
        errors.push("attribution must be a non-empty string when present");
      }
      break;
    case "dialogue":
      requireArray("turns");
      break;
    case "grammarExplainer":
      requireString("explanation");
      requireArray("examples");
      break;
    case "exerciseAtom": {
      requireString("exerciseType");
      requireString("prompt");
      const answerKey = body.answerKey;
      if (!isNonEmptyString(answerKey) && typeof answerKey !== "number") {
        errors.push("answerKey must be a non-empty string or number");
      }
      if (body.options !== undefined) {
        if (!Array.isArray(body.options)) {
          errors.push("options must be an array when present");
        } else if (body.options.length === 0) {
          errors.push("options must not be empty when present");
        } else {
          const matchesValue = body.options.some((option) => Object.is(option, answerKey));
          const isValidIndex =
            typeof answerKey === "number" &&
            Number.isInteger(answerKey) &&
            answerKey >= 0 &&
            answerKey < body.options.length;
          if (!matchesValue && !isValidIndex) {
            errors.push("answerKey must match an option value or be a valid zero-based options index");
          }
        }
      }
      break;
    }
    case "readingPassage":
      requireString("text");
      requireArray("questions");
      break;
    case "listeningScript":
      requireString("script");
      requireArray("questions");
      break;
    case "culturalNote":
      requireString("note");
      break;
    case "imagePromptTemplate":
    case "speakingPrompt":
      requireString("prompt");
      break;
    default:
      errors.push(`unsupported blockType: ${blockType}`);
  }

  return { valid: errors.length === 0, errors };
}

export function computeExemplarEligible(source: BlockSource, reviewStatus: ReviewStatus): boolean {
  return source === "human" || source === "seed_corpus" || reviewStatus === "teacher_approved";
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeValue(value[key])]),
    );
  }
  return value;
}

export function normalizeForHash(blockType: string, body: unknown): string {
  return JSON.stringify({
    blockType: blockType.trim().toLocaleLowerCase("en-US"),
    body: normalizeValue(body),
  });
}

function tokenizeWords(value: string): string[] {
  const normalized = value
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
  return normalized ?? [];
}

export function wordLevelEditDistance(a: string, b: string): number {
  const left = tokenizeWords(a);
  const right = tokenizeWords(b);
  // Refuse oversized inputs explicitly: silently truncating would make the stored metric misleading.
  if (left.length > 1500 || right.length > 1500) {
    throw new RangeError("wordLevelEditDistance accepts at most 1500 words per input");
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

const BLOCK_SHAPE_INSTRUCTIONS: Record<string, string> = {
  vocabSet: '{ "words": [non-empty vocabulary entries] }',
  sentencePair: '{ "en": "English sentence", "de": "German translation", "attribution"?: "source" }',
  dialogue: '{ "turns": [non-empty ordered dialogue turns] }',
  grammarExplainer: '{ "explanation": "clear explanation", "examples": [non-empty examples] }',
  exerciseAtom:
    '{ "exerciseType": "multiple_choice", "prompt": "She ___ to work every day.", "options": ["go", "goes", "going"], "answerKey": "goes" } — ' +
    "answerKey MUST be exactly one of the options strings, copied verbatim from options (never a letter label, never an object); " +
    "if the exercise has no options, answerKey is the exact expected answer string.",
  readingPassage: '{ "text": "passage", "questions": [non-empty questions] }',
  listeningScript: '{ "script": "script", "questions": [non-empty questions] }',
  culturalNote: '{ "note": "cultural note" }',
  imagePromptTemplate: '{ "prompt": "image-generation prompt" }',
  speakingPrompt: '{ "prompt": "speaking task" }',
};

export function buildGeneratorPrompt(args: {
  template: string;
  count: number;
  level: string;
  skill: string;
  blockType: string;
  topic?: string;
  exemplars: unknown[];
  systemPrompt?: string;
}): string {
  const topic = args.topic?.trim() || "general professional English";
  const exemplars = args.exemplars.length
    ? args.exemplars.map((exemplar, index) => `${index + 1}. ${JSON.stringify(exemplar)}`).join("\n")
    : "No exemplars available; rely on the constraints below.";
  const substitutions: Record<string, string> = {
    count: String(args.count),
    level: args.level,
    skill: args.skill,
    blockType: args.blockType,
    topic,
    exemplars,
  };
  const populatedTemplate = Object.entries(substitutions).reduce(
    (prompt, [name, value]) => prompt.split(`{{${name}}}`).join(value),
    args.template,
  );
  const shape = BLOCK_SHAPE_INSTRUCTIONS[args.blockType] ?? "a JSON object appropriate to the requested block type";
  const systemPrompt = args.systemPrompt?.trim();

  return [
    systemPrompt,
    populatedTemplate,
    `Target cell: level=${args.level}; skill=${args.skill}; blockType=${args.blockType}; topic=${topic}.`,
    `Required body shape: ${shape}`,
    `Fixed Simmonds constraints:
- Design for adult German-L1 learners in a professional tone; never childish.
- Use English content with German hints only where pedagogically useful.
- Keep vocabulary CEFR-strict for ${args.level}; do not leak substantially harder vocabulary.
- Make every item reusable, self-contained, accurate, and free of copied exemplar wording.
- Learner-facing content must be written in English; German appears only in short optional hints.`,
    `The "Required body shape" and "Fixed Simmonds constraints" sections above are authoritative and override any conflicting instruction elsewhere in this prompt, including the template section.`,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function extractJSON(text: string): string {
  let cleaned = text.trim();
  const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlock) cleaned = codeBlock[1].trim();
  const array = cleaned.match(/\[[\s\S]*\]/);
  if (array) return array[0];
  const object = cleaned.match(/\{[\s\S]*\}/);
  return object?.[0] ?? cleaned;
}

export function parseJudgeVerdicts(rawJsonText: string): JudgeVerdict[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawJsonText));
  } catch {
    throw new Error("Judge response is not valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Judge response must be an array");

  return parsed.map((value, position) => {
    if (
      !isRecord(value) ||
      typeof value.index !== "number" ||
      !Number.isInteger(value.index) ||
      value.index < 0 ||
      typeof value.pass !== "boolean" ||
      typeof value.pedagogy !== "number" ||
      !Number.isFinite(value.pedagogy) ||
      value.pedagogy < 1 ||
      value.pedagogy > 5 ||
      typeof value.cefrFit !== "number" ||
      !Number.isFinite(value.cefrFit) ||
      value.cefrFit < 1 ||
      value.cefrFit > 5 ||
      typeof value.voice !== "number" ||
      !Number.isFinite(value.voice) ||
      value.voice < 1 ||
      value.voice > 5 ||
      !Array.isArray(value.reasons) ||
      !value.reasons.every((reason) => typeof reason === "string")
    ) {
      throw new Error(`Invalid judge verdict at position ${position}`);
    }
    return {
      index: value.index,
      pass: value.pass,
      pedagogy: value.pedagogy,
      cefrFit: value.cefrFit,
      voice: value.voice,
      reasons: value.reasons,
    };
  });
}

export function admitVerdict(verdict: JudgeVerdict): boolean {
  return (
    verdict.pass === true &&
    verdict.cefrFit >= 4 &&
    verdict.pedagogy >= 3 &&
    verdict.voice >= 3
  );
}

export function checkDailyRunCap(
  recentRunTimestamps: number[],
  now: number,
): { allowed: boolean; reason?: string } {
  const cutoff = now - 86_400_000;
  const recentCount = recentRunTimestamps.filter(
    (timestamp) => timestamp >= cutoff && timestamp <= now,
  ).length;
  if (recentCount >= 20) {
    return { allowed: false, reason: "Daily generation run cap of 20 has been reached" };
  }
  return { allowed: true };
}

export function capRejectionReasons(reasons: string[]): string[] {
  return reasons.slice(0, 20);
}

export function clampBatchCount(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 10;
  return Math.max(1, Math.min(40, Math.floor(count)));
}

export function parseGeneratedBlocks(rawJsonText: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawJsonText));
  } catch {
    throw new Error("Generator response is not valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Generator response must be an array");
  return parsed;
}

export type GeneratedBlockCandidate = {
  title: string;
  topic: string;
  body: unknown;
};

export function validateGeneratedBlockCandidate(value: unknown):
  | { valid: true; value: GeneratedBlockCandidate; errors: [] }
  | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["item must be an object"] };
  if (!isNonEmptyString(value.title)) errors.push("title must be a non-empty string");
  if (!isNonEmptyString(value.topic)) errors.push("topic must be a non-empty string");
  if (!isRecord(value.body)) errors.push("body must be an object");
  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: { title: value.title as string, topic: value.topic as string, body: value.body },
    errors: [],
  };
}

export function checkBlockLength(body: unknown): { valid: boolean; reason?: string } {
  const serialized = JSON.stringify(body);
  if (!serialized || serialized.length < 10) {
    return { valid: false, reason: "body is too short to be useful" };
  }
  // 20k serialized characters is intentionally conservative for an atomized, reusable block.
  if (serialized.length > 20_000) {
    return { valid: false, reason: "body exceeds the 20000-character limit" };
  }
  return { valid: true };
}

export function pickLeastCoveredCell<T>(
  candidates: Array<{ cell: T; count: number }>,
): T {
  if (candidates.length === 0) throw new Error("At least one candidate cell is required");
  return candidates.reduce((least, candidate) =>
    candidate.count < least.count ? candidate : least,
  ).cell;
}

export function computeAdmitRate(
  runs: Array<{ generated: number; admitted: number }>,
): number {
  const generated = runs.reduce((total, run) => total + run.generated, 0);
  if (generated === 0) return 0;
  return runs.reduce((total, run) => total + run.admitted, 0) / generated;
}

export function parseDistilledPrompt(rawJsonText: string): {
  template: string;
  changeNotes?: string;
} {
  let cleaned = rawJsonText.trim();
  const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlock) cleaned = codeBlock[1].trim();
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) cleaned = objectMatch[0];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Distilled prompt response is not valid JSON");
  }
  if (!isRecord(parsed) || !isNonEmptyString(parsed.template)) {
    throw new Error("Distilled prompt response must contain a non-empty template");
  }
  if (parsed.changeNotes !== undefined && !isNonEmptyString(parsed.changeNotes)) {
    throw new Error("Distilled prompt changeNotes must be a non-empty string when present");
  }
  return {
    template: parsed.template,
    changeNotes: parsed.changeNotes as string | undefined,
  };
}

const REQUIRED_PROMPT_PLACEHOLDERS = [
  "count",
  "level",
  "skill",
  "blockType",
  "topic",
  "exemplars",
] as const;

export function validatePromptTemplate(template: string): {
  valid: boolean;
  missing: string[];
} {
  const missing = REQUIRED_PROMPT_PLACEHOLDERS.filter(
    (placeholder) => !template.includes(`{{${placeholder}}}`),
  );
  return { valid: missing.length === 0, missing: [...missing] };
}

const MAX_DISTILLED_TEMPLATE_CHARS = 6000;

export function validateDistilledTemplate(template: string): {
  valid: boolean;
  reason?: string;
} {
  const placeholders = validatePromptTemplate(template);
  if (!placeholders.valid) {
    return {
      valid: false,
      reason: `missing placeholders: ${placeholders.missing.join(", ")}`,
    };
  }
  if (template.length > MAX_DISTILLED_TEMPLATE_CHARS) {
    return {
      valid: false,
      reason: `template exceeds the ${MAX_DISTILLED_TEMPLATE_CHARS}-character size cap`,
    };
  }
  return { valid: true };
}

export function shouldActivateCandidate(
  canaryAdmitRate: number,
  baselineAdmitRate: number,
): boolean {
  return canaryAdmitRate > 0 && canaryAdmitRate >= baselineAdmitRate;
}

export function parseProviderModel(model: string): {
  provider: "cerebras" | "openrouter";
  model: string;
  endpoint: string;
  keyEnvVar: string | null;
} {
  if (model.startsWith("cerebras/")) {
    return {
      provider: "cerebras",
      model: model.slice("cerebras/".length),
      endpoint: "https://api.cerebras.ai/v1/chat/completions",
      keyEnvVar: "CEREBRAS_API_KEY",
    };
  }
  return {
    provider: "openrouter",
    model,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyEnvVar: null,
  };
}

export function resolvePromptTemplate(args: {
  activePrompt: { version: number; template: string } | null;
  templateOverride?: string;
  promptVersionOverride?: number;
}): { template: string; version: number; needsSeed: boolean } {
  if (args.templateOverride) {
    return {
      template: args.templateOverride,
      version: args.promptVersionOverride ?? args.activePrompt?.version ?? 1,
      needsSeed: false,
    };
  }
  if (args.activePrompt) {
    return {
      template: args.activePrompt.template,
      version: args.activePrompt.version,
      needsSeed: false,
    };
  }
  return { template: DEFAULT_PROMPT_TEMPLATE, version: 1, needsSeed: true };
}
