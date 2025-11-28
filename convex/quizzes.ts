import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================================================
// QUIZ CRUD OPERATIONS
// ============================================================================

// Create a new quiz/test
export const createQuiz = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    instructions: v.optional(v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2"),
      v.literal("mixed")
    ),
    testPurpose: v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    ),
    skillFocus: v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking"),
      v.literal("mixed")
    ),
    duration: v.number(),
    passingScore: v.number(),
    settings: v.optional(v.object({
      shuffleQuestions: v.boolean(),
      shuffleOptions: v.boolean(),
      showCorrectAnswers: v.boolean(),
      showExplanations: v.boolean(),
      allowRetake: v.boolean(),
      maxAttempts: v.number(),
      requirePassingScore: v.boolean(),
      showTimer: v.boolean(),
      showProgressBar: v.optional(v.boolean()),
      allowSkip: v.optional(v.boolean()),
      allowReview: v.optional(v.boolean()),
      autoSubmitOnTimeout: v.optional(v.boolean()),
    })),
    tags: v.optional(v.array(v.string())),
    isCambridgeAligned: v.optional(v.boolean()),
    cambridgeLevel: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    )),
    // Inline questions for quiz content
    inlineQuestions: v.optional(v.array(v.object({
      id: v.string(),
      questionType: v.string(),
      questionText: v.string(),
      questionData: v.any(),
      points: v.number(),
      skill: v.string(),
      level: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    console.log("createQuiz called with args:", JSON.stringify(args, null, 2));
    const now = Date.now();

    // Validate that createdBy user has teacher or admin role
    let user = null;
    try {
      user = await ctx.db.get(args.createdBy as Id<"users">);
    } catch (e) {
      console.error("Failed to get user:", args.createdBy, e);
      // If ID is invalid, user remains null
    }

    console.log("User found:", user ? user._id : "null", "Role:", user?.role);

    if (!user) {
      throw new Error("User not found or invalid ID");
    }

    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "corporate_admin") {
      console.error("User validation failed for ID:", args.createdBy);
      throw new Error("Only teachers and admins can create tests. Your role: " + user.role);
    }

    // Default settings
    const defaultSettings = {
      shuffleQuestions: true,
      shuffleOptions: true,
      showCorrectAnswers: true,
      showExplanations: true,
      allowRetake: true,
      maxAttempts: 3,
      requirePassingScore: false,
      showTimer: true,
      showProgressBar: true,
      allowSkip: true,
      allowReview: true,
      autoSubmitOnTimeout: true,
    };

    // Calculate totals from inline questions if provided
    const totalQuestions = args.inlineQuestions?.length || 0;
    const totalPoints = args.inlineQuestions?.reduce((sum, q) => sum + q.points, 0) || 0;

    console.log("Inserting quiz...");
    try {
      // Insert quiz record
      const quizId = await ctx.db.insert("quizzes", {
        companyId: args.companyId,
        createdBy: args.createdBy,
        title: args.title,
        description: args.description,
        instructions: args.instructions,
        level: args.level,
        testPurpose: args.testPurpose,
        skillFocus: args.skillFocus,
        duration: args.duration,
        passingScore: args.passingScore,
        totalQuestions,
        totalPoints,
        status: args.status || "draft",
        isCambridgeAligned: args.isCambridgeAligned || false,
        cambridgeLevel: args.cambridgeLevel,
        settings: args.settings || defaultSettings,
        tags: args.tags || [],
        inlineQuestions: args.inlineQuestions,
        createdAt: now,
        updatedAt: now,
      });
      console.log("Quiz inserted with ID:", quizId);

      // Create audit log entry (don't fail quiz creation if audit log fails)
      try {
        await ctx.db.insert("auditLogs", {
          companyId: args.companyId,
          userId: args.createdBy,
          action: "quiz_created",
          entityType: "quiz",
          entityId: String(quizId),
          newValues: { title: args.title, level: args.level, testPurpose: args.testPurpose },
          timestamp: now,
        });
        console.log("Audit log created");
      } catch (e) {
        console.error("Failed to create audit log:", e);
      }

      return quizId;
    } catch (error) {
      console.error("Error in createQuiz:", error);
      throw error;
    }
  },
});

