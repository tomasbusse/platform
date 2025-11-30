import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Generate a secure random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Determine CEFR level based on score
function determineCEFRLevel(score: number): string {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 60) return 'B1';
  if (score >= 50) return 'A2';
  return 'A1';
}

// ============================================================================
// CREATE INVITATION
// ============================================================================

export const createInvitation = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    email: v.string(),
    name: v.string(),
    testType: v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    ),
    quizId: v.optional(v.id("quizzes")),
    createdBy: v.union(v.id("users"), v.string()),
    expiryDays: v.optional(v.number()),
    // Link to existing user if sending to a student
    userId: v.optional(v.id("users")),
    // For individual lesson students
    forIndividualLessons: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresInDays = args.expiryDays || 7; // Default 7 days
    const expiresAt = now + (expiresInDays * 24 * 60 * 60 * 1000);

    // Generate unique token
    let token = generateToken();

    // Make sure token is unique
    let existing = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    while (existing) {
      token = generateToken();
      existing = await ctx.db
        .query("assessmentInvitations")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
    }

    // Create the invitation
    const invitationId = await ctx.db.insert("assessmentInvitations", {
      companyId: args.companyId,
      token,
      email: args.email,
      name: args.name,
      quizId: args.quizId,
      testType: args.testType,
      status: "pending",
      expiresAt,
      userId: args.userId,
      forIndividualLessons: args.forIndividualLessons,
      createdBy: args.createdBy,
      createdAt: now,
    });

    return {
      invitationId,
      token,
      expiresAt,
    };
  },
});

// ============================================================================
// GET INVITATION BY TOKEN (Public - no auth required)
// ============================================================================

export const getInvitationByToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return null;
    }

    // Check if expired
    if (invitation.expiresAt < Date.now()) {
      return { ...invitation, isExpired: true };
    }

    // Check if already completed
    if (invitation.status === "completed") {
      return { ...invitation, isCompleted: true };
    }

    // Get company info
    const company = await ctx.db.get(invitation.companyId as Id<"companies">);

    // Get quiz if specified
    let quiz = null;
    if (invitation.quizId) {
      quiz = await ctx.db.get(invitation.quizId);
    }

    return {
      ...invitation,
      company: company ? { name: company.name } : null,
      quiz: quiz ? { title: quiz.title, duration: quiz.duration, totalQuestions: quiz.totalQuestions } : null,
      isExpired: false,
      isCompleted: false,
    };
  },
});

// ============================================================================
// START ASSESSMENT (Public - no auth required)
// ============================================================================

export const startAssessment = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const invitation = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new Error("Invalid invitation token");
    }

    if (invitation.expiresAt < now) {
      throw new Error("This invitation has expired");
    }

    if (invitation.status === "completed") {
      throw new Error("This assessment has already been completed");
    }

    // If already started, return existing session
    if (invitation.status === "started" && invitation.testSessionId) {
      const existingSession = await ctx.db.get(invitation.testSessionId);
      if (existingSession) {
        // Get time limit from quiz if available
        let resumeTimeLimit = 45;
        if (invitation.quizId) {
          const quiz = await ctx.db.get(invitation.quizId);
          if (quiz) {
            resumeTimeLimit = quiz.duration || 45;
          }
        }
        return {
          sessionId: invitation.testSessionId,
          questions: existingSession.customQuestions,
          timeLimit: resumeTimeLimit,
        };
      }
    }

    // Get test questions based on invitation configuration
    let questions: any[] = [];
    let timeLimit = 45; // default minutes

    if (invitation.quizId) {
      // Use specific quiz questions (from inlineQuestions)
      const quiz = await ctx.db.get(invitation.quizId);
      if (quiz && quiz.inlineQuestions && quiz.inlineQuestions.length > 0) {
        // Use the quiz's inline questions directly
        questions = quiz.inlineQuestions.map((q: any, index: number) => ({
          id: q.id || `q_${index + 1}`,
          type: q.questionType,
          skill: q.skill,
          level: q.level,
          question: q.questionText,
          options: q.questionData?.options || [],
          correctAnswer: q.questionData?.correctAnswer,
          explanation: q.questionData?.explanation,
          points: q.points || 1,
          // Include any additional data that might be needed
          audioUrl: q.questionData?.audioUrl,
          imageUrl: q.questionData?.imageUrl,
          readingPassage: q.questionData?.readingPassage,
        }));
        // Use quiz's duration if available
        timeLimit = quiz.duration || 45;
      }
    }

    // If no questions from quiz (no quizId or quiz has no inline questions), use default placement test questions
    if (questions.length === 0) {
      questions = generatePlacementQuestions();
    }

    // Create test session
    const sessionId = await ctx.db.insert("testSessions", {
      testId: `assessment_${invitation.testType}_${invitation.token}`,
      userId: invitation.email, // Use email as identifier for non-logged users
      companyId: invitation.companyId,
      status: "in_progress",
      startedAt: now,
      totalQuestions: questions.length,
      questionsAnswered: 0,
      customQuestions: questions,
      createdAt: now,
      updatedAt: now,
    });

    // Update invitation
    await ctx.db.patch(invitation._id, {
      status: "started",
      startedAt: now,
      testSessionId: sessionId,
    });

    return {
      sessionId,
      questions,
      timeLimit, // minutes (from quiz or default 45)
    };
  },
});

