import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

type SeedBlockOverrides = Partial<{
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  reviewStatus: "unreviewed" | "ai_approved" | "teacher_approved" | "rejected";
}>;

async function seedModelBlock(
  t: ReturnType<typeof convexTest>,
  contentHash: string,
  overrides: SeedBlockOverrides = {},
) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("contentBlocks", {
      blockType: "grammarExplainer",
      level: overrides.level ?? "B1",
      skill: "grammar",
      topic: "Workplace routines",
      title: "Present simple routines",
      body: {
        explanation: "Use the present simple for workplace routines.",
        examples: ["I check my calendar every morning."],
      },
      source: "model",
      rightsStatus: "proprietary",
      reviewStatus: overrides.reviewStatus ?? "ai_approved",
      exemplarEligible: false,
      contentHash,
      usageCount: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

describe("reviewBlock", () => {
  it("makes a teacher-approved model block exemplar eligible", async () => {
    const t = convexTest(schema, modules);
    const blockId = await seedModelBlock(t, "review-teacher-approved");

    await t.mutation(api.lessonDb.reviewBlock, {
      blockId,
      verdict: "teacher_approved",
    });

    const block = await t.run(async (ctx) => await ctx.db.get(blockId));
    expect(block?.reviewStatus).toBe("teacher_approved");
    expect(block?.exemplarEligible).toBe(true);
  });

  it("keeps a rejected model block out of the exemplar pool", async () => {
    const t = convexTest(schema, modules);
    const blockId = await seedModelBlock(t, "review-rejected");

    await t.mutation(api.lessonDb.reviewBlock, {
      blockId,
      verdict: "rejected",
    });

    const block = await t.run(async (ctx) => await ctx.db.get(blockId));
    expect(block?.reviewStatus).toBe("rejected");
    expect(block?.exemplarEligible).toBe(false);
  });
});

describe("blocksForReview", () => {
  it("returns only AI-approved blocks", async () => {
    const t = convexTest(schema, modules);
    await seedModelBlock(t, "queue-ai-approved-a1", { level: "A1" });
    await seedModelBlock(t, "queue-ai-approved-b2", { level: "B2" });
    await seedModelBlock(t, "queue-unreviewed", { reviewStatus: "unreviewed" });
    await seedModelBlock(t, "queue-teacher-approved", {
      reviewStatus: "teacher_approved",
    });

    const result = await t.query(api.lessonDb.blocksForReview, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(2);
    expect(result.page.map((block) => block.reviewStatus)).toEqual([
      "ai_approved",
      "ai_approved",
    ]);
  });

  it("filters the AI-approved review queue by level", async () => {
    const t = convexTest(schema, modules);
    await seedModelBlock(t, "level-filter-a1", { level: "A1" });
    await seedModelBlock(t, "level-filter-b2", { level: "B2" });
    await seedModelBlock(t, "level-filter-b2-unreviewed", {
      level: "B2",
      reviewStatus: "unreviewed",
    });

    const result = await t.query(api.lessonDb.blocksForReview, {
      paginationOpts: { numItems: 10, cursor: null },
      level: "B2",
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].level).toBe("B2");
    expect(result.page[0].reviewStatus).toBe("ai_approved");
  });
});
