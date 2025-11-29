import { v } from "convex/values";
import { query } from "./_generated/server";

// Get stats for viewing a teacher's dashboard
export const getTeacherStats = query({
  args: {
    teacherId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    // Get lessons created by this teacher
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("teacherId"), args.teacherId))
      .collect();

    // Get quizzes/tests created by this teacher
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("createdBy"), args.teacherId))
      .collect();

    // Get groups managed by this teacher
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("teacherId"), args.teacherId))
      .collect();

    // Count students in teacher's groups
    let assignedStudents = 0;
    for (const group of groups) {
      assignedStudents += group.currentStudentCount || 0;
    }

    return {
      assignedStudents,
      lessonsCreated: lessons.length,
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

    // Get test sessions for this student
    const testSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .collect();

    const completedTests = testSessions.filter(s => s.status === 'completed').length;
    const totalScore = testSessions
      .filter(s => s.status === 'completed' && s.score !== undefined)
      .reduce((sum, s) => sum + (s.score || 0), 0);
    const averageScore = completedTests > 0 ? Math.round(totalScore / completedTests) : 0;

    // Get lesson progress
    const lessonProgress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .collect();

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