// ============================================================================
// SUBMIT ASSESSMENT (Public - no auth required)
// ============================================================================

export const submitAssessment = mutation({
  args: {
    token: v.string(),
    answers: v.array(v.object({
      questionId: v.string(),
      selectedOption: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const invitation = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new Error("Invalid invitation token");
    }

    if (!invitation.testSessionId) {
      throw new Error("Assessment not started");
    }

    const session = await ctx.db.get(invitation.testSessionId);
    if (!session) {
      throw new Error("Test session not found");
    }

    // Calculate score
    const questions = session.customQuestions || [];
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    const detailedResults: any[] = [];

    for (const answer of args.answers) {
      const question = questions.find((q: any) => q.id === answer.questionId);
      if (question) {
        totalPoints += question.points || 1;
        // Get the selected option text to compare with correctAnswer
        const selectedOptionText = question.options?.[answer.selectedOption] || '';
        const isCorrect = question.correctAnswer?.toString().toLowerCase() === selectedOptionText?.toString().toLowerCase();
        if (isCorrect) {
          correctCount++;
          earnedPoints += question.points || 1;
        }
        detailedResults.push({
          questionId: answer.questionId,
          userAnswer: selectedOptionText,
          correctAnswer: question.correctAnswer,
          isCorrect,
          skill: question.skill,
          points: question.points || 1,
        });
      }
    }

    const percentageScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const recommendedLevel = determineCEFRLevel(percentageScore);

    // Calculate skill breakdown
    const skillScores: Record<string, { correct: number; total: number }> = {};
    for (const result of detailedResults) {
      if (!skillScores[result.skill]) {
        skillScores[result.skill] = { correct: 0, total: 0 };
      }
      skillScores[result.skill].total++;
      if (result.isCorrect) {
        skillScores[result.skill].correct++;
      }
    }

    const skillBreakdown: Record<string, number> = {};
    for (const [skill, data] of Object.entries(skillScores)) {
      skillBreakdown[skill] = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    }

    // Update test session
    await ctx.db.patch(invitation.testSessionId, {
      status: "completed",
      completedAt: now,
      answers: args.answers,
      questionsAnswered: args.answers.length,
      totalScore: earnedPoints,
      maxScore: totalPoints,
      percentageScore,
      recommendedLevel,
      skillBreakdown: skillBreakdown as any,
      updatedAt: now,
    });

    // Auto-assign to group
    let assignedGroup = null;
    const availableGroups = await ctx.db
      .query("groups")
      .withIndex("by_level", (q) => q.eq("level", recommendedLevel as any))
      .filter((g) =>
        g.eq(g.field("companyId"), invitation.companyId) &&
        g.eq(g.field("isActive"), true) &&
        g.eq(g.field("autoAssign"), true)
      )
      .collect();

    // Find group with capacity
    const groupWithCapacity = availableGroups.find(
      g => g.currentStudentCount < g.maxStudents
    );

    if (groupWithCapacity) {
      // Add to group (using email as identifier)
      await ctx.db.patch(groupWithCapacity._id, {
        studentIds: [...groupWithCapacity.studentIds, invitation.email],
        currentStudentCount: groupWithCapacity.currentStudentCount + 1,
        updatedAt: now,
      });
      assignedGroup = groupWithCapacity;
    }

    // Update invitation with results
    await ctx.db.patch(invitation._id, {
      status: "completed",
      completedAt: now,
      score: percentageScore,
      recommendedLevel,
      assignedGroupId: groupWithCapacity?._id,
    });

    // Create or update user if they don't exist
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", invitation.email))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        currentLevel: recommendedLevel,
        totalScore: percentageScore,
        averageScore: percentageScore,
        completedTests: (existingUser.completedTests || 0) + 1,
        updatedAt: now,
      });
    } else {
      // Create new user as student
      await ctx.db.insert("users", {
        name: invitation.name,
        email: invitation.email,
        role: "student",
        companyId: invitation.companyId,
        isActive: true,
        currentLevel: recommendedLevel,
        totalScore: percentageScore,
        averageScore: percentageScore,
        completedTests: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Build formattedSkillScores in the expected format
    const formattedSkillScores = {
      grammar: skillBreakdown['grammar'] || 0,
      vocabulary: skillBreakdown['vocabulary'] || 0,
      reading: skillBreakdown['reading'] || 0,
      listening: skillBreakdown['listening'] || 0,
      writing: skillBreakdown['writing'] || 0,
      speaking: skillBreakdown['speaking'] || 0,
    };

    // Get teacher info if group has a teacher
    let teacherInfo = null;
    if (assignedGroup?.teacherId) {
      const teacher = await ctx.db.get(assignedGroup.teacherId as Id<"users">);
      if (teacher) {
        teacherInfo = {
          name: teacher.name,
          email: teacher.email,
        };
      }
    }

    return {
      score: percentageScore,
      correctAnswers: correctCount,
      totalQuestions: questions.length,
      recommendedLevel,
      skillScores: formattedSkillScores,
      skillBreakdown,
      assignedGroup: assignedGroup?.name || null,
      assignedGroupDetails: assignedGroup ? {
        name: assignedGroup.name,
        level: assignedGroup.level,
        scheduleInfo: assignedGroup.scheduleInfo,
        teacherName: teacherInfo?.name || null,
        teacherEmail: teacherInfo?.email || null,
      } : null,
      detailedResults,
    };
  },
});

// ============================================================================
// GET COMPANY INVITATIONS (Admin only)
// ============================================================================

export const getCompanyInvitations = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("expired")
    )),
  },
  handler: async (ctx, args) => {
    let invitations = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.status) {
      invitations = invitations.filter(i => i.status === args.status);
    }

    // Sort by creation date descending
    invitations.sort((a, b) => b.createdAt - a.createdAt);

    return invitations;
  },
});

