import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getUserProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return progress;
  },
});

export const getCompanyProgress = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    return progress;
  },
});

export const createOrUpdateProgress = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    currentLevel: v.string(),
    overallScore: v.number(),
    totalSessions: v.number(),
    completedLessons: v.number(),
    totalLessons: v.number(),
    streakDays: v.number(),
    lastActivity: v.number(),
    testHistory: v.array(v.object({
      testId: v.string(),
      sessionId: v.string(),
      score: v.number(),
      date: v.number(),
      level: v.string(),
    })),
    skillScores: v.object({
      grammar: v.number(),
      vocabulary: v.number(),
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
      speaking: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currentLevel: args.currentLevel,
        overallScore: args.overallScore,
        totalSessions: args.totalSessions,
        completedLessons: args.completedLessons,
        totalLessons: args.totalLessons,
        streakDays: args.streakDays,
        lastActivity: args.lastActivity,
        testHistory: args.testHistory,
        skillScores: args.skillScores,
      });
      return existing._id;
    } else {
      const now = Date.now();
      const progressId = await ctx.db.insert("progress", {
        userId: args.userId,
        companyId: args.companyId,
        currentLevel: args.currentLevel,
        overallScore: args.overallScore,
        totalSessions: args.totalSessions,
        completedLessons: args.completedLessons,
        totalLessons: args.totalLessons,
        streakDays: args.streakDays,
        lastActivity: args.lastActivity,
        testHistory: args.testHistory,
        skillScores: args.skillScores,
        createdAt: now,
        updatedAt: now,
      });
      return progressId;
    }
  },
});

export const updateProgressAfterTest = mutation({
  args: {
    userId: v.id("users"),
    testId: v.string(),
    sessionId: v.string(),
    score: v.number(),
    level: v.string(),
    skillScores: v.object({
      grammar: v.number(),
      vocabulary: v.number(),
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
      speaking: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!progress) {
      throw new Error("Progress record not found for user");
    }

    const newTestHistory = [
      ...progress.testHistory,
      {
        testId: args.testId,
        sessionId: args.sessionId,
        score: args.score,
        date: Date.now(),
        level: args.level,
      },
    ];

    const newOverallScore = (progress.overallScore * progress.totalSessions + args.score) / (progress.totalSessions + 1);

    await ctx.db.patch(progress._id, {
      currentLevel: args.level,
      overallScore: newOverallScore,
      totalSessions: progress.totalSessions + 1,
      lastActivity: Date.now(),
      testHistory: newTestHistory,
      skillScores: args.skillScores,
    });

    return progress._id;
  },
});
