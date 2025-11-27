import { v } from "convex/values";
import { query } from "./_generated/server";

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