// ============================================================================
// RESEND INVITATION
// ============================================================================

export const resendInvitation = mutation({
  args: {
    invitationId: v.id("assessmentInvitations"),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresInDays = args.expiresInDays || 7;
    const expiresAt = now + (expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Generate new token
    let token = generateToken();
    let existing = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    while (existing) {
      token = generateToken();
      existing = await ctx.db
        .query("assessmentInvitations")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
    }

    // Update invitation
    await ctx.db.patch(args.invitationId, {
      token,
      status: "pending",
      expiresAt,
      startedAt: undefined,
      completedAt: undefined,
      testSessionId: undefined,
      score: undefined,
      recommendedLevel: undefined,
      assignedGroupId: undefined,
    });

    return { token, expiresAt };
  },
});

// ============================================================================
// DELETE INVITATION
// ============================================================================

export const deleteInvitation = mutation({
  args: {
    invitationId: v.id("assessmentInvitations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.invitationId);
    return { success: true };
  },
});

// ============================================================================
// BULK CREATE INVITATIONS
// ============================================================================

export const bulkCreateInvitations = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    invitations: v.array(v.object({
      email: v.string(),
      name: v.string(),
      userId: v.optional(v.id("users")),
    })),
    testType: v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    ),
    quizId: v.optional(v.id("quizzes")),
    createdBy: v.union(v.id("users"), v.string()),
    expiryDays: v.optional(v.number()),
    forIndividualLessons: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresInDays = args.expiryDays || 7;
    const expiresAt = now + (expiresInDays * 24 * 60 * 60 * 1000);

    const results = [];

    for (const inv of args.invitations) {
      // Generate unique token
      let token = generateToken();
      let existing = await ctx.db
        .query("assessmentInvitations")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();

      while (existing) {
        token = generateToken();
        existing = await ctx.db
          .query("assessmentInvitations")
          .withIndex("by_token", (q) => q.eq("token", token))
          .first();
      }

      const invitationId = await ctx.db.insert("assessmentInvitations", {
        companyId: args.companyId,
        token,
        email: inv.email,
        name: inv.name,
        quizId: args.quizId,
        testType: args.testType,
        status: "pending",
        expiresAt,
        userId: inv.userId,
        forIndividualLessons: args.forIndividualLessons,
        createdBy: args.createdBy,
        createdAt: now,
      });

      results.push({
        invitationId,
        email: inv.email,
        name: inv.name,
        token,
      });
    }

    return { created: results };
  },
});

