import { v } from "convex/values";
import { query } from "./_generated/server";

// Get stats for viewing a teacher's dashboard
export const getTeacherStats = query({
  args: {
    teacherId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    // Get scheduled lessons created by this teacher
    const allScheduledLessons = await ctx.db
      .query("scheduledLessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    const scheduledLessons = allScheduledLessons.filter(l => l.createdBy === args.teacherId || l.teacherId === args.teacherId);

    // Get virtual lessons created by this teacher
    const allVirtualLessons = await ctx.db
      .query("virtualLessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    const virtualLessons = allVirtualLessons.filter(l => l.createdBy === args.teacherId);

    // Get quizzes/tests created by this teacher
    const allQuizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    const quizzes = allQuizzes.filter(q => q.createdBy === args.teacherId);

    // Get groups managed by this teacher
    const allGroups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    const groups = allGroups.filter(g => g.teacherId === args.teacherId);

    // Count students in teacher's groups
    let assignedStudents = 0;
    for (const group of groups) {
      assignedStudents += group.currentStudentCount || 0;
    }

    return {
      assignedStudents,
      lessonsCreated: scheduledLessons.length + virtualLessons.length,
      testsCreated: quizzes.length,
      groupsManaged: groups.length,
    };
  },
});

// Get stats for viewing a student's dashboard
export const getStudentStats = query({
  args: {
    studentId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    // Get the student record
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      return {
        completedTests: 0,
        averageScore: 0,
        completedLessons: 0,
        inProgressLessons: 0,
      };
    }

    // Get test sessions for this student (using company index + filter since userId is a union type)
    const allTestSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    const testSessions = allTestSessions.filter(s => s.userId === args.studentId);

    const completedTests = testSessions.filter(s => s.status === 'completed').length;
    const totalScore = testSessions
      .filter(s => s.status === 'completed' && s.percentageScore !== undefined)
      .reduce((sum, s) => sum + (s.percentageScore || 0), 0);
    const averageScore = completedTests > 0 ? Math.round(totalScore / completedTests) : 0;

    // Get lesson progress (using company index + filter since userId is a union type)
    const allLessonProgress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    const lessonProgress = allLessonProgress.filter(p => p.userId === args.studentId);

    const completedLessons = lessonProgress.filter(p => p.status === 'completed').length;
    const inProgressLessons = lessonProgress.filter(p => p.status === 'in_progress').length;

    return {
      completedTests,
      averageScore,
      completedLessons,
      inProgressLessons,
      currentLevel: student.currentLevel,
      totalScore: student.totalScore || 0,
    };
  },
});

export const getDashboardStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    const totalEmployees = users.length;
    const activeEmployees = users.filter(u => u.isActive).length;

    const activeUsers = users.filter(u => u.isActive);
    let totalScoreSum = 0;
    let completedTestsSum = 0;

    for (const user of activeUsers) {
      if (user.totalScore !== undefined) {
        totalScoreSum += user.totalScore;
      }
      if (user.completedTests !== undefined) {
        completedTestsSum += user.completedTests;
      }
    }

    const averageScore = activeUsers.length > 0 ? totalScoreSum / activeUsers.length : 0;

    const totalGroups = Math.ceil(activeEmployees / 10);

    const pendingInvitations = users.filter(u => !u.isActive).length;

    return {
      totalEmployees,
      activeEmployees,
      totalGroups,
      averageScore: Math.round(averageScore),
      completedTests: completedTestsSum,
      pendingInvitations,
    };
  },
});
