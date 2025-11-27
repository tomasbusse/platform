import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Helper function for student progress analytics (reusable within queries)
async function getStudentProgressAnalyticsHelper(ctx: QueryCtx, userId: string, companyId: string) {
  // Get user
  const user = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("_id"), userId))
    .first();

  if (!user) {
    throw new Error("User not found");
  }

  // Get progress data
  const progress = await ctx.db
    .query("progress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // Get all test sessions for the user
  const testSessions = await ctx.db
    .query("testSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "completed"))
    .collect();

  // Calculate skill scores from test sessions
  const skillTotals = {
    grammar: 0,
    vocabulary: 0,
    reading: 0,
    listening: 0,
    writing: 0,
    speaking: 0,
  };
  const skillCounts = {
    grammar: 0,
    vocabulary: 0,
    reading: 0,
    listening: 0,
    writing: 0,
    speaking: 0,
  };

  for (const session of testSessions) {
    if (session.skillBreakdown) {
      for (const [skill, score] of Object.entries(session.skillBreakdown)) {
        if (skill in skillTotals) {
          skillTotals[skill as keyof typeof skillTotals] += score as number;
          skillCounts[skill as keyof typeof skillCounts] += 1;
        }
      }
    }
  }

  const skillScores = {
    grammar: skillCounts.grammar > 0 ? skillTotals.grammar / skillCounts.grammar : 0,
    vocabulary: skillCounts.vocabulary > 0 ? skillTotals.vocabulary / skillCounts.vocabulary : 0,
    reading: skillCounts.reading > 0 ? skillTotals.reading / skillCounts.reading : 0,
    listening: skillCounts.listening > 0 ? skillTotals.listening / skillCounts.listening : 0,
    writing: skillCounts.writing > 0 ? skillTotals.writing / skillCounts.writing : 0,
    speaking: skillCounts.speaking > 0 ? skillTotals.speaking / skillCounts.speaking : 0,
  };

  // Calculate test history trends
  const testHistory = testSessions
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((session) => ({
      testId: session.testId,
      sessionId: session._id,
      score: session.percentageScore || 0,
      level: session.recommendedLevel || "Not Assessed",
      date: session.createdAt,
    }));

  // Identify strengths and weaknesses
  const skillEntries = Object.entries(skillScores).sort(([, a], [, b]) => b - a);
  const strengths = skillEntries.slice(0, 3).map(([skill]) => skill);
  const weaknesses = skillEntries.slice(-3).map(([skill]) => skill);

  // Calculate improvement rate
  let improvementRate = 0;
  if (testHistory.length >= 2) {
    const firstScore = testHistory[0].score;
    const lastScore = testHistory[testHistory.length - 1].score;
    improvementRate = lastScore - firstScore;
  }

  return {
    userId,
    userName: user.name,
    currentLevel: user.currentLevel || "Not Assessed",
    overallScore: user.averageScore,
    totalTests: user.completedTests,
    skillScores,
    testHistory,
    strengths,
    weaknesses,
    improvementRate,
    streakDays: progress?.streakDays || 0,
    lastActivity: progress?.lastActivity || user.lastLogin || user.createdAt,
  };
}

// Business Intelligence Queries

export const getBusinessIntelligenceMetrics = query({
  args: {
    companyId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { companyId, startDate, endDate } = args;

    // Get company info
    const company = await ctx.db
      .query("companies")
      .filter((q) => q.eq(q.field("_id"), companyId))
      .first();

    if (!company) {
      throw new Error("Company not found");
    }

    // Get all students for the company
    const allStudents = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("role"), "student"))
      .collect();

    const activeStudents = allStudents.filter((s) => s.isActive);

    // Get test sessions within date range
    const testSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), startDate),
          q.lte(q.field("createdAt"), endDate),
          q.eq(q.field("status"), "completed")
        )
      )
      .collect();

    // Calculate metrics
    const totalRevenuePotential = activeStudents.length * 100; // Assuming $100 per student
    const completionRate = testSessions.length > 0
      ? (testSessions.filter((s) => s.status === "completed").length / testSessions.length) * 100
      : 0;

    // Average scores by level
    const scoresByLevel: Record<string, { total: number; count: number }> = {};
    for (const session of testSessions) {
      if (session.recommendedLevel && session.percentageScore) {
        if (!scoresByLevel[session.recommendedLevel]) {
          scoresByLevel[session.recommendedLevel] = { total: 0, count: 0 };
        }
        scoresByLevel[session.recommendedLevel].total += session.percentageScore;
        scoresByLevel[session.recommendedLevel].count += 1;
      }
    }

    const averageScoresByLevel = Object.entries(scoresByLevel).map(([level, data]) => ({
      level,
      averageScore: data.count > 0 ? data.total / data.count : 0,
      studentCount: data.count,
    }));

    // Student distribution by level
    const studentDistribution: Record<string, number> = {};
    for (const student of activeStudents) {
      const level = student.currentLevel || "Not Assessed";
      studentDistribution[level] = (studentDistribution[level] || 0) + 1;
    }

    return {
      totalActiveStudents: activeStudents.length,
      totalStudents: allStudents.length,
      revenuePotential: totalRevenuePotential,
      completionRate,
      totalTestsSessions: testSessions.length,
      averageScoresByLevel,
      studentDistribution: Object.entries(studentDistribution).map(([level, count]) => ({
        level,
        count,
      })),
      isActive: company.isActive,
    };
  },
});