// Update an existing quiz/test
export const updateQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    instructions: v.optional(v.string()),
    level: v.optional(v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2"),
      v.literal("mixed")
    )),
    testPurpose: v.optional(v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    )),
    skillFocus: v.optional(v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking"),
      v.literal("mixed")
    )),
    duration: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    settings: v.optional(v.object({
      shuffleQuestions: v.boolean(),
      shuffleOptions: v.boolean(),
      showCorrectAnswers: v.boolean(),
      showExplanations: v.boolean(),
      allowRetake: v.boolean(),
      maxAttempts: v.number(),
      requirePassingScore: v.boolean(),
      showTimer: v.boolean(),
      showProgressBar: v.optional(v.boolean()),
      allowSkip: v.optional(v.boolean()),
      allowReview: v.optional(v.boolean()),
      autoSubmitOnTimeout: v.optional(v.boolean()),
    })),
    tags: v.optional(v.array(v.string())),
    isCambridgeAligned: v.optional(v.boolean()),
    // Inline questions for quiz content
    inlineQuestions: v.optional(v.array(v.object({
      id: v.string(),
      questionType: v.string(),
      questionText: v.string(),
      questionData: v.any(),
      points: v.number(),
      skill: v.string(),
      level: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate quiz exists
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Test not found");
    }

    // Check if quiz is published - allow edits to draft tests
    if (quiz.status === "published") {
      throw new Error("Cannot update a published test. Archive it first to create a new version.");
    }

    // Prepare update data
    const updateData: Record<string, unknown> = { updatedAt: now };
    if (args.title !== undefined) updateData.title = args.title;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.instructions !== undefined) updateData.instructions = args.instructions;
    if (args.level !== undefined) updateData.level = args.level;
    if (args.testPurpose !== undefined) updateData.testPurpose = args.testPurpose;
    if (args.skillFocus !== undefined) updateData.skillFocus = args.skillFocus;
    if (args.duration !== undefined) updateData.duration = args.duration;
    if (args.passingScore !== undefined) updateData.passingScore = args.passingScore;
    if (args.settings !== undefined) updateData.settings = args.settings;
    if (args.tags !== undefined) updateData.tags = args.tags;
    if (args.isCambridgeAligned !== undefined) updateData.isCambridgeAligned = args.isCambridgeAligned;
    if (args.inlineQuestions !== undefined) {
      updateData.inlineQuestions = args.inlineQuestions;
      updateData.totalQuestions = args.inlineQuestions.length;
      updateData.totalPoints = args.inlineQuestions.reduce((sum, q) => sum + q.points, 0);
    }

    // Update quiz
    await ctx.db.patch(args.quizId, updateData);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: quiz.companyId,
      userId: quiz.createdBy,
      action: "quiz_updated",
      entityType: "quiz",
      entityId: args.quizId,
      oldValues: { title: quiz.title },
      newValues: updateData,
      timestamp: now,
    });

    return { success: true };
  },
});

// Delete a quiz
export const deleteQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate quiz exists
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Check if quiz has active assignments
    const activeAssignments = await ctx.db
      .query("quizAssignments")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    if (activeAssignments.length > 0) {
      throw new Error("Cannot delete quiz with active assignments");
    }

    // Delete quiz record
    await ctx.db.delete(args.quizId);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: quiz.companyId,
      userId: quiz.createdBy,
      action: "quiz_deleted",
      entityType: "quiz",
      entityId: args.quizId,
      oldValues: { title: quiz.title },
      timestamp: now,
    });

    return { success: true };
  },
});

// Publish a quiz/test
export const publishQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate quiz exists
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Test not found");
    }

    // Validate quiz has at least one question
    if (quiz.totalQuestions === 0 && (!quiz.inlineQuestions || quiz.inlineQuestions.length === 0)) {
      throw new Error("Cannot publish test without questions");
    }

    // Update status to published
    await ctx.db.patch(args.quizId, {
      status: "published",
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: quiz.companyId,
      userId: quiz.createdBy,
      action: "quiz_published",
      entityType: "quiz",
      entityId: args.quizId,
      timestamp: now,
    });

    return { success: true };
  },
});

// Archive a quiz/test (allows editing a new version)
export const archiveQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Test not found");
    }

    await ctx.db.patch(args.quizId, {
      status: "archived",
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: quiz.companyId,
      userId: quiz.createdBy,
      action: "quiz_archived",
      entityType: "quiz",
      entityId: args.quizId,
      timestamp: now,
    });

    return { success: true };
  },
});

