import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // User management tables - extended from authTables
  users: defineTable({
    // Convex Auth fields (required by auth system)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Legacy field - kept for migration, no longer used
    passwordHash: v.optional(v.string()),
    // Application-specific fields
    role: v.optional(v.union(
      v.literal("corporate_admin"),
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student")
    )),
    companyId: v.optional(v.union(v.id("companies"), v.string())),
    isActive: v.optional(v.boolean()),
    currentLevel: v.optional(v.string()),
    totalScore: v.optional(v.number()),
    averageScore: v.optional(v.number()),
    completedTests: v.optional(v.number()),
    lastLogin: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_email", ["email"])
    .index("by_company", ["companyId"])
    .index("by_role", ["role"]),

  // Company management
  companies: defineTable({
    name: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    subscriptionPlan: v.union(
      v.literal("trial"),
      v.literal("basic"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("cancelled")
    ),
    maxStudents: v.number(),
    currentStudentCount: v.number(),
    settings: v.optional(v.object({
      openRouterApiKey: v.string(),
      elevenLabsApiKey: v.string(),
      resendApiKey: v.string(),
      cambridgeApiKey: v.string(),
      geminiApiKey: v.optional(v.string()),
      testFrequency: v.number(),
      autoGrouping: v.boolean(),
      emailNotifications: v.boolean(),
    })),
    // AI Prompt Templates for Virtual Lesson Generation
    aiPromptTemplates: v.optional(v.object({
      // System prompt applied to all lessons
      systemPrompt: v.optional(v.string()),
      // Presentation format instructions
      presentationFormat: v.optional(v.string()),
      // Homework format instructions
      homeworkFormat: v.optional(v.string()),
      // Default language for lessons
      defaultLanguage: v.optional(v.union(v.literal("english"), v.literal("german"))),
    })),
    // Voice Configuration for TTS
    voiceConfig: v.optional(v.object({
      // Custom voices (cloned voices from ElevenLabs)
      customVoices: v.optional(v.array(v.object({
        id: v.string(),
        name: v.string(),
        language: v.union(v.literal("english"), v.literal("german")),
        isDefault: v.optional(v.boolean()),
      }))),
      // Default voice for English lessons
      defaultEnglishVoice: v.optional(v.string()),
      // Default voice for German lessons
      defaultGermanVoice: v.optional(v.string()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_subscription_plan", ["subscriptionPlan"])
    .index("by_status", ["subscriptionStatus"])
    .index("by_contact_email", ["contactEmail"]),

  // Test sessions
  testSessions: defineTable({
    testId: v.string(),
    quizId: v.optional(v.id("quizzes")),
    assignmentId: v.optional(v.id("quizAssignments")),
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
    cambridgeSessionId: v.optional(v.string()),
    cambridgeAccessToken: v.optional(v.string()),
    status: v.union(
      v.literal("created"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    totalQuestions: v.number(),
    questionsAnswered: v.number(),
    attemptNumber: v.optional(v.number()),
    customQuestions: v.optional(v.array(v.any())),
    answers: v.optional(v.array(v.any())),
    totalScore: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    percentageScore: v.optional(v.number()),
    skillBreakdown: v.optional(v.object({
      grammar: v.number(),
      vocabulary: v.number(),
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
      speaking: v.number(),
    })),
    recommendedLevel: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_quiz", ["quizId"])
    .index("by_assignment", ["assignmentId"]),

  // Quizzes
  quizzes: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
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
    quizType: v.union(
      v.literal("placement"),
      v.literal("progress"),
      v.literal("practice"),
      v.literal("custom")
    ),
    category: v.union(
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
    totalQuestions: v.number(),
    totalPoints: v.number(),
    isPublished: v.boolean(),
    isCambridgeAligned: v.boolean(),
    cambridgeLevel: v.optional(v.string()),
    settings: v.object({
      shuffleQuestions: v.boolean(),
      shuffleOptions: v.boolean(),
      showCorrectAnswers: v.boolean(),
      showExplanations: v.boolean(),
      allowRetake: v.boolean(),
      maxAttempts: v.number(),
      requirePassingScore: v.boolean(),
      showTimer: v.boolean(),
    }),
    tags: v.array(v.string()),
    questionIds: v.optional(v.array(v.id("questionBank"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_level", ["level"])
    .index("by_type", ["quizType"])
    .index("by_published", ["isPublished"])
    .index("by_created_by", ["createdBy"]),

  // Question Bank
  questionBank: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    questionType: v.union(
      v.literal("multiple_choice"),
      v.literal("fill_in_blank"),
      v.literal("true_false"),
      v.literal("listening"),
      v.literal("reading_comprehension"),
      v.literal("image_description"),
      v.literal("video_dialogue"),
      v.literal("sentence_completion"),
      v.literal("error_correction"),
      v.literal("word_formation")
    ),
    skill: v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking")
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
      audioTranscript: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      imageAlt: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      videoTranscript: v.optional(v.string()),
      readingPassage: v.optional(v.string()),
      hints: v.optional(v.array(v.string())),
      caseSensitive: v.optional(v.boolean()),
      // For sentence completion / word formation
      sentenceWithGap: v.optional(v.string()),
      wordToTransform: v.optional(v.string()),
      // For error correction
      sentenceWithError: v.optional(v.string()),
      // For matching exercises
      matchingPairs: v.optional(v.array(v.object({
        left: v.string(),
        right: v.string(),
      }))),
    }),
    points: v.number(),
    timeLimit: v.optional(v.number()),
    tags: v.array(v.string()),
    usageCount: v.number(),
    averageScore: v.number(),
    isActive: v.boolean(),
    isCambridgeAligned: v.boolean(),
    cambridgeReference: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_skill", ["skill"])
    .index("by_level", ["level"])
    .index("by_type", ["questionType"])
    .index("by_difficulty", ["difficulty"])
    .index("by_active", ["isActive"]),

  // Quiz Assignments
  quizAssignments: defineTable({
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
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired")
    ),
    notificationSent: v.boolean(),
    completionCount: v.number(),
    averageScore: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_quiz", ["quizId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_due_date", ["dueDate"]),

  // AI generated content
  aiContent: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    type: v.union(
      v.literal("lesson"),
      v.literal("quiz"),
      v.literal("exercise")
    ),
    level: v.string(),
    topic: v.optional(v.string()),
    prompt: v.string(),
    generatedContent: v.string(),
    model: v.string(),
    wordCount: v.number(),
    topics: v.array(v.string()),
    reviewStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    isUsed: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_type", ["type"])
    .index("by_level", ["level"])
    .index("by_review_status", ["reviewStatus"]),

  // Audio content
  audioContent: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    type: v.union(
      v.literal("lesson_audio"),
      v.literal("exercise_audio"),
      v.literal("listening_exercise")
    ),
    textContent: v.string(),
    audioUrl: v.string(),
    voiceId: v.string(),
    voiceName: v.string(),
    duration: v.number(),
    language: v.string(),
    quality: v.string(),
    relatedEntityId: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_voice", ["voiceId"])
    .index("by_type", ["type"]),

  // User progress tracking
  progress: defineTable({
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
    currentLevel: v.string(),
    overallScore: v.number(),
    totalSessions: v.number(),
    completedLessons: v.number(),
    totalLessons: v.number(),
    streakDays: v.number(),
    lastActivity: v.number(),
    lastTestDate: v.optional(v.number()),
    testHistory: v.array(v.object({
      testId: v.string(),
      sessionId: v.string(),
      score: v.number(),
      level: v.string(),
      date: v.number(),
    })),
    skillScores: v.object({
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
      speaking: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_company", ["companyId"]),

  // Notifications
  notifications: defineTable({
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
    title: v.string(),
    message: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    isEmailSent: v.boolean(),
    emailSentAt: v.optional(v.number()),
    relatedEntityId: v.optional(v.string()),
    relatedEntityType: v.optional(v.string()),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_read_status", ["isRead"])
    .index("by_email_sent", ["isEmailSent"]),

  // Audit logs
  auditLogs: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    userId: v.optional(v.union(v.id("users"), v.string())),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    oldValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
    timestamp: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"]),

  // Settings management
  settings: defineTable({
    userId: v.optional(v.union(v.id("users"), v.string())),
    companyId: v.optional(v.union(v.id("companies"), v.string())),
    settingKey: v.string(),
    settingValue: v.any(),
    category: v.string(),
    isPublic: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_company", ["companyId"])
    .index("by_category", ["category"]),

  // Email templates
  emailTemplates: defineTable({
    companyId: v.optional(v.union(v.id("companies"), v.string())),
    name: v.string(),
    category: v.union(
      v.literal("test_invitation"),
      v.literal("results_notification"),
      v.literal("progress_update"),
      v.literal("welcome"),
      v.literal("reminder")
    ),
    subject: v.string(),
    htmlContent: v.string(),
    textContent: v.string(),
    variables: v.array(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_category", ["category"])
    .index("by_active_status", ["isActive"]),

  // Student groups for level-based organization
  groups: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
    teacherId: v.optional(v.union(v.id("users"), v.string())),
    maxStudents: v.number(),
    currentStudentCount: v.number(),
    studentIds: v.array(v.string()),
    scheduleInfo: v.optional(v.string()),
    isActive: v.boolean(),
    autoAssign: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_level", ["level"])
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"]),

  // Assessment invitations (for public test links)
  assessmentInvitations: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    token: v.string(), // Unique token for the link
    email: v.string(),
    name: v.string(),
    quizId: v.optional(v.id("quizzes")),
    testType: v.union(
      v.literal("placement"),
      v.literal("progress"),
      v.literal("practice")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    testSessionId: v.optional(v.id("testSessions")),
    score: v.optional(v.number()),
    recommendedLevel: v.optional(v.string()),
    assignedGroupId: v.optional(v.id("groups")),
    createdBy: v.union(v.id("users"), v.string()),
    createdAt: v.number(),
  }).index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"]),

  // Scheduled lessons (real-time lessons with teacher)
  scheduledLessons: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()), // Who created the record
    teacherId: v.optional(v.union(v.id("users"), v.string())), // Assigned teacher (optional for backward compatibility)
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
    // Scheduling
    scheduledDate: v.number(), // timestamp
    duration: v.number(), // minutes
    timezone: v.string(),
    // Location
    locationType: v.union(
      v.literal("online"),
      v.literal("office"),
      v.literal("company")
    ),
    locationDetails: v.optional(v.string()), // URL for online, address for office/company
    meetingLink: v.optional(v.string()), // Zoom/Teams/Meet link
    // Lesson content
    topic: v.string(),
    objectives: v.array(v.string()),
    materials: v.optional(v.array(v.string())), // URLs or references to materials
    // Transcript for virtual lesson generation
    transcript: v.optional(v.string()),
    transcriptAddedAt: v.optional(v.number()),
    // Virtual lesson created from this
    virtualLessonId: v.optional(v.id("virtualLessons")),
    // Status
    status: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    // Attendees
    assignedStudentIds: v.array(v.string()),
    attendedStudentIds: v.optional(v.array(v.string())),
    // Notifications
    reminderSent: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_teacher", ["createdBy"])
    .index("by_group", ["groupId"])
    .index("by_date", ["scheduledDate"])
    .index("by_status", ["status"]),

  // Virtual lessons (AI-generated from transcripts)
  virtualLessons: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    scheduledLessonId: v.optional(v.id("scheduledLessons")), // Source lesson
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
    // Language settings
    language: v.optional(v.union(v.literal("english"), v.literal("german"))),
    explanationLanguage: v.optional(v.union(v.literal("english"), v.literal("german"))),
    // Generated content sections
    sections: v.array(v.object({
      id: v.string(),
      type: v.union(
        v.literal("introduction"),
        v.literal("vocabulary"),
        v.literal("grammar"),
        v.literal("reading"),
        v.literal("listening"),
        v.literal("exercise"),
        v.literal("summary")
      ),
      title: v.string(),
      content: v.string(), // HTML/Markdown content
      audioId: v.optional(v.id("audioContent")), // ElevenLabs generated audio
      visualContent: v.optional(v.string()), // Gemini generated visual HTML
      order: v.number(),
    })),
    // Vocabulary items extracted
    vocabulary: v.array(v.object({
      word: v.string(),
      definition: v.string(),
      example: v.string(),
      pronunciation: v.optional(v.string()),
      audioId: v.optional(v.id("audioContent")),
      partOfSpeech: v.optional(v.string()),
    })),
    // Grammar points
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
    // End-of-lesson test
    testId: v.optional(v.id("lessonTests")),
    // Metadata
    estimatedDuration: v.number(), // minutes
    objectives: v.array(v.string()),
    tags: v.array(v.string()),
    // Generation info
    generatedWithModel: v.optional(v.string()),
    sourceTranscript: v.optional(v.string()),
    // Publishing
    isPublished: v.boolean(),
    publishedAt: v.optional(v.number()),
    // Assignment
    assignedGroups: v.optional(v.array(v.id("groups"))),
    assignedStudentIds: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_teacher", ["createdBy"])
    .index("by_level", ["level"])
    .index("by_published", ["isPublished"])
    .index("by_scheduled_lesson", ["scheduledLessonId"]),

  // Lesson tests (end-of-lesson assessments)
  lessonTests: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    virtualLessonId: v.id("virtualLessons"),
    createdBy: v.union(v.id("users"), v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    // Questions
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
    // Settings
    passingScore: v.number(), // percentage
    timeLimit: v.optional(v.number()), // minutes
    shuffleQuestions: v.boolean(),
    showCorrectAnswers: v.boolean(),
    allowRetake: v.boolean(),
    maxAttempts: v.number(),
    // Stats
    totalPoints: v.number(),
    totalQuestions: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_lesson", ["virtualLessonId"]),

  // Lesson test sessions (student attempts)
  lessonTestSessions: defineTable({
    testId: v.id("lessonTests"),
    virtualLessonId: v.id("virtualLessons"),
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
    // Progress
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    // Answers
    answers: v.array(v.object({
      questionId: v.string(),
      answer: v.any(),
      isCorrect: v.boolean(),
      pointsEarned: v.number(),
    })),
    // Scoring
    totalScore: v.number(),
    maxScore: v.number(),
    percentageScore: v.number(),
    passed: v.boolean(),
    // Skill breakdown
    skillBreakdown: v.optional(v.object({
      vocabulary: v.number(),
      grammar: v.number(),
      reading: v.number(),
      listening: v.number(),
      comprehension: v.number(),
    })),
    attemptNumber: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_test", ["testId"])
    .index("by_lesson", ["virtualLessonId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"]),

  // Student progress on virtual lessons
  lessonProgress: defineTable({
    userId: v.union(v.id("users"), v.string()),
    virtualLessonId: v.id("virtualLessons"),
    companyId: v.union(v.id("companies"), v.string()),
    // Progress
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    // Section progress
    completedSections: v.array(v.string()), // section IDs
    currentSectionId: v.optional(v.string()),
    // Vocabulary progress
    masteredVocabulary: v.array(v.string()), // word list
    reviewVocabulary: v.array(v.string()), // needs review
    // Time tracking
    totalTimeSpent: v.number(), // seconds
    lastActivityAt: v.number(),
    // Test results
    testSessionId: v.optional(v.id("lessonTestSessions")),
    testPassed: v.optional(v.boolean()),
    testScore: v.optional(v.number()),
    // Notes
    studentNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_lesson", ["virtualLessonId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"]),

  // Lesson materials (uploaded files)
  lessonMaterials: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    scheduledLessonId: v.optional(v.id("scheduledLessons")),
    virtualLessonId: v.optional(v.id("virtualLessons")),
    uploadedBy: v.union(v.id("users"), v.string()),
    // File info
    fileName: v.string(),
    fileType: v.string(), // MIME type
    fileSize: v.number(), // bytes
    storageId: v.id("_storage"), // Convex storage ID
    // Optional external link (for link-only materials)
    externalUrl: v.optional(v.string()),
    // Metadata
    title: v.optional(v.string()), // Display title
    description: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("document"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("link"),
      v.literal("other")
    )),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_scheduled_lesson", ["scheduledLessonId"])
    .index("by_virtual_lesson", ["virtualLessonId"])
    .index("by_uploader", ["uploadedBy"]),

  // Scheduled lesson attendance
  lessonAttendance: defineTable({
    scheduledLessonId: v.id("scheduledLessons"),
    userId: v.union(v.id("users"), v.string()),
    companyId: v.union(v.id("companies"), v.string()),
    status: v.union(
      v.literal("registered"),
      v.literal("attended"),
      v.literal("absent"),
      v.literal("excused")
    ),
    joinedAt: v.optional(v.number()),
    leftAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_lesson", ["scheduledLessonId"])
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"]),

  // Email campaigns
  emailCampaigns: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    name: v.string(),
    templateId: v.union(v.id("emailTemplates"), v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed")
    ),
    recipientType: v.union(
      v.literal("all_students"),
      v.literal("by_level"),
      v.literal("by_group"),
      v.literal("specific_users")
    ),
    recipients: v.array(v.string()),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    sentCount: v.number(),
    openedCount: v.number(),
    clickedCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_scheduled", ["scheduledAt"]),
});