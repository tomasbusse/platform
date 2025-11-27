import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getAIContent = query({
  args: {
    companyId: v.id("companies"),
    type: v.optional(v.string()),
    level: v.optional(v.string()),
    reviewStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let content = await ctx.db
      .query("aiContent")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.type) {
      content = content.filter(c => c.type === args.type);
    }

    if (args.level) {
      content = content.filter(c => c.level === args.level);
    }

    if (args.reviewStatus) {
      content = content.filter(c => c.reviewStatus === args.reviewStatus);
    }

    return content.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getAIContentById = query({
  args: { contentId: v.id("aiContent") },
  handler: async (ctx, args) => {
    const content = await ctx.db.get(args.contentId);
    return content;
  },
});

export const createAIContent = mutation({
  args: {
    companyId: v.id("companies"),
    createdBy: v.id("users"),
    type: v.string(),
    level: v.string(),
    topic: v.string(),
    prompt: v.string(),
    generatedContent: v.string(),
    model: v.string(),
    wordCount: v.number(),
    topics: v.array(v.string()),
    reviewStatus: v.string(),
    isUsed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const contentId = await ctx.db.insert("aiContent", {
      companyId: args.companyId,
      createdBy: args.createdBy,
      type: args.type as "lesson" | "quiz" | "exercise",
      level: args.level,
      topic: args.topic,
      prompt: args.prompt,
      generatedContent: args.generatedContent,
      model: args.model,
      wordCount: args.wordCount,
      topics: args.topics,
      reviewStatus: args.reviewStatus as "pending" | "approved" | "rejected",
      isUsed: args.isUsed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return contentId;
  },
});

export const updateAIContent = mutation({
  args: {
    contentId: v.id("aiContent"),
    generatedContent: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    topics: v.optional(v.array(v.string())),
    reviewStatus: v.optional(v.string()),
    isUsed: v.optional(v.boolean()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { contentId, ...updates } = args;

    const updateData: any = {};
    if (updates.generatedContent !== undefined) updateData.generatedContent = updates.generatedContent;
    if (updates.wordCount !== undefined) updateData.wordCount = updates.wordCount;
    if (updates.topics !== undefined) updateData.topics = updates.topics;
    if (updates.reviewStatus !== undefined) updateData.reviewStatus = updates.reviewStatus;
    if (updates.isUsed !== undefined) updateData.isUsed = updates.isUsed;
    if (updates.reviewedBy !== undefined) updateData.reviewedBy = updates.reviewedBy;
    if (updates.reviewedAt !== undefined) updateData.reviewedAt = updates.reviewedAt;

    await ctx.db.patch(contentId, updateData);
    return contentId;
  },
});

export const updateReviewStatus = mutation({
  args: {
    contentId: v.id("aiContent"),
    reviewStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contentId, {
      reviewStatus: args.reviewStatus as "pending" | "approved" | "rejected",
      updatedAt: Date.now(),
    });

    return args.contentId;
  },
});