// Duplicate a quiz/test (for creating new versions or variants)
export const duplicateQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    newTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Test not found");
    }

    // Create a copy with draft status
    const newQuizId = await ctx.db.insert("quizzes", {
      companyId: quiz.companyId,
      createdBy: quiz.createdBy,
      title: args.newTitle || `${quiz.title} (Copy)`,
      description: quiz.description,
      instructions: quiz.instructions,
      level: quiz.level,
      testPurpose: quiz.testPurpose,
      skillFocus: quiz.skillFocus,
      duration: quiz.duration,
      passingScore: quiz.passingScore,
      totalQuestions: quiz.totalQuestions,
      totalPoints: quiz.totalPoints,
      status: "draft",
      isCambridgeAligned: quiz.isCambridgeAligned,
      cambridgeLevel: quiz.cambridgeLevel,
      settings: quiz.settings,
      tags: quiz.tags,
      questionIds: quiz.questionIds,
      inlineQuestions: quiz.inlineQuestions,
      createdAt: now,
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: quiz.companyId,
      userId: quiz.createdBy,
      action: "quiz_duplicated",
      entityType: "quiz",
      entityId: newQuizId,
      oldValues: { originalQuizId: args.quizId },
      timestamp: now,
    });

    return newQuizId;
  },
});

// Get a single quiz by ID
export const getQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    return quiz;
  },
});

// Get all quizzes/tests for a company with optional filters
export const getCompanyQuizzes = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    level: v.optional(v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2"),
      v.literal("mixed")
    )),
    testPurpose: v.optional(v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    )),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    )),
    skillFocus: v.optional(v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking"),
      v.literal("mixed")
    )),
  },
  handler: async (ctx, args) => {
    let quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    // Apply filters
    if (args.level !== undefined) {
      quizzes = quizzes.filter((quiz) => quiz.level === args.level);
    }
    if (args.testPurpose !== undefined) {
      quizzes = quizzes.filter((quiz) => quiz.testPurpose === args.testPurpose);
    }
    if (args.status !== undefined) {
      quizzes = quizzes.filter((quiz) => quiz.status === args.status);
    }
    if (args.skillFocus !== undefined) {
      quizzes = quizzes.filter((quiz) => quiz.skillFocus === args.skillFocus);
    }

    // Sort by createdAt descending
    quizzes.sort((a, b) => b.createdAt - a.createdAt);

    return quizzes;
  },
});

// Get quizzes by level
export const getQuizzesByLevel = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
  },
  handler: async (ctx, args) => {
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .filter((q) => q.and(q.eq(q.field("companyId"), args.companyId), q.eq(q.field("status"), "published")))
      .collect();

    return quizzes;
  },
});

// Get quizzes created by a specific user
export const getQuizzesByCreator = query({
  args: {
    createdBy: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.createdBy))
      .collect();

    // Sort by createdAt descending
    quizzes.sort((a, b) => b.createdAt - a.createdAt);

    return quizzes;
  },
});

// ============================================================================
// QUESTION BANK OPERATIONS
// ============================================================================

// Add a question to the question bank
export const addQuestionToBank = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    questionType: v.union(
      // Basic types
      v.literal("multiple_choice"),
      v.literal("multiple_select"),
      v.literal("fill_in_blank"),
      v.literal("true_false"),
      // Text-based
      v.literal("short_answer"),
      v.literal("long_answer"),
      v.literal("sentence_completion"),
      v.literal("error_correction"),
      v.literal("word_formation"),
      v.literal("sentence_reorder"),
      // Matching & ordering
      v.literal("matching"),
      v.literal("ordering"),
      v.literal("categorization"),
      // Reading
      v.literal("reading_comprehension"),
      v.literal("cloze_test"),
      // Listening
      v.literal("listening"),
      v.literal("audio_transcription"),
      v.literal("audio_multiple_choice"),
      v.literal("dictation"),
      // Visual
      v.literal("image_description"),
      v.literal("image_labeling"),
      v.literal("image_sequence"),
      v.literal("video_comprehension"),
      // Speaking
      v.literal("speaking_response"),
      v.literal("pronunciation"),
      v.literal("read_aloud"),
      // Interactive
      v.literal("drag_and_drop"),
      v.literal("hotspot"),
      v.literal("conversation_completion")
    ),
    skill: v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking"),
      v.literal("pronunciation")
    ),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard")
    ),
    questionText: v.string(),
    questionData: v.object({
      options: v.optional(v.array(v.string())),
      correctAnswer: v.any(),
      explanation: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      readingPassage: v.optional(v.string()),
      hints: v.optional(v.array(v.string())),
      caseSensitive: v.optional(v.boolean()),
    }),
    points: v.number(),
    timeLimit: v.optional(v.number()),
    tags: v.array(v.string()),
    isCambridgeAligned: v.boolean(),
    cambridgeReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Insert question into questionBank table
    const questionId = await ctx.db.insert("questionBank", {
      companyId: args.companyId,
      createdBy: args.createdBy,
      questionType: args.questionType,
      skill: args.skill,
      level: args.level,
      difficulty: args.difficulty,
      questionText: args.questionText,
      questionData: args.questionData,
      points: args.points,
      timeLimit: args.timeLimit,
      tags: args.tags,
      usageCount: 0,
      averageScore: 0,
      isActive: true,
      isCambridgeAligned: args.isCambridgeAligned,
      cambridgeReference: args.cambridgeReference,
      createdAt: now,
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.createdBy,
      action: "question_created",
      entityType: "question",
      entityId: questionId,
      newValues: { questionText: args.questionText, skill: args.skill, level: args.level },
      timestamp: now,
    });

    return questionId;
  },
});

