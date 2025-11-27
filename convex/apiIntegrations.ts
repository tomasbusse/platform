import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Cambridge English API Integration
export const cambridgeEnglishAPI = {
  // Create a new test session with Cambridge
  createTestSession: mutation({
    args: {
      userId: v.id("users"),
      companyId: v.id("companies"),
      testType: v.string(),
      level: v.string(),
    },
    handler: async (ctx, args) => {
      // Get user's Cambridge API configuration
      const company = await ctx.db.get(args.companyId);
      const cambridgeApiKey = company?.settings?.cambridgeApiKey;
      
      if (!cambridgeApiKey) {
        throw new Error("Cambridge English API key not configured");
      }

      // Create session with Cambridge English API
      const sessionData = {
        candidateId: args.userId,
        testType: args.testType,
        level: args.level,
        startTime: new Date().toISOString(),
        timeLimit: 60, // minutes
      };

      // Mock Cambridge API call (replace with actual API integration)
      const cambridgeResponse = {
        sessionId: `camb_${Date.now()}`,
        accessToken: `token_${Math.random().toString(36)}`,
        questions: [
          {
            id: "q1",
            type: "multiple_choice",
            question: "Choose the correct answer: I ____ to the store yesterday.",
            options: ["go", "went", "going", "goes"],
            correctAnswer: "went",
            audioUrl: null,
          },
          {
            id: "q2", 
            type: "listening",
            question: "Listen to the audio and choose the correct word.",
            audioUrl: "https://example.com/audio/exercise1.mp3",
            options: ["rain", "train", "plain", "chain"],
            correctAnswer: "rain",
          }
        ],
      };

      // Store session in database
      const sessionId = await ctx.db.insert("testSessions", {
        testId: `cambridge_${args.testType}_${args.level}`,
        userId: args.userId,
        companyId: args.companyId,
        cambridgeSessionId: cambridgeResponse.sessionId,
        cambridgeAccessToken: cambridgeResponse.accessToken,
        status: "in_progress",
        startedAt: Date.now(),
        totalQuestions: cambridgeResponse.questions.length,
        questionsAnswered: 0,
        customQuestions: cambridgeResponse.questions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        sessionId,
        cambridgeSessionId: cambridgeResponse.sessionId,
        questions: cambridgeResponse.questions,
        timeLimit: sessionData.timeLimit,
      };
    },
  }),

  // Submit answers to Cambridge
  submitAnswers: mutation({
    args: {
      sessionId: v.id("testSessions"),
      answers: v.array(v.object({
        questionId: v.string(),
        answer: v.string(),
        timeSpent: v.number(),
      })),
    },
    handler: async (ctx, args) => {
      const session = await ctx.db.get(args.sessionId);
      if (!session) {
        throw new Error("Test session not found");
      }

      // Update session with answers
      await ctx.db.patch(args.sessionId, {
        answers: args.answers,
        questionsAnswered: args.answers.length,
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Calculate score
      const correctAnswers = args.answers.filter(answer => {
        const question = session.customQuestions?.find((q: any) => q.id === answer.questionId);
        return question && question.correctAnswer === answer.answer;
      }).length;

      const totalQuestions = session.totalQuestions || args.answers.length;
      const percentageScore = Math.round((correctAnswers / totalQuestions) * 100);
      const totalScore = percentageScore;

      // Determine level based on score
      let recommendedLevel = "A1";
      if (percentageScore >= 90) recommendedLevel = "C2";
      else if (percentageScore >= 80) recommendedLevel = "C1";
      else if (percentageScore >= 70) recommendedLevel = "B2";
      else if (percentageScore >= 60) recommendedLevel = "B1";
      else if (percentageScore >= 50) recommendedLevel = "A2";

      // Update session with results
      await ctx.db.patch(args.sessionId, {
        totalScore,
        maxScore: 100,
        percentageScore,
        recommendedLevel,
      });

      // Update user's progress
      await updateUserProgress(ctx, session.userId, percentageScore, recommendedLevel);

      return {
        score: totalScore,
        percentageScore,
        level: recommendedLevel,
        correctAnswers,
        totalQuestions,
      };
    },
  }),
};

// OpenRouter AI Content Generation
export const openRouterAPI = {
  // Generate AI content for lessons
  generateContent: mutation({
    args: {
      companyId: v.id("companies"),
      createdBy: v.id("users"),
      type: v.string(),
      level: v.string(),
      topic: v.optional(v.string()),
      prompt: v.string(),
    },
    handler: async (ctx, args) => {
      const company = await ctx.db.get(args.companyId);
      const openRouterApiKey = company?.settings?.openRouterApiKey;
      
      if (!openRouterApiKey) {
        throw new Error("OpenRouter API key not configured");
      }

      // Mock OpenRouter API call (replace with actual API integration)
      const aiResponse = {
        content: `This is AI-generated ${args.type} content for ${args.level} level. 
        Topic: ${args.topic || 'General'}
        
        ${args.prompt}

        Here's an engaging exercise for ${args.level} level students:
        1. Read the following passage...
        2. Answer the comprehension questions...
        3. Practice the key vocabulary...`,
        wordCount: 150,
        topics: [args.topic || 'General', 'English Learning'],
        model: "claude-3-sonnet",
        generatedAt: Date.now(),
      };

      // Store AI content
      const contentId = await ctx.db.insert("aiContent", {
        companyId: args.companyId,
        createdBy: args.createdBy,
        type: args.type as "lesson" | "quiz" | "exercise",
        level: args.level,
        topic: args.topic,
        prompt: args.prompt,
        generatedContent: aiResponse.content,
        model: aiResponse.model,
        wordCount: aiResponse.wordCount,
        topics: aiResponse.topics,
        reviewStatus: "pending" as const,
        isUsed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        contentId,
        content: aiResponse.content,
        metadata: {
          wordCount: aiResponse.wordCount,
          topics: aiResponse.topics,
          model: aiResponse.model,
        },
      };
    },
  }),

  // Generate quiz questions
  generateQuiz: mutation({
    args: {
      companyId: v.id("companies"),
      createdBy: v.id("users"),
      level: v.string(),
      content: v.string(),
      questionCount: v.number(),
    },
    handler: async (ctx, args) => {
      const company = await ctx.db.get(args.companyId);
      const openRouterApiKey = company?.settings?.openRouterApiKey;
      
      if (!openRouterApiKey) {
        throw new Error("OpenRouter API key not configured");
      }

      // Generate quiz questions using AI
      const questions = [];
      for (let i = 0; i < args.questionCount; i++) {
        questions.push({
          id: `ai_q_${Date.now()}_${i}`,
          type: "multiple_choice",
          question: `Question ${i + 1} about the content: What is the main topic?`,
          options: [
            "Grammar and vocabulary",
            "Reading comprehension", 
            "Writing skills",
            "Speaking practice"
          ],
          correctAnswer: "Grammar and vocabulary",
          explanation: "This question tests understanding of the key concepts covered in the lesson.",
        });
      }

      return {
        questions,
        totalQuestions: questions.length,
      };
    },
  }),
};

// ElevenLabs Audio Integration
export const elevenLabsAPI = {
  // Generate audio from text
  generateAudio: mutation({
    args: {
      companyId: v.id("companies"),
      createdBy: v.id("users"),
      text: v.string(),
      voiceId: v.string(),
      type: v.string(),
      relatedEntityId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      const company = await ctx.db.get(args.companyId);
      const elevenLabsApiKey = company?.settings?.elevenLabsApiKey;
      
      if (!elevenLabsApiKey) {
        throw new Error("ElevenLabs API key not configured");
      }

      // Mock ElevenLabs API call (replace with actual API integration)
      const audioResponse = {
        audioUrl: `https://api.elevenlabs.io/v1/audio/${Date.now()}.mp3`,
        duration: Math.ceil(args.text.length / 10), // rough estimation
        voiceName: "Professional Teacher Voice",
        quality: "standard",
      };

      // Store audio content
      const audioId = await ctx.db.insert("audioContent", {
        companyId: args.companyId,
        createdBy: args.createdBy,
        type: args.type as "lesson_audio" | "exercise_audio" | "listening_exercise",
        textContent: args.text,
        audioUrl: audioResponse.audioUrl,
        voiceId: args.voiceId,
        voiceName: audioResponse.voiceName,
        duration: audioResponse.duration,
        language: "en",
        quality: audioResponse.quality,
        relatedEntityId: args.relatedEntityId,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        audioId,
        audioUrl: audioResponse.audioUrl,
        duration: audioResponse.duration,
        voiceName: audioResponse.voiceName,
      };
    },
  }),

  // Get available voices
  getVoices: query({
    args: {
      companyId: v.id("companies"),
    },
    handler: async (ctx, args) => {
      // Mock voice list (replace with actual ElevenLabs API call)
      return [
        { id: "voice_1", name: "Professional Teacher", accent: "American", quality: "premium" },
        { id: "voice_2", name: "Friendly Tutor", accent: "British", quality: "standard" },
        { id: "voice_3", name: "Clear Instructor", accent: "Australian", quality: "standard" },
      ];
    },
  }),
};

// Resend Email Integration
export const resendAPI = {
  // Send test invitation email
  sendTestInvitation: mutation({
    args: {
      userId: v.id("users"),
      companyId: v.id("companies"),
      testId: v.string(),
      sessionId: v.id("testSessions"),
    },
    handler: async (ctx, args) => {
      const company = await ctx.db.get(args.companyId);
      const user = await ctx.db.get(args.userId);
      const resendApiKey = company?.settings?.resendApiKey;

      if (!resendApiKey) {
        throw new Error("Resend API key not configured");
      }

      if (!user) {
        throw new Error("User not found");
      }

      // Send email via Resend API
      const emailData = {
        from: "noreply@languageplatform.com",
        to: [user.email],
        subject: "English Assessment Invitation",
        html: `
          <h2>Welcome to your English Assessment</h2>
          <p>Hello ${user.name},</p>
          <p>You've been invited to take an English assessment. Please click the link below to begin:</p>
          <a href="https://yourapp.com/test/${args.sessionId}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Start Assessment
          </a>
          <p>The assessment will take approximately 30-45 minutes.</p>
          <p>Best regards,<br>Your Language Learning Team</p>
        `,
      };

      // Mock email send (replace with actual Resend API call)
      console.log("Sending email via Resend:", emailData);

      // Create notification
      await ctx.db.insert("notifications", {
        userId: args.userId,
        companyId: args.companyId,
        title: "Test Invitation Sent",
        message: "An email has been sent with your assessment invitation",
        type: "info",
        isEmailSent: true,
        emailSentAt: Date.now(),
        relatedEntityId: args.sessionId,
        relatedEntityType: "testSession",
        isRead: false,
        createdAt: Date.now(),
      });

      return { success: true, message: "Email sent successfully" };
    },
  }),

  // Send test results email
  sendTestResults: mutation({
    args: {
      userId: v.id("users"),
      companyId: v.id("companies"),
      sessionId: v.id("testSessions"),
      score: v.number(),
      level: v.string(),
    },
    handler: async (ctx, args) => {
      const company = await ctx.db.get(args.companyId);
      const user = await ctx.db.get(args.userId);
      const resendApiKey = company?.settings?.resendApiKey;

      if (!resendApiKey) {
        throw new Error("Resend API key not configured");
      }

      if (!user) {
        throw new Error("User not found");
      }

      // Send results email
      const emailData = {
        from: "noreply@languageplatform.com",
        to: [user.email],
        subject: "Your English Assessment Results",
        html: `
          <h2>Assessment Results</h2>
          <p>Hello ${user.name},</p>
          <p>Congratulations! Your English assessment has been completed. Here are your results:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #007bff; margin: 0;">Your Results</h3>
            <p><strong>Score:</strong> ${args.score}%</p>
            <p><strong>Level:</strong> ${args.level}</p>
          </div>
          <p>Based on your results, you have been assigned to the ${args.level} level group. You will receive information about your class schedule and next steps soon.</p>
          <p>Keep up the great work!</p>
          <p>Best regards,<br>Your Language Learning Team</p>
        `,
      };

      // Mock email send
      console.log("Sending results email via Resend:", emailData);

      // Create notification
      await ctx.db.insert("notifications", {
        userId: args.userId,
        companyId: args.companyId,
        title: "Assessment Results Available",
        message: `Your results are ready! You scored ${args.score}% and are at ${args.level} level.`,
        type: "success",
        isEmailSent: true,
        emailSentAt: Date.now(),
        relatedEntityId: args.sessionId,
        relatedEntityType: "testSession",
        isRead: false,
        createdAt: Date.now(),
      });

      return { success: true, message: "Results email sent successfully" };
    },
  }),
};

// Helper function to update user progress
async function updateUserProgress(
  ctx: any, 
  userId: string, 
  score: number, 
  level: string
) {
  const user = await ctx.db.get(userId);
  if (!user) return;

  // Get or create progress record
  let progress = await ctx.db
    .query("progress")
    .filter((p: any) => p.userId === userId && p.companyId === user.companyId)
    .first();

  if (!progress) {
    // Create new progress record
    await ctx.db.insert("progress", {
      userId,
      companyId: user.companyId,
      currentLevel: level,
      overallScore: score,
      totalSessions: 1,
      completedLessons: 0,
      totalLessons: 0,
      streakDays: 1,
      lastActivity: Date.now(),
      lastTestDate: Date.now(),
      testHistory: [{
        testId: "cambridge_assessment",
        sessionId: "latest",
        score,
        level,
        date: Date.now(),
      }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } else {
    // Update existing progress
    const newTestHistory = [...(progress.testHistory || []), {
      testId: "cambridge_assessment",
      sessionId: "latest",
      score,
      level,
      date: Date.now(),
    }];

    await ctx.db.patch(progress._id, {
      currentLevel: level,
      overallScore: score,
      totalSessions: (progress.totalSessions || 0) + 1,
      lastActivity: Date.now(),
      lastTestDate: Date.now(),
      testHistory: newTestHistory,
      updatedAt: Date.now(),
    });
  }

  // Update user record
  await ctx.db.patch(userId, {
    currentLevel: level,
    totalScore: score,
    completedTests: (user.completedTests || 0) + 1,
    lastLogin: Date.now(),
    updatedAt: Date.now(),
  });
}