export const getCompanyPerformanceTrends = query({
  args: {
    companyId: v.string(),
    months: v.number(), // Number of months to look back
  },
  handler: async (ctx, args) => {
    const { companyId, months } = args;

    const now = Date.now();
    const startDate = now - months * 30 * 24 * 60 * 60 * 1000; // Approximate months

    // Get all test sessions in the period
    const testSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), startDate),
          q.eq(q.field("status"), "completed")
        )
      )
      .collect();

    // Get all users created in the period
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), startDate),
          q.eq(q.field("role"), "student")
        )
      )
      .collect();

    // Group by month
    const monthlyData: Record<
      string,
      {
        enrollments: number;
        completions: number;
        totalScore: number;
        scoreCount: number;
        activeUsers: Set<string>;
      }
    > = {};

    // Process enrollments
    for (const user of users) {
      if (!user.createdAt) continue;
      const monthKey = new Date(user.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          enrollments: 0,
          completions: 0,
          totalScore: 0,
          scoreCount: 0,
          activeUsers: new Set(),
        };
      }
      monthlyData[monthKey].enrollments += 1;
    }

    // Process test sessions
    for (const session of testSessions) {
      const monthKey = new Date(session.createdAt).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          enrollments: 0,
          completions: 0,
          totalScore: 0,
          scoreCount: 0,
          activeUsers: new Set(),
        };
      }
      monthlyData[monthKey].completions += 1;
      if (session.percentageScore) {
        monthlyData[monthKey].totalScore += session.percentageScore;
        monthlyData[monthKey].scoreCount += 1;
      }
      monthlyData[monthKey].activeUsers.add(session.userId as string);
    }

    // Format results
    const trends = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        enrollments: data.enrollments,
        completions: data.completions,
        averageScore: data.scoreCount > 0 ? data.totalScore / data.scoreCount : 0,
        activeUsers: data.activeUsers.size,
      }));

    return trends;
  },
});

// Student Analytics Queries

export const getStudentProgressAnalytics = query({
  args: {
    userId: v.string(),
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    return getStudentProgressAnalyticsHelper(ctx, args.userId, args.companyId);
  },
});

