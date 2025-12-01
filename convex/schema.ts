import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User management tables
  users: defineTable({
    // Clerk user ID for authentication
    clerkId: v.optional(v.string()),
    // User profile fields
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
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
    // Student-specific: individual lessons only (not in any group) - DEPRECATED, use takesIndividualLessons
    individualLessonsOnly: v.optional(v.boolean()),
    // Student-specific: whether student takes individual lessons (can be in addition to group lessons)
    takesIndividualLessons: v.optional(v.boolean()),
    // Placement test status
    placementTestCompleted: v.optional(v.boolean()),
    placementTestDate: v.optional(v.number()),
    placementTestScore: v.optional(v.number()),
    // Legacy field for password authentication
    passwordHash: v.optional(v.string()),
  }).index("by_email", ["email"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_company", ["companyId"])
    .index("by_role", ["role"]),

  // Company management
  companies: defineTable({
    name: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    // Status - simple active/inactive without subscription tiers
    isActive: v.optional(v.boolean()),
    // Student tracking (for analytics, not limits)
    currentStudentCount: v.number(),
    maxStudents: v.optional(v.number()),
    // Subscription info (legacy fields)
    subscriptionPlan: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    settings: v.optional(v.object({
      openRouterApiKey: v.optional(v.string()),
      elevenLabsApiKey: v.optional(v.string()),
      resendApiKey: v.optional(v.string()),
      cambridgeApiKey: v.optional(v.string()),
      geminiApiKey: v.optional(v.string()),
      replicateApiKey: v.optional(v.string()),
      testFrequency: v.optional(v.number()),
      emailNotifications: v.optional(v.boolean()),
      autoGrouping: v.optional(v.boolean()),
      // AI Models available for quiz generation (selected by admin)
      availableAIModels: v.optional(v.array(v.object({
        id: v.string(),           // e.g., "anthropic/claude-3.5-sonnet"
        name: v.string(),         // Display name e.g., "Claude 3.5 Sonnet"
        provider: v.string(),     // "openrouter", "anthropic", "openai"
        isDefault: v.optional(v.boolean()),
      }))),
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
      // Explanation language for grammar/vocabulary
      explanationLanguage: v.optional(v.union(v.literal("english"), v.literal("german"))),
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
  }).index("by_active", ["isActive"])
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

  // Quizzes / Tests
  quizzes: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    // Target level (can be "mixed" for placement tests that span levels)
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2"),
      v.literal("mixed")
    ),
    // Test purpose/category
    testPurpose: v.union(
      v.literal("placement"),      // Initial assessment to determine student level
      v.literal("follow_up"),      // Progress check after lessons
      v.literal("level_assessment"), // Assess readiness for next level
      v.literal("practice"),       // General practice without scoring impact
      v.literal("diagnostic"),     // Identify specific skill gaps
      v.literal("certification")   // Formal level certification
    ),
    // Skill focus
    skillFocus: v.union(
      v.literal("grammar"),
      v.literal("vocabulary"),
      v.literal("reading"),
      v.literal("listening"),
      v.literal("writing"),
      v.literal("speaking"),
      v.literal("mixed")
    ),
    duration: v.number(), // minutes
    passingScore: v.number(), // percentage
    totalQuestions: v.number(),
    totalPoints: v.number(),
    // Test status - allows editing until published
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    isCambridgeAligned: v.boolean(),
    cambridgeLevel: v.optional(v.string()),
    // Instructions shown before test
    instructions: v.optional(v.string()),
    // Settings
    settings: v.object({
      shuffleQuestions: v.boolean(),
      shuffleOptions: v.boolean(),
      showCorrectAnswers: v.boolean(),
      showExplanations: v.boolean(),
      allowRetake: v.boolean(),
      maxAttempts: v.number(),
      requirePassingScore: v.boolean(),
      showTimer: v.boolean(),
      // New settings
      showProgressBar: v.optional(v.boolean()),
      allowSkip: v.optional(v.boolean()),
      allowReview: v.optional(v.boolean()), // Review answers before submit
      autoSubmitOnTimeout: v.optional(v.boolean()),
    }),
    tags: v.array(v.string()),
    questionIds: v.optional(v.array(v.id("questionBank"))),
    // Inline questions (alternative to questionIds for simpler tests)
    inlineQuestions: v.optional(v.array(v.object({
      id: v.string(),
      questionType: v.string(),
      questionText: v.string(),
      questionData: v.any(),
      points: v.number(),
      skill: v.string(),
      level: v.string(),
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_level", ["level"])
    .index("by_purpose", ["testPurpose"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // Question Bank - Enhanced with more question types and audio support
  questionBank: defineTable({
    companyId: v.union(v.id("companies"), v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    // Extended question types
    questionType: v.union(
      // Basic types
      v.literal("multiple_choice"),
      v.literal("multiple_select"),    // Select all that apply
      v.literal("fill_in_blank"),
      v.literal("true_false"),
      // Text-based
      v.literal("short_answer"),       // Free text, short
      v.literal("long_answer"),        // Free text, paragraph
      v.literal("sentence_completion"),
      v.literal("error_correction"),
      v.literal("word_formation"),
      v.literal("sentence_reorder"),   // Reorder words to form sentence
      // Matching & ordering
      v.literal("matching"),           // Match pairs
      v.literal("ordering"),           // Put items in correct order
      v.literal("categorization"),     // Sort items into categories
      // Reading
      v.literal("reading_comprehension"),
      v.literal("cloze_test"),         // Fill in multiple blanks in passage
      // Listening
      v.literal("listening"),
      v.literal("audio_transcription"), // Write what you hear
      v.literal("audio_multiple_choice"), // Listen and choose
      v.literal("dictation"),          // Listen and type
      // Visual
      v.literal("image_description"),
      v.literal("image_labeling"),     // Label parts of image
      v.literal("image_sequence"),     // Order images to tell story
      v.literal("video_comprehension"),
      // Speaking (for recording)
      v.literal("speaking_response"),  // Record spoken answer
      v.literal("pronunciation"),      // Pronounce word/phrase
      v.literal("read_aloud"),         // Read text aloud
      // Interactive
      v.literal("drag_and_drop"),
      v.literal("hotspot"),            // Click on correct area
      v.literal("conversation_completion") // Complete dialogue
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
    // Rich question data structure
    questionData: v.object({
      // Basic options
      options: v.optional(v.array(v.string())),
      correctAnswer: v.any(), // Can be string, array, or object depending on type
      explanation: v.optional(v.string()),
      hints: v.optional(v.array(v.string())),

      // Audio support (enhanced)
      audio: v.optional(v.object({
        storageId: v.optional(v.id("_storage")), // Convex storage for uploaded audio
        url: v.optional(v.string()),              // External URL
        generatedId: v.optional(v.id("audioContent")), // AI-generated audio
        transcript: v.optional(v.string()),
        duration: v.optional(v.number()),        // seconds
        playbackSpeed: v.optional(v.array(v.number())), // e.g., [0.75, 1, 1.25]
        maxPlays: v.optional(v.number()),        // Limit playback count
        autoPlay: v.optional(v.boolean()),
      })),
      // Legacy audio fields for backward compatibility
      audioUrl: v.optional(v.string()),
      audioTranscript: v.optional(v.string()),

      // Image support (enhanced)
      image: v.optional(v.object({
        storageId: v.optional(v.id("_storage")),
        url: v.optional(v.string()),
        alt: v.optional(v.string()),
        hotspots: v.optional(v.array(v.object({
          id: v.string(),
          x: v.number(),
          y: v.number(),
          width: v.number(),
          height: v.number(),
          label: v.optional(v.string()),
          isCorrect: v.optional(v.boolean()),
        }))),
        labels: v.optional(v.array(v.object({
          id: v.string(),
          x: v.number(),
          y: v.number(),
          correctLabel: v.string(),
        }))),
      })),
      // Legacy image fields
      imageUrl: v.optional(v.string()),
      imageAlt: v.optional(v.string()),

      // Video support
      video: v.optional(v.object({
        storageId: v.optional(v.id("_storage")),
        url: v.optional(v.string()),
        transcript: v.optional(v.string()),
        startTime: v.optional(v.number()),
        endTime: v.optional(v.number()),
        pausePoints: v.optional(v.array(v.number())), // Times to pause for questions
      })),
      // Legacy video fields
      videoUrl: v.optional(v.string()),
      videoTranscript: v.optional(v.string()),

      // Reading passage
      readingPassage: v.optional(v.string()),

      // Fill in blank / cloze
      textWithBlanks: v.optional(v.string()), // Use {{blank}} or {{1}}, {{2}} for blanks
      blanks: v.optional(v.array(v.object({
        id: v.string(),
        correctAnswers: v.array(v.string()), // Accept multiple correct answers
        caseSensitive: v.optional(v.boolean()),
      }))),
      caseSensitive: v.optional(v.boolean()),

      // Sentence manipulation
      sentenceWithGap: v.optional(v.string()),
      sentenceWithError: v.optional(v.string()),
      wordToTransform: v.optional(v.string()),
      wordsToReorder: v.optional(v.array(v.string())),

      // Matching
      matchingPairs: v.optional(v.array(v.object({
        left: v.string(),
        right: v.string(),
      }))),

      // Ordering
      itemsToOrder: v.optional(v.array(v.string())),
      correctOrder: v.optional(v.array(v.number())),

      // Categorization
      categories: v.optional(v.array(v.object({
        name: v.string(),
        correctItems: v.array(v.string()),
      }))),
      itemsToSort: v.optional(v.array(v.string())),

      // Conversation/dialogue
      dialogue: v.optional(v.array(v.object({
        speaker: v.string(),
        text: v.string(),
        isBlank: v.optional(v.boolean()),
        correctResponse: v.optional(v.string()),
      }))),

      // Speaking/pronunciation
      targetText: v.optional(v.string()), // Text to pronounce
      referenceAudio: v.optional(v.object({
        storageId: v.optional(v.id("_storage")),
        url: v.optional(v.string()),
      })),
      acceptableVariations: v.optional(v.array(v.string())),

      // Scoring rubric for open-ended questions
      scoringRubric: v.optional(v.object({
        criteria: v.array(v.object({
          name: v.string(),
          description: v.string(),
          maxPoints: v.number(),
        })),
        sampleAnswer: v.optional(v.string()),
        keyPoints: v.optional(v.array(v.string())),
      })),
    }),
    points: v.number(),
    timeLimit: v.optional(v.number()), // seconds per question
    tags: v.array(v.string()),
    usageCount: v.number(),
    averageScore: v.number(),
    isActive: v.boolean(),
    isCambridgeAligned: v.boolean(),
    cambridgeReference: v.optional(v.string()),
    // For grouping related questions (e.g., multiple questions about same passage)
    questionGroupId: v.optional(v.string()),
    questionGroupOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_skill", ["skill"])
    .index("by_level", ["level"])
    .index("by_type", ["questionType"])
    .index("by_difficulty", ["difficulty"])
    .index("by_active", ["isActive"])
    .index("by_group", ["questionGroupId"]),

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
    // Enhanced test type to match quiz testPurpose
    testType: v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
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
    // Can optionally assign to group after completion
    assignedGroupId: v.optional(v.id("groups")),
    // Link to user if they get created
    userId: v.optional(v.id("users")),
    // For individual lesson students
    forIndividualLessons: v.optional(v.boolean()),
    createdBy: v.union(v.id("users"), v.string()),
    createdAt: v.number(),
  }).index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

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

  // Lesson materials (uploaded files) - with access scoping
  lessonMaterials: defineTable({
    companyId: v.id("companies"),
    scheduledLessonId: v.optional(v.id("scheduledLessons")),
    virtualLessonId: v.optional(v.id("virtualLessons")),
    uploadedBy: v.id("users"),
    // File info
    fileName: v.string(),
    fileType: v.string(), // MIME type
    fileSize: v.number(), // bytes
    storageId: v.optional(v.id("_storage")), // Convex storage ID (optional for link-only)
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
    // ACCESS SCOPING - who can see this material
    accessScope: v.union(
      v.literal("company"),    // All members of the company can access
      v.literal("group"),      // Only specific group(s) can access
      v.literal("individual")  // Only specific student(s) can access
    ),
    // For group-scoped materials
    accessGroupIds: v.optional(v.array(v.id("groups"))),
    // For individual-scoped materials
    accessStudentIds: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_company", ["companyId"])
    .index("by_scheduled_lesson", ["scheduledLessonId"])
    .index("by_virtual_lesson", ["virtualLessonId"])
    .index("by_uploader", ["uploadedBy"])
    .index("by_access_scope", ["accessScope"]),

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

  // User invitations for password setup
  userInvitations: defineTable({
    userId: v.id("users"),
    companyId: v.union(v.id("companies"), v.string()),
    email: v.string(),
    token: v.string(), // Unique token for the invitation link
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
    createdBy: v.union(v.id("users"), v.string()),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
  }).index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"]),

  // Company invitation links (for students to join a company)
  companyInvitationLinks: defineTable({
    companyId: v.id("companies"),
    token: v.string(), // Unique token for the link
    role: v.union(
      v.literal("student"),
      v.literal("teacher"),
      v.literal("admin")
    ),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()), // Optional expiration
    maxUses: v.optional(v.number()), // Optional max number of uses
    currentUses: v.number(), // Current number of uses
    // Optional test/quiz to send with invitation
    quizId: v.optional(v.id("quizzes")),
    testType: v.optional(v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    )),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_token", ["token"])
    .index("by_company", ["companyId"])
    .index("by_active", ["isActive"]),

  // Material download tracking
  materialDownloads: defineTable({
    materialId: v.id("lessonMaterials"),
    userId: v.id("users"),
    companyId: v.id("companies"),
    downloadedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_material", ["materialId"])
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"])
    .index("by_downloaded_at", ["downloadedAt"]),

  // Material sharing notifications
  materialNotifications: defineTable({
    materialId: v.id("lessonMaterials"),
    recipientId: v.id("users"),
    companyId: v.id("companies"),
    notificationType: v.union(
      v.literal("material_shared"),
      v.literal("material_updated"),
      v.literal("material_removed")
    ),
    message: v.string(),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_recipient", ["recipientId"])
    .index("by_material", ["materialId"])
    .index("by_company", ["companyId"])
    .index("by_is_read", ["isRead"]),
});