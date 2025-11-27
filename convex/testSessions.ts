import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getTestSession = query({
  args: { sessionId: v.id("testSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session;
  },
});

export const getUserTestSessions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("testSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return sessions;
  },
});

export const getCompanyTestSessions = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    return sessions;
  },
});

export const createTestSession = mutation({
  args: {
    testId: v.string(),
    userId: v.id("users"),
    companyId: v.id("companies"),
    status: v.string(),
    startedAt: v.number(),
    totalQuestions: v.number(),
    questionsAnswered: v.number(),
    quizId: v.optional(v.id("quizzes")),
    assignmentId: v.optional(v.id("quizAssignments")),
    attemptNumber: v.optional(v.number()),
    customQuestions: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      question: v.string(),
      options: v.optional(v.array(v.string())),
      correctAnswer: v.string(),
      skill: v.optional(v.string()),
      level: v.optional(v.string()),
      audioUrl: v.optional(v.union(v.string(), v.null())),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let questions = args.customQuestions;

    // If quizId is provided, fetch quiz questions from the question bank
    if (args.quizId) {
      const quiz = await ctx.db.get(args.quizId);
      if (!quiz) {
        throw new Error("Quiz not found");
      }

      // Fetch questions from the question bank using stored questionIds
      if (quiz.questionIds && quiz.questionIds.length > 0 && !questions) {
        const fetchedQuestions = await Promise.all(
          quiz.questionIds.map((questionId) => ctx.db.get(questionId))
        );

        questions = fetchedQuestions
          .filter((q): q is NonNullable<typeof q> => q !== null)
          .map((q) => ({
            id: q._id,
            type: q.questionType,
            question: q.questionText,
            options: q.questionData.options,
            correctAnswer: String(q.questionData.correctAnswer),
            skill: q.skill,
            level: q.level,
            audioUrl: q.questionData.audioUrl ?? null,
          }));
      } else if (!questions) {
        questions = [];
      }
    }

    const sessionId = await ctx.db.insert("testSessions", {
      testId: args.testId,
      quizId: args.quizId,
      assignmentId: args.assignmentId,
      userId: args.userId,
      companyId: args.companyId,
      status: args.status as "created" | "in_progress" | "completed" | "abandoned",
      startedAt: args.startedAt,
      totalQuestions: args.totalQuestions,
      questionsAnswered: args.questionsAnswered,
      attemptNumber: args.attemptNumber || 1,
      customQuestions: questions,
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

export const updateTestSession = mutation({
  args: {
    sessionId: v.id("testSessions"),
    answers: v.optional(v.array(v.object({
      questionId: v.string(),
      answer: v.string(),
      isCorrect: v.boolean(),
      timeSpent: v.number(),
    }))),
    questionsAnswered: v.optional(v.number()),
    status: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    totalScore: v.optional(v.number()),
    percentageScore: v.optional(v.number()),
    recommendedLevel: v.optional(v.string()),
    skillScores: v.optional(v.object({
      grammar: v.number(),
      vocabulary: v.number(),
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
      speaking: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...updates } = args;

    const updateData: any = {};
    if (updates.answers !== undefined) updateData.answers = updates.answers;
    if (updates.questionsAnswered !== undefined) updateData.questionsAnswered = updates.questionsAnswered;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt;
    if (updates.totalScore !== undefined) updateData.totalScore = updates.totalScore;
    if (updates.percentageScore !== undefined) updateData.percentageScore = updates.percentageScore;
    if (updates.recommendedLevel !== undefined) updateData.recommendedLevel = updates.recommendedLevel;
    if (updates.skillScores !== undefined) updateData.skillScores = updates.skillScores;

    await ctx.db.patch(sessionId, updateData);
    return sessionId;
  },
});

export const abandonTestSession = mutation({
  args: { sessionId: v.id("testSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "abandoned",
      completedAt: Date.now(),
    });
    return args.sessionId;
  },
});
