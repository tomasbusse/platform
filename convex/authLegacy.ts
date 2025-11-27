import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// LEGACY: This file contains authentication methods that were used before Clerk integration.
// Password-related methods have been removed. Authentication is now handled by Clerk.

// Get current user by ID
export const getCurrentUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
    };
  },
});

// Get company info
export const getCompanyInfo = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    return {
      _id: company._id,
      name: company.name,
      domain: company.domain,
      contactEmail: company.contactEmail,
      isActive: company.isActive,
      currentStudentCount: company.currentStudentCount,
      settings: company.settings,
    };
  },
});

// Update user profile
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    currentLevel: v.optional(v.string()),
    targetLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name) updates.name = args.name;
    if (args.currentLevel) updates.currentLevel = args.currentLevel;
    if (args.targetLevel) updates.targetLevel = args.targetLevel;

    await ctx.db.patch(user._id, updates);

    // Log the update
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: user._id,
        action: "profile_updated",
        entityType: "user",
        entityId: user._id,
        newValues: updates,
        timestamp: Date.now(),
      });
    }

    return { success: true };
  },
});

// Get all users for a company
export const getUsersByCompany = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      currentLevel: user.currentLevel,
      totalScore: user.totalScore,
      averageScore: user.averageScore,
      completedTests: user.completedTests,
      lastLogin: user.lastLogin,
    }));
  },
});

// Reactivate user by email (admin utility)
export const reactivateUser = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    await ctx.db.patch(user._id, {
      isActive: true,
      updatedAt: now,
    });

    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: user._id,
        action: "user_reactivated",
        entityType: "user",
        entityId: user._id,
        timestamp: now,
      });
    }

    return { success: true, message: `User ${args.email} has been reactivated` };
  },
});