export const getStudentSkillComparison = query({
  args: {
    userId: v.string(),
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, companyId } = args;

    // Get student's analytics
    const studentAnalytics = await getStudentProgressAnalyticsHelper(ctx, userId, companyId);

    // Get all students in the company at the same level
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const sameLevel = user.currentLevel;
    const levelStudents = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "student"),
          q.eq(q.field("currentLevel"), sameLevel)
        )
      )
      .collect();

    // Calculate company averages
    const allStudents = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("role"), "student"))
      .collect();

    // Get all test sessions for company students
    const allTestSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Calculate company skill averages
    const companySkillTotals = {
      grammar: 0,
      vocabulary: 0,
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
    };
    const companySkillCounts = {
      grammar: 0,
      vocabulary: 0,
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
    };

    for (const session of allTestSessions) {
      if (session.skillBreakdown) {
        for (const [skill, score] of Object.entries(session.skillBreakdown)) {
          if (skill in companySkillTotals) {
            companySkillTotals[skill as keyof typeof companySkillTotals] += score as number;
            companySkillCounts[skill as keyof typeof companySkillCounts] += 1;
          }
        }
      }
    }

    const companyAverages = {
      grammar: companySkillCounts.grammar > 0 ? companySkillTotals.grammar / companySkillCounts.grammar : 0,
      vocabulary: companySkillCounts.vocabulary > 0 ? companySkillTotals.vocabulary / companySkillCounts.vocabulary : 0,
      reading: companySkillCounts.reading > 0 ? companySkillTotals.reading / companySkillCounts.reading : 0,
      listening: companySkillCounts.listening > 0 ? companySkillTotals.listening / companySkillCounts.listening : 0,
      writing: companySkillCounts.writing > 0 ? companySkillTotals.writing / companySkillCounts.writing : 0,
      speaking: companySkillCounts.speaking > 0 ? companySkillTotals.speaking / companySkillCounts.speaking : 0,
    };

    // Calculate level averages
    const levelTestSessions = allTestSessions.filter((s) => s.recommendedLevel === sameLevel);
    const levelSkillTotals = {
      grammar: 0,
      vocabulary: 0,
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
    };
    const levelSkillCounts = {
      grammar: 0,
      vocabulary: 0,
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
    };

    for (const session of levelTestSessions) {
      if (session.skillBreakdown) {
        for (const [skill, score] of Object.entries(session.skillBreakdown)) {
          if (skill in levelSkillTotals) {
            levelSkillTotals[skill as keyof typeof levelSkillTotals] += score as number;
            levelSkillCounts[skill as keyof typeof levelSkillCounts] += 1;
          }
        }
      }
    }

    const levelAverages = {
      grammar: levelSkillCounts.grammar > 0 ? levelSkillTotals.grammar / levelSkillCounts.grammar : 0,
      vocabulary: levelSkillCounts.vocabulary > 0 ? levelSkillTotals.vocabulary / levelSkillCounts.vocabulary : 0,
      reading: levelSkillCounts.reading > 0 ? levelSkillTotals.reading / levelSkillCounts.reading : 0,
      listening: levelSkillCounts.listening > 0 ? levelSkillTotals.listening / levelSkillCounts.listening : 0,
      writing: levelSkillCounts.writing > 0 ? levelSkillTotals.writing / levelSkillCounts.writing : 0,
      speaking: levelSkillCounts.speaking > 0 ? levelSkillTotals.speaking / levelSkillCounts.speaking : 0,
    };

    return {
      studentScores: studentAnalytics.skillScores,
      companyAverages,
      levelAverages,
      levelName: sameLevel,
      totalLevelStudents: levelStudents.length,
      totalCompanyStudents: allStudents.length,
    };
  },
});

export const getStudentCohortAnalysis = query({
  args: {
    companyId: v.string(),
    cohortStartDate: v.number(),
    cohortEndDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { companyId, cohortStartDate, cohortEndDate } = args;

    // Get students enrolled in the cohort period
    const cohortStudents = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "student"),
          q.gte(q.field("createdAt"), cohortStartDate),
          q.lte(q.field("createdAt"), cohortEndDate)
        )
      )
      .collect();

    const cohortUserIds = cohortStudents.map((s) => s._id);

    // Get all test sessions for cohort students
    const testSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const cohortSessions = testSessions.filter((s) =>
      cohortUserIds.includes(s.userId as Id<"users">)
    );

    // Calculate cohort metrics
    const totalStudents = cohortStudents.length;
    const activeStudents = cohortStudents.filter((s) => s.isActive).length;
    const totalTests = cohortSessions.length;
    const averageTestsPerStudent = totalStudents > 0 ? totalTests / totalStudents : 0;

    const totalScore = cohortSessions.reduce((sum, s) => sum + (s.percentageScore || 0), 0);
    const averageScore = cohortSessions.length > 0 ? totalScore / cohortSessions.length : 0;

    // Performance over time
    const performanceByMonth: Record<string, { total: number; count: number }> = {};
    for (const session of cohortSessions) {
      const monthKey = new Date(session.createdAt).toISOString().slice(0, 7);
      if (!performanceByMonth[monthKey]) {
        performanceByMonth[monthKey] = { total: 0, count: 0 };
      }
      performanceByMonth[monthKey].total += session.percentageScore || 0;
      performanceByMonth[monthKey].count += 1;
    }

    const performanceTrend = Object.entries(performanceByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        averageScore: data.count > 0 ? data.total / data.count : 0,
      }));

    return {
      cohortPeriod: {
        startDate: cohortStartDate,
        endDate: cohortEndDate,
      },
      totalStudents,
      activeStudents,
      retentionRate: totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0,
      totalTests,
      averageTestsPerStudent,
      averageScore,
      performanceTrend,
    };
  },
});

