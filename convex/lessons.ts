import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ==========================================
// SCHEDULED LESSONS - Real-time lessons with teachers
// ==========================================

// Create a scheduled lesson
export const createScheduledLesson = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    teacherId: v.optional(v.union(v.id("users"), v.string())),
    groupId: v.optional(v.id("groups")),
    title: v.string(),
    description: v.optional(v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
    scheduledDate: v.number(),
    duration: v.number(),
    timezone: v.string(),
    locationType: v.union(
      v.literal("online"),
      v.literal("office"),
      v.literal("company")
    ),
    locationDetails: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    topic: v.string(),
    objectives: v.array(v.string()),
    materials: v.optional(v.array(v.string())),
    assignedStudentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const lessonId = await ctx.db.insert("scheduledLessons", {
      companyId: args.companyId,
      createdBy: args.createdBy,
      teacherId: args.teacherId,
      groupId: args.groupId,
      title: args.title,
      description: args.description,
      level: args.level,
      scheduledDate: args.scheduledDate,
      duration: args.duration,
      timezone: args.timezone,
      locationType: args.locationType,
      locationDetails: args.locationDetails,
      meetingLink: args.meetingLink,
      topic: args.topic,
      objectives: args.objectives,
      materials: args.materials,
      assignedStudentIds: args.assignedStudentIds,
      status: "scheduled",
      reminderSent: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create attendance records for assigned students
    for (const studentId of args.assignedStudentIds) {
      await ctx.db.insert("lessonAttendance", {
        scheduledLessonId: lessonId,
        userId: studentId,
        companyId: args.companyId,
        status: "registered",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.createdBy,
      action: "scheduled_lesson_created",
      entityType: "scheduledLesson",
      entityId: lessonId,
      timestamp: now,
    });

    return lessonId;
  },
});

// Update scheduled lesson
export const updateScheduledLesson = mutation({
  args: {
    lessonId: v.id("scheduledLessons"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    duration: v.optional(v.number()),
    timezone: v.optional(v.string()),
    level: v.optional(v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    )),
    teacherId: v.optional(v.union(v.id("users"), v.string())),
    locationType: v.optional(v.union(
      v.literal("online"),
      v.literal("office"),
      v.literal("company")
    )),
    locationDetails: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    topic: v.optional(v.string()),
    objectives: v.optional(v.array(v.string())),
    materials: v.optional(v.array(v.string())),
    assignedStudentIds: v.optional(v.array(v.string())),
    status: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const { lessonId, ...updates } = args;
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(lessonId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });

    return lessonId;
  },
});

