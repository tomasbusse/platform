import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Fix duplicate user records by copying data from old user to auth user
export const fixDuplicateUser = mutation({
  args: {
    authUserId: v.id("users"),
    oldUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const authUser = await ctx.db.get(args.authUserId);
    const oldUser = await ctx.db.get(args.oldUserId);

    if (!authUser || !oldUser) {
      throw new Error("User not found");
    }

    // Copy app-specific fields from old user to auth user
    await ctx.db.patch(authUser._id, {
      role: oldUser.role,
      companyId: oldUser.companyId,
      isActive: oldUser.isActive,
      name: oldUser.name,
      totalScore: oldUser.totalScore,
      averageScore: oldUser.averageScore,
      completedTests: oldUser.completedTests,
      createdAt: oldUser.createdAt,
      updatedAt: Date.now(),
    });

    // Delete the old duplicate user
    await ctx.db.delete(oldUser._id);

    return { success: true, mergedUserId: authUser._id };
  },
});

export const getAuthData = query({
  args: {},
  handler: async (ctx) => {
    const authAccounts = await ctx.db.query("authAccounts").collect();
    const authSessions = await ctx.db.query("authSessions").collect();
    const users = await ctx.db.query("users").collect();

    return {
      authAccounts,
      authSessions,
      users: users.map(u => ({ _id: u._id, email: u.email, name: u.name, role: u.role, companyId: u.companyId })),
    };
  },
});

export const getIdentity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity;
  },
});