// Update a question
export const updateQuestion = mutation({
  args: {
    questionId: v.id("questionBank"),
    questionText: v.optional(v.string()),
    questionData: v.optional(v.object({
      options: v.optional(v.array(v.string())),
      correctAnswer: v.any(),
      explanation: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      readingPassage: v.optional(v.string()),
      hints: v.optional(v.array(v.string())),
      caseSensitive: v.optional(v.boolean()),
    })),
    difficulty: v.optional(v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard")
    )),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate question exists
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    // Prepare update data
    const updateData: any = { updatedAt: now };
    if (args.questionText !== undefined) updateData.questionText = args.questionText;
    if (args.questionData !== undefined) updateData.questionData = args.questionData;
    if (args.difficulty !== undefined) updateData.difficulty = args.difficulty;
    if (args.tags !== undefined) updateData.tags = args.tags;

    // Update question
    await ctx.db.patch(args.questionId, updateData);

    return { success: true };
  },
});

// Delete a question (soft delete)
export const deleteQuestion = mutation({
  args: {
    questionId: v.id("questionBank"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate question exists
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    // Set isActive to false (soft delete)
    await ctx.db.patch(args.questionId, {
      isActive: false,
      updatedAt: now,
    });

    return { success: true };
  },
});

// Get questions by filters
export const getQuestionsByFilters = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    skill: v.optional(v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking")
    )),
    level: v.optional(v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    )),
    questionType: v.optional(v.union(
      v.literal("multiple_choice"),
      v.literal("fill_in_blank"),
      v.literal("true_false"),
      v.literal("listening"),
      v.literal("reading_comprehension")
    )),
    difficulty: v.optional(v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard")
    )),
  },
  handler: async (ctx, args) => {
    let questions = await ctx.db
      .query("questionBank")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Apply filters
    if (args.skill !== undefined) {
      questions = questions.filter((q) => q.skill === args.skill);
    }
    if (args.level !== undefined) {
      questions = questions.filter((q) => q.level === args.level);
    }
    if (args.questionType !== undefined) {
      questions = questions.filter((q) => q.questionType === args.questionType);
    }
    if (args.difficulty !== undefined) {
      questions = questions.filter((q) => q.difficulty === args.difficulty);
    }

    // Sort by usageCount descending
    questions.sort((a, b) => b.usageCount - a.usageCount);

    return questions;
  },
});

// Add questions to a quiz
export const addQuestionsToQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    questionIds: v.array(v.id("questionBank")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate quiz exists and is not published
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    if (quiz.status === "published") {
      throw new Error("Cannot add questions to a published quiz");
    }

    let totalPoints = quiz.totalPoints;
    let totalQuestions = quiz.totalQuestions;

    // For each questionId, increment usageCount
    for (const questionId of args.questionIds) {
      const question = await ctx.db.get(questionId);
      if (question) {
        // Increment usageCount
        await ctx.db.patch(questionId, {
          usageCount: question.usageCount + 1,
          updatedAt: now,
        });

        // Update totals
        totalPoints += question.points;
        totalQuestions += 1;
      }
    }

    // Update quiz's totalQuestions, totalPoints, and questionIds
    const existingQuestionIds = quiz.questionIds || [];
    const newQuestionIds = [...existingQuestionIds, ...args.questionIds];

    await ctx.db.patch(args.quizId, {
      totalQuestions,
      totalPoints,
      questionIds: newQuestionIds,
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: quiz.companyId,
      userId: quiz.createdBy,
      action: "questions_added_to_quiz",
      entityType: "quiz",
      entityId: args.quizId,
      newValues: { questionsAdded: args.questionIds.length, totalQuestions },
      timestamp: now,
    });

    return { success: true, totalQuestions, totalPoints };
  },
});