// ============================================================================
// HELPER: Generate Placement Test Questions
// ============================================================================

function generatePlacementQuestions() {
  return [
    // ============================================================================
    // A1 Level Questions (Beginner) - 5 questions
    // ============================================================================
    {
      id: "q_1",
      type: "multiple_choice",
      skill: "grammar",
      level: "A1",
      question: "I ___ a student.",
      options: ["am", "is", "are", "be"],
      correctAnswer: "am",
      explanation: "Use 'am' with the pronoun 'I'. This is the present simple of 'to be'.",
      points: 1,
    },
    {
      id: "q_2",
      type: "multiple_choice",
      skill: "grammar",
      level: "A1",
      question: "She ___ to school every day.",
      options: ["go", "goes", "going", "went"],
      correctAnswer: "goes",
      explanation: "Third person singular (he/she/it) uses 'goes' in present simple.",
      points: 1,
    },
    {
      id: "q_3",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "A1",
      question: "What is the opposite of 'big'?",
      options: ["tall", "small", "long", "wide"],
      correctAnswer: "small",
      explanation: "Big and small are opposites describing size.",
      points: 1,
    },
    {
      id: "q_4",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "A1",
      question: "My mother's sister is my ___.",
      options: ["grandmother", "aunt", "cousin", "niece"],
      correctAnswer: "aunt",
      explanation: "Your mother's sister is your aunt.",
      points: 1,
    },
    {
      id: "q_5",
      type: "multiple_choice",
      skill: "grammar",
      level: "A1",
      question: "___ you like coffee?",
      options: ["Do", "Does", "Is", "Are"],
      correctAnswer: "Do",
      explanation: "Use 'Do' with 'you' to form questions in present simple.",
      points: 1,
    },

    // ============================================================================
    // A2 Level Questions (Elementary) - 5 questions
    // ============================================================================
    {
      id: "q_6",
      type: "multiple_choice",
      skill: "grammar",
      level: "A2",
      question: "I ___ to the cinema yesterday.",
      options: ["go", "went", "gone", "going"],
      correctAnswer: "went",
      explanation: "Past simple of 'go' is 'went'. 'Yesterday' indicates past tense.",
      points: 1,
    },
    {
      id: "q_7",
      type: "multiple_choice",
      skill: "grammar",
      level: "A2",
      question: "There ___ many people at the party last night.",
      options: ["was", "were", "is", "be"],
      correctAnswer: "were",
      explanation: "'Were' is used with plural nouns ('people') in past simple.",
      points: 1,
    },
    {
      id: "q_8",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "A2",
      question: "I need to ___ the bus to work every morning.",
      options: ["catch", "bring", "make", "do"],
      correctAnswer: "catch",
      explanation: "We use 'catch' with public transport - catch the bus/train.",
      points: 1,
    },
    {
      id: "q_9",
      type: "multiple_choice",
      skill: "grammar",
      level: "A2",
      question: "She is ___ than her brother.",
      options: ["tall", "taller", "tallest", "more tall"],
      correctAnswer: "taller",
      explanation: "Comparative form: 'taller' (adjective + -er) for comparing two things.",
      points: 1,
    },
    {
      id: "q_10",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "A2",
      question: "I'm really tired. I think I'll go to ___ early tonight.",
      options: ["bed", "sleep", "rest", "dream"],
      correctAnswer: "bed",
      explanation: "'Go to bed' is a fixed expression meaning to lie down to sleep.",
      points: 1,
    },

    // ============================================================================
    // B1 Level Questions (Intermediate) - 5 questions
    // ============================================================================
    {
      id: "q_11",
      type: "multiple_choice",
      skill: "grammar",
      level: "B1",
      question: "If I ___ you, I would study harder.",
      options: ["am", "was", "were", "be"],
      correctAnswer: "were",
      explanation: "Second conditional uses 'were' for all persons (hypothetical situations).",
      points: 2,
    },
    {
      id: "q_12",
      type: "multiple_choice",
      skill: "grammar",
      level: "B1",
      question: "She has been working here ___ 2015.",
      options: ["since", "for", "during", "while"],
      correctAnswer: "since",
      explanation: "'Since' is used with specific points in time (2015). 'For' is used with periods.",
      points: 2,
    },
    {
      id: "q_13",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "B1",
      question: "The meeting was ___ until next week.",
      options: ["put off", "put on", "put up", "put down"],
      correctAnswer: "put off",
      explanation: "'Put off' is a phrasal verb meaning to postpone or delay.",
      points: 2,
    },
    {
      id: "q_14",
      type: "multiple_choice",
      skill: "grammar",
      level: "B1",
      question: "By the time I arrived, they ___ already left.",
      options: ["have", "had", "has", "having"],
      correctAnswer: "had",
      explanation: "Past perfect ('had left') for an action completed before another past action.",
      points: 2,
    },
    {
      id: "q_15",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "B1",
      question: "I'm not sure what to do. Can you give me some ___?",
      options: ["advise", "advice", "advices", "advising"],
      correctAnswer: "advice",
      explanation: "'Advice' is an uncountable noun. 'Advise' is the verb form.",
      points: 2,
    },

    // ============================================================================
    // B2 Level Questions (Upper Intermediate) - 5 questions
    // ============================================================================
    {
      id: "q_16",
      type: "multiple_choice",
      skill: "grammar",
      level: "B2",
      question: "Had I known about the problem, I ___ you.",
      options: ["would help", "would have helped", "will help", "helped"],
      correctAnswer: "would have helped",
      explanation: "Third conditional: 'Had I known... I would have + past participle'.",
      points: 2,
    },
    {
      id: "q_17",
      type: "multiple_choice",
      skill: "grammar",
      level: "B2",
      question: "The report ___ by the time you arrive.",
      options: ["will finish", "will be finished", "will have been finished", "finishes"],
      correctAnswer: "will have been finished",
      explanation: "Future perfect passive: action completed before a future point.",
      points: 2,
    },
    {
      id: "q_18",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "B2",
      question: "The company decided to ___ the project due to budget constraints.",
      options: ["carry out", "call off", "bring up", "break down"],
      correctAnswer: "call off",
      explanation: "'Call off' means to cancel. 'Carry out' means to execute/do.",
      points: 2,
    },
    {
      id: "q_19",
      type: "multiple_choice",
      skill: "grammar",
      level: "B2",
      question: "He denied ___ the money from the safe.",
      options: ["to take", "taking", "take", "taken"],
      correctAnswer: "taking",
      explanation: "'Deny' is followed by the gerund (-ing form).",
      points: 2,
    },
    {
      id: "q_20",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "B2",
      question: "If someone 'turns a blind eye' to something, they:",
      options: ["Look carefully", "Ignore it deliberately", "Cannot see it", "Are confused"],
      correctAnswer: "Ignore it deliberately",
      explanation: "'Turn a blind eye' is an idiom meaning to pretend not to notice.",
      points: 2,
    },

    // ============================================================================
    // C1 Level Questions (Advanced) - 5 questions
    // ============================================================================
    {
      id: "q_21",
      type: "multiple_choice",
      skill: "grammar",
      level: "C1",
      question: "___ the circumstances, the decision was entirely justified.",
      options: ["Given", "Giving", "Having given", "To give"],
      correctAnswer: "Given",
      explanation: "'Given' functions as a preposition meaning 'considering' or 'taking into account'.",
      points: 3,
    },
    {
      id: "q_22",
      type: "multiple_choice",
      skill: "grammar",
      level: "C1",
      question: "Not until she left ___ how much she meant to me.",
      options: ["I realized", "did I realize", "I did realize", "realized I"],
      correctAnswer: "did I realize",
      explanation: "Inversion is required after negative adverbial phrases like 'Not until'.",
      points: 3,
    },
    {
      id: "q_23",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "C1",
      question: "The politician's speech was full of ___ promises.",
      options: ["hollow", "empty", "vacant", "void"],
      correctAnswer: "hollow",
      explanation: "'Hollow promises' is a fixed collocation meaning insincere promises.",
      points: 3,
    },
    {
      id: "q_24",
      type: "multiple_choice",
      skill: "grammar",
      level: "C1",
      question: "No sooner ___ the phone down than it rang again.",
      options: ["I had put", "had I put", "I put", "did I put"],
      correctAnswer: "had I put",
      explanation: "'No sooner' requires inversion: 'No sooner had I... than...'",
      points: 3,
    },
    {
      id: "q_25",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "C1",
      question: "The new evidence ___ all our previous theories.",
      options: ["undermines", "underlines", "understands", "undertakes"],
      correctAnswer: "undermines",
      explanation: "'Undermine' means to weaken or damage. 'Underline' means to emphasize.",
      points: 3,
    },

    // ============================================================================
    // C2 Level Questions (Proficiency) - 5 questions
    // ============================================================================
    {
      id: "q_26",
      type: "multiple_choice",
      skill: "grammar",
      level: "C2",
      question: "It is imperative that he ___ present at the meeting.",
      options: ["is", "be", "was", "were"],
      correctAnswer: "be",
      explanation: "Subjunctive mood after 'imperative that' - base form without 'to'.",
      points: 3,
    },
    {
      id: "q_27",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "C2",
      question: "The artist's work is characterized by its ___ use of color.",
      options: ["judicious", "judicial", "judiciary", "judgemental"],
      correctAnswer: "judicious",
      explanation: "'Judicious' means showing good judgment. 'Judicial' relates to courts/law.",
      points: 3,
    },
    {
      id: "q_28",
      type: "multiple_choice",
      skill: "grammar",
      level: "C2",
      question: "Were she ___ more diligent, she would have succeeded.",
      options: ["be", "to be", "being", "been"],
      correctAnswer: "to be",
      explanation: "Inverted conditional: 'Were + subject + to be' replaces 'If she had been'.",
      points: 3,
    },
    {
      id: "q_29",
      type: "multiple_choice",
      skill: "vocabulary",
      level: "C2",
      question: "The ___ of the treaty was celebrated across the continent.",
      options: ["ratification", "rectification", "ramification", "reification"],
      correctAnswer: "ratification",
      explanation: "'Ratification' means formal approval. 'Rectification' means correction.",
      points: 3,
    },
    {
      id: "q_30",
      type: "multiple_choice",
      skill: "grammar",
      level: "C2",
      question: "Little ___ that his discovery would revolutionize medicine.",
      options: ["he knew", "did he know", "he did know", "knew he"],
      correctAnswer: "did he know",
      explanation: "After 'Little' at the start of a sentence, inversion is required.",
      points: 3,
    },
  ];
}