// Teacher Performance Queries

export const getTeacherPerformanceMetrics = query({
  args: {
    teacherId: v.optional(v.string()),
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    const { teacherId, companyId } = args;

    // If teacherId is provided, get metrics for that teacher, otherwise get all teachers
    const teachers = teacherId
      ? [
          await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("_id"), teacherId))
            .first(),
        ].filter(Boolean)
      : await ctx.db
          .query("users")
          .withIndex("by_company", (q) => q.eq("companyId", companyId))
          .filter((q) => q.eq(q.field("role"), "teacher"))
          .collect();

    const teacherMetrics = [];

    for (const teacher of teachers) {
      if (!teacher) continue;

      // Get quizzes created by teacher
      const quizzes = await ctx.db
        .query("quizzes")
        .withIndex("by_created_by", (q) => q.eq("createdBy", teacher._id))
        .collect();

      // Get quiz assignments by teacher
      const assignments = await ctx.db
        .query("quizAssignments")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .filter((q) => q.eq(q.field("assignedBy"), teacher._id))
        .collect();

      // Get all students assigned to this teacher (from assignments)
      const studentIds = new Set<string>();
      for (const assignment of assignments) {
        assignment.assignedTo.forEach((id) => studentIds.add(id));
      }

      // Get test sessions for teacher's quizzes
      const teacherQuizIds = quizzes.map((q) => q._id);
      const testSessions = await ctx.db
        .query("testSessions")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

      const teacherSessions = testSessions.filter(
        (s) => s.quizId && teacherQuizIds.includes(s.quizId)
      );

      // Calculate student improvement
      const studentImprovements: number[] = [];
      for (const studentId of Array.from(studentIds)) {
        const studentSessions = testSessions
          .filter((s) => s.userId === studentId)
          .sort((a, b) => a.createdAt - b.createdAt);

        if (studentSessions.length >= 2) {
          const firstScore = studentSessions[0].percentageScore || 0;
          const lastScore = studentSessions[studentSessions.length - 1].percentageScore || 0;
          studentImprovements.push(lastScore - firstScore);
        }
      }

      const averageImprovement =
        studentImprovements.length > 0
          ? studentImprovements.reduce((sum, val) => sum + val, 0) / studentImprovements.length
          : 0;

      // Assignment completion rate
      const totalAssignments = assignments.length;
      const completedAssignments = assignments.filter((a) => a.status === "completed").length;
      const completionRate =
        totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

      teacherMetrics.push({
        teacherId: teacher._id,
        teacherName: teacher.name,
        totalStudents: studentIds.size,
        quizzesCreated: quizzes.length,
        publishedQuizzes: quizzes.filter((q) => q.status === "published").length,
        totalAssignments,
        completedAssignments,
        completionRate,
        averageStudentImprovement: averageImprovement,
        totalTestSessions: teacherSessions.length,
        averageQuizScore:
          teacherSessions.length > 0
            ? teacherSessions.reduce((sum, s) => sum + (s.percentageScore || 0), 0) /
              teacherSessions.length
            : 0,
      });
    }

    return teacherMetrics;
  },
});