// Remove a question from a quiz
export const removeQuestionFromQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    questionId: v.id("questionBank"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate quiz is not published
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    if (quiz.status === "published") {
      throw new Error("Cannot remove questions from a published quiz");
    }

    // Get question to get points
    const question = await ctx.db.get(args.questionId);
    if (question && question.usageCount > 0) {
      // Decrement usageCount
      await ctx.db.patch(args.questionId, {
        usageCount: question.usageCount - 1,
        updatedAt: now,
      });

      // Remove question from questionIds array and update totals
      const updatedQuestionIds = (quiz.questionIds || []).filter(
        (id) => id !== args.questionId
      );

      await ctx.db.patch(args.quizId, {
        totalQuestions: quiz.totalQuestions - 1,
        totalPoints: quiz.totalPoints - question.points,
        questionIds: updatedQuestionIds,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// ============================================================================
// QUIZ ASSIGNMENT OPERATIONS
// ============================================================================

// Create a quiz assignment
export const createQuizAssignment = mutation({
  args: {
    quizId: v.id("quizzes"),
    companyId: v.union(v.id("companies"), v.string()),
    assignedBy: v.union(v.id("users"), v.string()),
    assignmentType: v.union(
      v.literal("individual"),
      v.literal("group"),
      v.literal("company_wide")
    ),
    assignedTo: v.array(v.string()),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate quiz is published
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    if (quiz.status !== "published") {
      throw new Error("Can only assign published quizzes");
    }

    // Insert assignment
    const assignmentId = await ctx.db.insert("quizAssignments", {
      quizId: args.quizId,
      companyId: args.companyId,
      assignedBy: args.assignedBy,
      assignmentType: args.assignmentType,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      startDate: args.startDate,
      status: "active",
      notificationSent: false,
      completionCount: 0,
      averageScore: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create notifications for assigned users
    for (const userId of args.assignedTo) {
      await ctx.db.insert("notifications", {
        userId,
        companyId: args.companyId,
        title: "New Quiz Assignment",
        message: `You have been assigned the quiz: ${quiz.title}`,
        type: "info",
        isEmailSent: false,
        relatedEntityId: assignmentId,
        relatedEntityType: "quizAssignment",
        isRead: false,
        createdAt: now,
      });
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.assignedBy,
      action: "quiz_assigned",
      entityType: "quizAssignment",
      entityId: assignmentId,
      newValues: { quizId: args.quizId, assignedTo: args.assignedTo.length },
      timestamp: now,
    });

    return assignmentId;
  },
});

// Update a quiz assignment
export const updateQuizAssignment = mutation({
  args: {
    assignmentId: v.id("quizAssignments"),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired")
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate assignment exists
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Prepare update data
    const updateData: any = { updatedAt: now };
    if (args.dueDate !== undefined) updateData.dueDate = args.dueDate;
    if (args.startDate !== undefined) updateData.startDate = args.startDate;
    if (args.status !== undefined) updateData.status = args.status;

    // Update assignment
    await ctx.db.patch(args.assignmentId, updateData);

    // If status changed to 'expired', create notifications
    if (args.status === "expired") {
      for (const userId of assignment.assignedTo) {
        await ctx.db.insert("notifications", {
          userId,
          companyId: assignment.companyId,
          title: "Quiz Assignment Expired",
          message: `The quiz assignment has expired`,
          type: "warning",
          isEmailSent: false,
          relatedEntityId: args.assignmentId,
          relatedEntityType: "quizAssignment",
          isRead: false,
          createdAt: now,
        });
      }
    }

    return { success: true };
  },
});

// Delete a quiz assignment
export const deleteQuizAssignment = mutation({
  args: {
    assignmentId: v.id("quizAssignments"),
  },
  handler: async (ctx, args) => {
    // Validate assignment exists
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Check if any test sessions exist for this assignment
    const sessions = await ctx.db
      .query("testSessions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();

    if (sessions.length > 0) {
      // Mark as cancelled instead of deleting
      await ctx.db.patch(args.assignmentId, {
        status: "expired",
        updatedAt: Date.now(),
      });
      return { success: true, message: "Assignment marked as expired due to existing test sessions" };
    }

    // Delete assignment
    await ctx.db.delete(args.assignmentId);

    return { success: true, message: "Assignment deleted successfully" };
  },
});

// Get quiz assignments with filters
export const getQuizAssignments = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired")
    )),
    quizId: v.optional(v.id("quizzes")),
  },
  handler: async (ctx, args) => {
    let assignments = await ctx.db
      .query("quizAssignments")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    // Apply filters
    if (args.status !== undefined) {
      assignments = assignments.filter((a) => a.status === args.status);
    }
    if (args.quizId !== undefined) {
      assignments = assignments.filter((a) => a.quizId === args.quizId);
    }

    // Sort by createdAt descending
    assignments.sort((a, b) => b.createdAt - a.createdAt);

    return assignments;
  },
});

// Get assignments for a specific user
export const getUserAssignments = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const allAssignments = await ctx.db
      .query("quizAssignments")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Filter by userId in assignedTo array (can't be done in Convex filter)
    const assignments = allAssignments.filter(
      (a) => a.assignedTo.includes(args.userId)
    );

    // Sort by dueDate ascending (soonest first)
    assignments.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    });

    return assignments;
  },
});