// Delete scheduled lesson
export const deleteScheduledLesson = mutation({
  args: {
    lessonId: v.id("scheduledLessons"),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    // Delete related attendance records
    const attendanceRecords = await ctx.db
      .query("lessonAttendance")
      .withIndex("by_lesson", (q) => q.eq("scheduledLessonId", args.lessonId))
      .collect();

    for (const record of attendanceRecords) {
      await ctx.db.delete(record._id);
    }

    // Delete the lesson
    await ctx.db.delete(args.lessonId);

    // Audit log
    await ctx.db.insert("auditLogs", {
      companyId: lesson.companyId,
      userId: lesson.createdBy,
      action: "scheduled_lesson_deleted",
      entityType: "scheduledLesson",
      entityId: args.lessonId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Add transcript to lesson
export const addTranscript = mutation({
  args: {
    lessonId: v.id("scheduledLessons"),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.lessonId, {
      transcript: args.transcript,
      transcriptAddedAt: now,
      updatedAt: now,
    });
    return args.lessonId;
  },
});

// Get scheduled lessons for company
export const getCompanyScheduledLessons = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    status: v.optional(v.string()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let lessons = await ctx.db
      .query("scheduledLessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.status) {
      lessons = lessons.filter((l) => l.status === args.status);
    }
    if (args.fromDate) {
      lessons = lessons.filter((l) => l.scheduledDate >= args.fromDate!);
    }
    if (args.toDate) {
      lessons = lessons.filter((l) => l.scheduledDate <= args.toDate!);
    }

    return lessons.sort((a, b) => a.scheduledDate - b.scheduledDate);
  },
});

// Get lessons for a specific teacher
export const getTeacherScheduledLessons = query({
  args: {
    teacherId: v.union(v.id("users"), v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let lessons = await ctx.db
      .query("scheduledLessons")
      .withIndex("by_teacher", (q) => q.eq("createdBy", args.teacherId))
      .collect();

    if (args.status) {
      lessons = lessons.filter((l) => l.status === args.status);
    }

    return lessons.sort((a, b) => a.scheduledDate - b.scheduledDate);
  },
});

// Get lessons for a student
export const getStudentScheduledLessons = query({
  args: {
    studentId: v.string(),
    companyId: v.union(v.id("companies"), v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("scheduledLessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    let studentLessons = lessons.filter((l) =>
      l.assignedStudentIds.includes(args.studentId)
    );

    if (args.status) {
      studentLessons = studentLessons.filter((l) => l.status === args.status);
    }

    return studentLessons.sort((a, b) => a.scheduledDate - b.scheduledDate);
  },
});

// Get single scheduled lesson
export const getScheduledLesson = query({
  args: {
    lessonId: v.id("scheduledLessons"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

// ==========================================
// VIRTUAL LESSONS - AI-generated content
// ==========================================

// Create virtual lesson
export const createVirtualLesson = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    scheduledLessonId: v.optional(v.id("scheduledLessons")),
    title: v.string(),
    description: v.optional(v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
    topic: v.string(),
    language: v.optional(v.union(v.literal("english"), v.literal("german"))),
    explanationLanguage: v.optional(v.union(v.literal("english"), v.literal("german"))),
    sections: v.array(v.object({
      id: v.string(),
      type: v.union(
        v.literal("introduction"),
        v.literal("vocabulary"),
        v.literal("listening"),
        v.literal("comprehension"),
        v.literal("grammar"),
        v.literal("expressions"),
        v.literal("exercise"),
        v.literal("speaking"),
        v.literal("cultural"),
        v.literal("summary"),
        v.literal("homework"),
        v.literal("reading")
      ),
      title: v.string(),
      content: v.string(),
      audioScript: v.optional(v.string()),
      audioId: v.optional(v.id("audioContent")),
      audioUrl: v.optional(v.string()),
      imagePrompt: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      visualContent: v.optional(v.string()),
      order: v.number(),
    })),
    vocabulary: v.array(v.object({
      word: v.string(),
      definition: v.string(),
      example: v.string(),
      pronunciation: v.optional(v.string()),
      audioId: v.optional(v.id("audioContent")),
      partOfSpeech: v.optional(v.string()),
    })),
    grammarPoints: v.array(v.object({
      title: v.string(),
      explanation: v.string(),
      examples: v.array(v.string()),
      exercises: v.optional(v.array(v.object({
        question: v.string(),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
      }))),
    })),
    estimatedDuration: v.number(),
    objectives: v.array(v.string()),
    tags: v.array(v.string()),
    generatedWithModel: v.optional(v.string()),
    sourceTranscript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const lessonId = await ctx.db.insert("virtualLessons", {
      companyId: args.companyId,
      createdBy: args.createdBy,
      scheduledLessonId: args.scheduledLessonId,
      title: args.title,
      description: args.description,
      level: args.level,
      topic: args.topic,
      language: args.language || "english",
      explanationLanguage: args.explanationLanguage || "english",
      sections: args.sections,
      vocabulary: args.vocabulary,
      grammarPoints: args.grammarPoints,
      estimatedDuration: args.estimatedDuration,
      objectives: args.objectives,
      tags: args.tags,
      generatedWithModel: args.generatedWithModel,
      sourceTranscript: args.sourceTranscript,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });

    // Link to scheduled lesson if applicable
    if (args.scheduledLessonId) {
      await ctx.db.patch(args.scheduledLessonId, {
        virtualLessonId: lessonId,
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.createdBy,
      action: "virtual_lesson_created",
      entityType: "virtualLesson",
      entityId: lessonId,
      timestamp: now,
    });

    return lessonId;
  },
});

// Update virtual lesson
export const updateVirtualLesson = mutation({
  args: {
    lessonId: v.id("virtualLessons"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    sections: v.optional(v.array(v.object({
      id: v.string(),
      type: v.union(
        v.literal("introduction"),
        v.literal("vocabulary"),
        v.literal("listening"),
        v.literal("comprehension"),
        v.literal("grammar"),
        v.literal("expressions"),
        v.literal("exercise"),
        v.literal("speaking"),
        v.literal("cultural"),
        v.literal("summary"),
        v.literal("homework"),
        v.literal("reading")
      ),
      title: v.string(),
      content: v.string(),
      audioScript: v.optional(v.string()),
      audioId: v.optional(v.id("audioContent")),
      audioUrl: v.optional(v.string()),
      imagePrompt: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      visualContent: v.optional(v.string()),
      order: v.number(),
    }))),
    vocabulary: v.optional(v.array(v.object({
      word: v.string(),
      definition: v.string(),
      example: v.string(),
      pronunciation: v.optional(v.string()),
      audioId: v.optional(v.id("audioContent")),
      partOfSpeech: v.optional(v.string()),
    }))),
    grammarPoints: v.optional(v.array(v.object({
      title: v.string(),
      explanation: v.string(),
      examples: v.array(v.string()),
      exercises: v.optional(v.array(v.object({
        question: v.string(),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
      }))),
    }))),
    estimatedDuration: v.optional(v.number()),
    objectives: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { lessonId, ...updates } = args;
    const now = Date.now();

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Handle publishing
    if (args.isPublished === true) {
      (filteredUpdates as any).publishedAt = now;
    }

    await ctx.db.patch(lessonId, {
      ...filteredUpdates,
      updatedAt: now,
    });

    return lessonId;
  },
});

// Publish virtual lesson
export const publishVirtualLesson = mutation({
  args: {
    lessonId: v.id("virtualLessons"),
    assignedGroups: v.optional(v.array(v.id("groups"))),
    assignedStudentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.lessonId, {
      isPublished: true,
      publishedAt: now,
      assignedGroups: args.assignedGroups,
      assignedStudentIds: args.assignedStudentIds,
      updatedAt: now,
    });

    return args.lessonId;
  },
});

// Delete virtual lesson
export const deleteVirtualLesson = mutation({
  args: {
    lessonId: v.id("virtualLessons"),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    // Delete related lesson progress records
    const progressRecords = await ctx.db
      .query("lessonProgress")
      .withIndex("by_lesson", (q) => q.eq("virtualLessonId", args.lessonId))
      .collect();

    for (const record of progressRecords) {
      await ctx.db.delete(record._id);
    }

    // Delete related materials
    const materials = await ctx.db
      .query("lessonMaterials")
      .withIndex("by_virtual_lesson", (q) => q.eq("virtualLessonId", args.lessonId))
      .collect();

    for (const material of materials) {
      await ctx.db.delete(material._id);
    }

    // Delete the lesson
    await ctx.db.delete(args.lessonId);

    // Audit log
    await ctx.db.insert("auditLogs", {
      companyId: lesson.companyId,
      userId: lesson.createdBy,
      action: "virtual_lesson_deleted",
      entityType: "virtualLesson",
      entityId: args.lessonId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Get company virtual lessons
export const getCompanyVirtualLessons = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    level: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let lessons = await ctx.db
      .query("virtualLessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.level) {
      lessons = lessons.filter((l) => l.level === args.level);
    }
    if (args.isPublished !== undefined) {
      lessons = lessons.filter((l) => l.isPublished === args.isPublished);
    }

    return lessons.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get virtual lessons for student
export const getStudentVirtualLessons = query({
  args: {
    studentId: v.string(),
    companyId: v.union(v.id("companies"), v.string()),
    groupIds: v.optional(v.array(v.id("groups"))),
  },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("virtualLessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    // Filter by assigned students or groups
    const studentLessons = lessons.filter((l) => {
      const assignedToStudent = l.assignedStudentIds?.includes(args.studentId);
      const assignedToGroup = args.groupIds?.some((gId) =>
        l.assignedGroups?.includes(gId)
      );
      return assignedToStudent || assignedToGroup || (!l.assignedStudentIds && !l.assignedGroups);
    });

    return studentLessons.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single virtual lesson
export const getVirtualLesson = query({
  args: {
    lessonId: v.id("virtualLessons"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

// ==========================================
// LESSON TESTS
// ==========================================

// Create lesson test
export const createLessonTest = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    virtualLessonId: v.id("virtualLessons"),
    createdBy: v.union(v.id("users"), v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    questions: v.array(v.object({
      id: v.string(),
      type: v.union(
        v.literal("multiple_choice"),
        v.literal("fill_in_blank"),
        v.literal("true_false"),
        v.literal("matching"),
        v.literal("ordering"),
        v.literal("listening")
      ),
      questionText: v.string(),
      options: v.optional(v.array(v.string())),
      correctAnswer: v.any(),
      explanation: v.optional(v.string()),
      points: v.number(),
      skill: v.union(
        v.literal("vocabulary"),
        v.literal("grammar"),
        v.literal("reading"),
        v.literal("listening"),
        v.literal("comprehension")
      ),
    })),
    passingScore: v.number(),
    timeLimit: v.optional(v.number()),
    shuffleQuestions: v.boolean(),
    showCorrectAnswers: v.boolean(),
    allowRetake: v.boolean(),
    maxAttempts: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const totalPoints = args.questions.reduce((sum, q) => sum + q.points, 0);

    const testId = await ctx.db.insert("lessonTests", {
      companyId: args.companyId,
      virtualLessonId: args.virtualLessonId,
      createdBy: args.createdBy,
      title: args.title,
      description: args.description,
      questions: args.questions,
      passingScore: args.passingScore,
      timeLimit: args.timeLimit,
      shuffleQuestions: args.shuffleQuestions,
      showCorrectAnswers: args.showCorrectAnswers,
      allowRetake: args.allowRetake,
      maxAttempts: args.maxAttempts,
      totalPoints,
      totalQuestions: args.questions.length,
      createdAt: now,
      updatedAt: now,
    });

    // Link test to virtual lesson
    await ctx.db.patch(args.virtualLessonId, {
      testId,
      updatedAt: now,
    });

    return testId;
  },
});

// Get lesson test
export const getLessonTest = query({
  args: {
    testId: v.id("lessonTests"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testId);
  },
});

// Get test by virtual lesson
export const getTestByVirtualLesson = query({
  args: {
    virtualLessonId: v.id("virtualLessons"),
  },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("lessonTests")
      .withIndex("by_lesson", (q) => q.eq("virtualLessonId", args.virtualLessonId))
      .collect();
    return tests[0] || null;
  },
});

// ==========================================
// LESSON TEST SESSIONS (Student attempts)
// ==========================================

// Start test session
export const startTestSession = mutation({
  args: {
    testId: v.id("lessonTests"),
    virtualLessonId: v.id("virtualLessons"),
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check existing attempts
    const existingAttempts = await ctx.db
      .query("lessonTestSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("testId"), args.testId))
      .collect();

    const test = await ctx.db.get(args.testId);
    if (!test) throw new Error("Test not found");

    if (!test.allowRetake && existingAttempts.some((a) => a.status === "completed")) {
      throw new Error("Retakes not allowed for this test");
    }

    if (existingAttempts.filter((a) => a.status === "completed").length >= test.maxAttempts) {
      throw new Error("Maximum attempts reached");
    }

    const sessionId = await ctx.db.insert("lessonTestSessions", {
      testId: args.testId,
      virtualLessonId: args.virtualLessonId,
      userId: args.userId,
      companyId: args.companyId,
      status: "in_progress",
      startedAt: now,
      answers: [],
      totalScore: 0,
      maxScore: test.totalPoints,
      percentageScore: 0,
      passed: false,
      attemptNumber: existingAttempts.length + 1,
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

// Submit answer
export const submitTestAnswer = mutation({
  args: {
    sessionId: v.id("lessonTestSessions"),
    questionId: v.string(),
    answer: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "in_progress") throw new Error("Test not in progress");

    const test = await ctx.db.get(session.testId);
    if (!test) throw new Error("Test not found");

    const question = test.questions.find((q) => q.id === args.questionId);
    if (!question) throw new Error("Question not found");

    // Check if correct
    const isCorrect = JSON.stringify(args.answer) === JSON.stringify(question.correctAnswer);
    const pointsEarned = isCorrect ? question.points : 0;

    // Update or add answer
    const existingAnswerIndex = session.answers.findIndex(
      (a) => a.questionId === args.questionId
    );

    const newAnswers = [...session.answers];
    if (existingAnswerIndex >= 0) {
      newAnswers[existingAnswerIndex] = {
        questionId: args.questionId,
        answer: args.answer,
        isCorrect,
        pointsEarned,
      };
    } else {
      newAnswers.push({
        questionId: args.questionId,
        answer: args.answer,
        isCorrect,
        pointsEarned,
      });
    }

    await ctx.db.patch(args.sessionId, {
      answers: newAnswers,
      updatedAt: Date.now(),
    });

    return { isCorrect, pointsEarned };
  },
});

// Complete test session
export const completeTestSession = mutation({
  args: {
    sessionId: v.id("lessonTestSessions"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const test = await ctx.db.get(session.testId);
    if (!test) throw new Error("Test not found");

    // Calculate scores
    const totalScore = session.answers.reduce((sum, a) => sum + a.pointsEarned, 0);
    const percentageScore = (totalScore / session.maxScore) * 100;
    const passed = percentageScore >= test.passingScore;

    // Calculate skill breakdown
    const skillScores: Record<string, { earned: number; max: number }> = {
      vocabulary: { earned: 0, max: 0 },
      grammar: { earned: 0, max: 0 },
      reading: { earned: 0, max: 0 },
      listening: { earned: 0, max: 0 },
      comprehension: { earned: 0, max: 0 },
    };

    for (const question of test.questions) {
      skillScores[question.skill].max += question.points;
      const answer = session.answers.find((a) => a.questionId === question.id);
      if (answer) {
        skillScores[question.skill].earned += answer.pointsEarned;
      }
    }

    const skillBreakdown = {
      vocabulary: skillScores.vocabulary.max > 0
        ? (skillScores.vocabulary.earned / skillScores.vocabulary.max) * 100 : 0,
      grammar: skillScores.grammar.max > 0
        ? (skillScores.grammar.earned / skillScores.grammar.max) * 100 : 0,
      reading: skillScores.reading.max > 0
        ? (skillScores.reading.earned / skillScores.reading.max) * 100 : 0,
      listening: skillScores.listening.max > 0
        ? (skillScores.listening.earned / skillScores.listening.max) * 100 : 0,
      comprehension: skillScores.comprehension.max > 0
        ? (skillScores.comprehension.earned / skillScores.comprehension.max) * 100 : 0,
    };

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: now,
      totalScore,
      percentageScore,
      passed,
      skillBreakdown,
      updatedAt: now,
    });

    // Update lesson progress
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .filter((q) => q.eq(q.field("virtualLessonId"), session.virtualLessonId))
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        testSessionId: args.sessionId,
        testPassed: passed,
        testScore: percentageScore,
        updatedAt: now,
      });
    }

    return { totalScore, percentageScore, passed, skillBreakdown };
  },
});

// Get test sessions for user
export const getUserTestSessions = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    virtualLessonId: v.optional(v.id("virtualLessons")),
  },
  handler: async (ctx, args) => {
    let sessions = await ctx.db
      .query("lessonTestSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (args.virtualLessonId) {
      sessions = sessions.filter((s) => s.virtualLessonId === args.virtualLessonId);
    }

    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ==========================================
// LESSON PROGRESS
// ==========================================

// Start or get lesson progress
export const startLessonProgress = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    virtualLessonId: v.id("virtualLessons"),
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing progress
    const existing = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("virtualLessonId"), args.virtualLessonId))
      .first();

    if (existing) {
      return existing._id;
    }

    const progressId = await ctx.db.insert("lessonProgress", {
      userId: args.userId,
      virtualLessonId: args.virtualLessonId,
      companyId: args.companyId,
      status: "in_progress",
      startedAt: now,
      completedSections: [],
      masteredVocabulary: [],
      reviewVocabulary: [],
      totalTimeSpent: 0,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return progressId;
  },
});

// Update lesson progress
export const updateLessonProgress = mutation({
  args: {
    progressId: v.id("lessonProgress"),
    currentSectionId: v.optional(v.string()),
    completedSectionId: v.optional(v.string()),
    masteredWord: v.optional(v.string()),
    reviewWord: v.optional(v.string()),
    timeSpent: v.optional(v.number()),
    studentNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const progress = await ctx.db.get(args.progressId);
    if (!progress) throw new Error("Progress not found");

    const updates: any = {
      lastActivityAt: now,
      updatedAt: now,
    };

    if (args.currentSectionId) {
      updates.currentSectionId = args.currentSectionId;
    }

    if (args.completedSectionId && !progress.completedSections.includes(args.completedSectionId)) {
      updates.completedSections = [...progress.completedSections, args.completedSectionId];
    }

    if (args.masteredWord && !progress.masteredVocabulary.includes(args.masteredWord)) {
      updates.masteredVocabulary = [...progress.masteredVocabulary, args.masteredWord];
      // Remove from review if present
      updates.reviewVocabulary = progress.reviewVocabulary.filter((w) => w !== args.masteredWord);
    }

    if (args.reviewWord && !progress.reviewVocabulary.includes(args.reviewWord) && !progress.masteredVocabulary.includes(args.reviewWord)) {
      updates.reviewVocabulary = [...progress.reviewVocabulary, args.reviewWord];
    }

    if (args.timeSpent) {
      updates.totalTimeSpent = progress.totalTimeSpent + args.timeSpent;
    }

    if (args.studentNotes !== undefined) {
      updates.studentNotes = args.studentNotes;
    }

    await ctx.db.patch(args.progressId, updates);
    return args.progressId;
  },
});

// Complete lesson
export const completeLessonProgress = mutation({
  args: {
    progressId: v.id("lessonProgress"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.progressId, {
      status: "completed",
      completedAt: now,
      lastActivityAt: now,
      updatedAt: now,
    });

    return args.progressId;
  },
});

// Get user's lesson progress
export const getUserLessonProgress = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    virtualLessonId: v.optional(v.id("virtualLessons")),
  },
  handler: async (ctx, args) => {
    let progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (args.virtualLessonId) {
      progress = progress.filter((p) => p.virtualLessonId === args.virtualLessonId);
    }

    return progress;
  },
});

// Get progress for a specific lesson
export const getLessonProgressForUser = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    virtualLessonId: v.id("virtualLessons"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("virtualLessonId"), args.virtualLessonId))
      .first();

    return progress;
  },
});

// Get all lesson progress for a student
export const getStudentLessonProgress = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    return progress;
  },
});

// ==========================================
// ATTENDANCE
// ==========================================

// Update attendance
export const updateAttendance = mutation({
  args: {
    scheduledLessonId: v.id("scheduledLessons"),
    userId: v.union(v.id("users"), v.string()),
    status: v.union(
      v.literal("registered"),
      v.literal("attended"),
      v.literal("absent"),
      v.literal("excused")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const attendance = await ctx.db
      .query("lessonAttendance")
      .withIndex("by_lesson", (q) => q.eq("scheduledLessonId", args.scheduledLessonId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (attendance) {
      await ctx.db.patch(attendance._id, {
        status: args.status,
        notes: args.notes,
        joinedAt: args.status === "attended" ? now : attendance.joinedAt,
        updatedAt: now,
      });
      return attendance._id;
    }

    return null;
  },
});

// Get attendance for lesson
export const getLessonAttendance = query({
  args: {
    scheduledLessonId: v.id("scheduledLessons"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessonAttendance")
      .withIndex("by_lesson", (q) => q.eq("scheduledLessonId", args.scheduledLessonId))
      .collect();
  },
});

// ==========================================
// STATISTICS
// ==========================================

// Get lesson statistics for teacher dashboard
export const getTeacherLessonStats = query({
  args: {
    teacherId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const scheduledLessons = await ctx.db
      .query("scheduledLessons")
      .withIndex("by_teacher", (q) => q.eq("createdBy", args.teacherId))
      .collect();

    const virtualLessons = await ctx.db
      .query("virtualLessons")
      .withIndex("by_teacher", (q) => q.eq("createdBy", args.teacherId))
      .collect();

    const now = Date.now();
    const upcomingLessons = scheduledLessons.filter(
      (l) => l.scheduledDate > now && l.status === "scheduled"
    );
    const completedLessons = scheduledLessons.filter((l) => l.status === "completed");
    const publishedVirtualLessons = virtualLessons.filter((l) => l.isPublished);

    return {
      totalScheduledLessons: scheduledLessons.length,
      upcomingLessons: upcomingLessons.length,
      completedLessons: completedLessons.length,
      totalVirtualLessons: virtualLessons.length,
      publishedVirtualLessons: publishedVirtualLessons.length,
      nextLesson: upcomingLessons[0] || null,
    };
  },
});

// Get student lesson statistics
export const getStudentLessonStats = query({
  args: {
    studentId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .collect();

    const testSessions = await ctx.db
      .query("lessonTestSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .collect();

    const completedLessons = progress.filter((p) => p.status === "completed");
    const inProgressLessons = progress.filter((p) => p.status === "in_progress");
    const passedTests = testSessions.filter((t) => t.passed);
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.totalTimeSpent, 0);

    const averageTestScore = testSessions.length > 0
      ? testSessions.reduce((sum, t) => sum + t.percentageScore, 0) / testSessions.length
      : 0;

    return {
      totalLessonsStarted: progress.length,
      completedLessons: completedLessons.length,
      inProgressLessons: inProgressLessons.length,
      totalTestsTaken: testSessions.length,
      testsPassed: passedTests.length,
      averageTestScore: Math.round(averageTestScore),
      totalTimeSpentMinutes: Math.round(totalTimeSpent / 60),
    };
  },
});

// ==========================================
// LESSON MATERIALS (File uploads)
// ==========================================

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Save uploaded material
export const saveLessonMaterial = mutation({
  args: {
    companyId: v.id("companies"),
    scheduledLessonId: v.optional(v.id("scheduledLessons")),
    virtualLessonId: v.optional(v.id("virtualLessons")),
    uploadedBy: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("document"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("link"),
      v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const materialId = await ctx.db.insert("lessonMaterials", {
      companyId: args.companyId,
      scheduledLessonId: args.scheduledLessonId,
      virtualLessonId: args.virtualLessonId,
      uploadedBy: args.uploadedBy,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      title: args.title || args.fileName,
      description: args.description,
      category: args.category || "other",
      accessScope: "company", // Default to company-wide access
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return materialId;
  },
});

// Get materials for a scheduled lesson
export const getLessonMaterials = query({
  args: {
    scheduledLessonId: v.optional(v.id("scheduledLessons")),
    virtualLessonId: v.optional(v.id("virtualLessons")),
  },
  handler: async (ctx, args) => {
    let materials;

    if (args.scheduledLessonId) {
      materials = await ctx.db
        .query("lessonMaterials")
        .withIndex("by_scheduled_lesson", (q) => q.eq("scheduledLessonId", args.scheduledLessonId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    } else if (args.virtualLessonId) {
      materials = await ctx.db
        .query("lessonMaterials")
        .withIndex("by_virtual_lesson", (q) => q.eq("virtualLessonId", args.virtualLessonId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    } else {
      return [];
    }

    // Get download URLs for each material
    const materialsWithUrls = await Promise.all(
      materials.map(async (material) => {
        const url = material.storageId ? await ctx.storage.getUrl(material.storageId) : material.externalUrl;
        return {
          ...material,
          url,
        };
      })
    );

    return materialsWithUrls;
  },
});

// Delete material
export const deleteLessonMaterial = mutation({
  args: {
    materialId: v.id("lessonMaterials"),
  },
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found");

    // Delete from storage if it has a storageId
    if (material.storageId) {
      await ctx.storage.delete(material.storageId);
    }

    // Delete record
    await ctx.db.delete(args.materialId);

    return { success: true };
  },
});

// Update material metadata
export const updateLessonMaterial = mutation({
  args: {
    materialId: v.id("lessonMaterials"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("document"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("link"),
      v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    const { materialId, ...updates } = args;
    const now = Date.now();

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(materialId, {
      ...filteredUpdates,
      updatedAt: now,
    });

    return materialId;
  },
});
