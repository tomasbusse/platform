import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

// Registration only — the scheduled actions themselves are tested in
// convex/ai/__tests__/generateBlocks.integration.test.ts (60 passing).
// Odd minutes on purpose: top-of-hour crons stampede shared infrastructure.
const crons = cronJobs();

// Nightly content generation: 15 exercise atoms into the least-covered cell.
// Bounded by the 20-run/24h spend guard and deployment usage limits.
crons.daily(
  "nightly content generation",
  { hourUTC: 2, minuteUTC: 47 },
  internal.ai.generateBlocks.nightlyGeneration,
  {},
);

// Weekly prompt self-distillation: candidate prompts only activate after a live
// canary batch meets or beats the current admit rate.
crons.weekly(
  "weekly prompt distillation",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 17 },
  internal.ai.generateBlocks.weeklyDistill,
  {},
);

export default crons;