// Update assignment progress after a test session is completed
export const updateAssignmentProgress = mutation({
  args: {
    assignmentId: v.id("quizAssignments"),
    sessionId: v.id("testSessions"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate assignment exists
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Increment completionCount
    const newCompletionCount = assignment.completionCount + 1;

    // Recalculate averageScore
    const newAverageScore =
      (assignment.averageScore * assignment.completionCount + args.score) / newCompletionCount;

    // Update assignment
    await ctx.db.patch(args.assignmentId, {
      completionCount: newCompletionCount,
      averageScore: newAverageScore,
      updatedAt: now,
    });

    return { success: true, averageScore: newAverageScore };
  },
});

// ============================================================================
// CAMBRIDGE INTEGRATION
// ============================================================================

// Generate a Cambridge-aligned quiz
export const generateCambridgeAlignedQuiz = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
    questionCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Query questionBank for Cambridge-aligned questions matching level
    const questions = await ctx.db
      .query("questionBank")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .filter((q) =>
        q.and(
          q.eq(q.field("companyId"), args.companyId),
          q.eq(q.field("isCambridgeAligned"), true),
          q.eq(q.field("isActive"), true)
        )
      )
      .take(args.questionCount);

    if (questions.length < args.questionCount) {
      throw new Error(`Not enough Cambridge-aligned questions for level ${args.level}. Found ${questions.length}, needed ${args.questionCount}`);
    }

    // Calculate total points
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    // Create new quiz
    const quizId = await ctx.db.insert("quizzes", {
      companyId: args.companyId,
      createdBy: args.createdBy,
      title: `Cambridge ${args.level} Practice Test`,
      description: `Auto-generated Cambridge-aligned practice test for ${args.level} level`,
      level: args.level,
      testPurpose: "practice",
      skillFocus: "mixed",
      duration: args.questionCount * 2, // 2 minutes per question
      passingScore: 60,
      totalQuestions: questions.length,
      totalPoints: totalPoints,
      status: "draft",
      isCambridgeAligned: true,
      cambridgeLevel: args.level,
      settings: {
        shuffleQuestions: true,
        shuffleOptions: true,
        showCorrectAnswers: true,
        showExplanations: true,
        allowRetake: true,
        maxAttempts: 3,
        requirePassingScore: false,
        showTimer: true,
      },
      tags: ["cambridge", "auto-generated", args.level],
      createdAt: now,
      updatedAt: now,
    });

    // Increment usage count for all selected questions
    for (const question of questions) {
      await ctx.db.patch(question._id, {
        usageCount: question.usageCount + 1,
        updatedAt: now,
      });
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.createdBy,
      action: "cambridge_quiz_generated",
      entityType: "quiz",
      entityId: quizId,
      newValues: { level: args.level, questionCount: questions.length },
      timestamp: now,
    });

    return {
      quizId,
      questionList: questions.map(q => ({
        id: q._id,
        text: q.questionText,
        type: q.questionType,
        points: q.points,
      })),
    };
  },
});