export const getTeacherContentEffectiveness = query({
  args: {
    teacherId: v.string(),
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    const { teacherId, companyId } = args;

    // Get teacher's quizzes
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_created_by", (q) => q.eq("createdBy", teacherId))
      .collect();

    const quizEffectiveness = [];

    for (const quiz of quizzes) {
      // Get test sessions for this quiz
      const sessions = await ctx.db
        .query("testSessions")
        .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .collect();

      const totalAttempts = sessions.length;
      const averageScore =
        totalAttempts > 0
          ? sessions.reduce((sum, s) => sum + (s.percentageScore || 0), 0) / totalAttempts
          : 0;

      const averageTimeSpent =
        totalAttempts > 0
          ? sessions.reduce(
              (sum, s) =>
                sum + ((s.completedAt || s.updatedAt) - s.startedAt) / (1000 * 60),
              0
            ) / totalAttempts
          : 0;

      quizEffectiveness.push({
        quizId: quiz._id,
        quizTitle: quiz.title,
        testPurpose: quiz.testPurpose,
        skillFocus: quiz.skillFocus,
        level: quiz.level,
        totalAttempts,
        averageScore,
        averageTimeSpent, // in minutes
        status: quiz.status,
      });
    }

    // Sort by effectiveness (combination of attempts and score)
    quizEffectiveness.sort((a, b) => {
      const scoreA = a.totalAttempts * a.averageScore;
      const scoreB = b.totalAttempts * b.averageScore;
      return scoreB - scoreA;
    });

    return quizEffectiveness;
  },
});

export const getTeacherWorkloadAnalysis = query({
  args: {
    teacherId: v.string(),
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    const { teacherId, companyId } = args;

    // Get active assignments
    const assignments = await ctx.db
      .query("quizAssignments")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("assignedBy"), teacherId))
      .collect();

    const activeAssignments = assignments.filter((a) => a.status === "active");
    const draftAssignments = assignments.filter((a) => a.status === "draft");
    const completedAssignments = assignments.filter((a) => a.status === "completed");

    // Get unique students
    const studentIds = new Set<string>();
    for (const assignment of assignments) {
      assignment.assignedTo.forEach((id) => studentIds.add(id));
    }

    // Get quizzes created
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_created_by", (q) => q.eq("createdBy", teacherId))
      .collect();

    // Pending grading (completed sessions without full evaluation)
    const teacherQuizIds = quizzes.map((q) => q._id);
    const recentSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const pendingGrading = recentSessions.filter(
      (s) => s.quizId && teacherQuizIds.includes(s.quizId) && !s.percentageScore
    ).length;

    return {
      activeStudents: studentIds.size,
      activeAssignments: activeAssignments.length,
      draftAssignments: draftAssignments.length,
      completedAssignments: completedAssignments.length,
      quizzesCreated: quizzes.length,
      publishedQuizzes: quizzes.filter((q) => q.status === "published").length,
      pendingGrading,
      workloadScore: studentIds.size * 2 + activeAssignments.length + pendingGrading, // Simple workload calculation
    };
  },
});

// Content Analytics Queries

export const getQuizPerformanceAnalytics = query({
  args: {
    quizId: v.optional(v.id("quizzes")),
    companyId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { quizId, companyId, startDate, endDate } = args;

    let quizzes: Doc<"quizzes">[];
    if (quizId) {
      const quiz = await ctx.db.get(quizId);
      quizzes = quiz ? [quiz] : [];
    } else {
      quizzes = await ctx.db
        .query("quizzes")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect();
    }

    const quizAnalytics = [];

    for (const quiz of quizzes) {
      let sessionsQuery = ctx.db
        .query("testSessions")
        .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
        .filter((q) => q.eq(q.field("status"), "completed"));

      const sessions = await sessionsQuery.collect();

      const filteredSessions = sessions.filter((s) => {
        if (startDate && s.createdAt < startDate) return false;
        if (endDate && s.createdAt > endDate) return false;
        return true;
      });

      const totalAttempts = filteredSessions.length;
      const averageScore =
        totalAttempts > 0
          ? filteredSessions.reduce((sum, s) => sum + (s.percentageScore || 0), 0) /
            totalAttempts
          : 0;

      const averageCompletionTime =
        totalAttempts > 0
          ? filteredSessions.reduce(
              (sum, s) =>
                sum + ((s.completedAt || s.updatedAt) - s.startedAt) / (1000 * 60),
              0
            ) / totalAttempts
          : 0;

      quizAnalytics.push({
        quizId: quiz._id,
        quizTitle: quiz.title,
        level: quiz.level,
        skillFocus: quiz.skillFocus,
        totalAttempts,
        averageScore,
        averageCompletionTime, // in minutes
        passRate:
          totalAttempts > 0
            ? (filteredSessions.filter((s) => (s.percentageScore || 0) >= quiz.passingScore)
                .length /
                totalAttempts) *
              100
            : 0,
      });
    }

    return quizAnalytics;
  },
});

export const getQuestionBankAnalytics = query({
  args: {
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    const { companyId } = args;

    const questions = await ctx.db
      .query("questionBank")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Group by skill
    const bySkill: Record<
      string,
      { count: number; totalUsage: number; avgScore: number }
    > = {};
    const byLevel: Record<
      string,
      { count: number; totalUsage: number; avgScore: number }
    > = {};
    const byDifficulty: Record<
      string,
      { count: number; totalUsage: number; avgScore: number }
    > = {};

    for (const question of questions) {
      // By skill
      if (!bySkill[question.skill]) {
        bySkill[question.skill] = { count: 0, totalUsage: 0, avgScore: 0 };
      }
      bySkill[question.skill].count += 1;
      bySkill[question.skill].totalUsage += question.usageCount;
      bySkill[question.skill].avgScore += question.averageScore;

      // By level
      if (!byLevel[question.level]) {
        byLevel[question.level] = { count: 0, totalUsage: 0, avgScore: 0 };
      }
      byLevel[question.level].count += 1;
      byLevel[question.level].totalUsage += question.usageCount;
      byLevel[question.level].avgScore += question.averageScore;

      // By difficulty
      if (!byDifficulty[question.difficulty]) {
        byDifficulty[question.difficulty] = { count: 0, totalUsage: 0, avgScore: 0 };
      }
      byDifficulty[question.difficulty].count += 1;
      byDifficulty[question.difficulty].totalUsage += question.usageCount;
      byDifficulty[question.difficulty].avgScore += question.averageScore;
    }

    // Calculate averages
    for (const skill in bySkill) {
      bySkill[skill].avgScore = bySkill[skill].count > 0 ? bySkill[skill].avgScore / bySkill[skill].count : 0;
    }
    for (const level in byLevel) {
      byLevel[level].avgScore = byLevel[level].count > 0 ? byLevel[level].avgScore / byLevel[level].count : 0;
    }
    for (const difficulty in byDifficulty) {
      byDifficulty[difficulty].avgScore =
        byDifficulty[difficulty].count > 0
          ? byDifficulty[difficulty].avgScore / byDifficulty[difficulty].count
          : 0;
    }

    // Find most and least used questions
    const sortedByUsage = [...questions].sort((a, b) => b.usageCount - a.usageCount);
    const mostUsed = sortedByUsage.slice(0, 10).map((q) => ({
      questionId: q._id,
      questionText: q.questionText.substring(0, 100),
      skill: q.skill,
      level: q.level,
      usageCount: q.usageCount,
      averageScore: q.averageScore,
    }));
    const leastUsed = sortedByUsage
      .slice(-10)
      .reverse()
      .map((q) => ({
        questionId: q._id,
        questionText: q.questionText.substring(0, 100),
        skill: q.skill,
        level: q.level,
        usageCount: q.usageCount,
        averageScore: q.averageScore,
      }));

    return {
      totalQuestions: questions.length,
      bySkill: Object.entries(bySkill).map(([skill, data]) => ({
        skill,
        ...data,
      })),
      byLevel: Object.entries(byLevel).map(([level, data]) => ({
        level,
        ...data,
      })),
      byDifficulty: Object.entries(byDifficulty).map(([difficulty, data]) => ({
        difficulty,
        ...data,
      })),
      mostUsed,
      leastUsed,
    };
  },
});
