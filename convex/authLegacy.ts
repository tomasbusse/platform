import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireCompany } from "./authUtils";

// Simple password hashing using Web Crypto API (server context)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === passwordHash;
}

// User registration
export const registerUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    companyId: v.string(),
    role: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash the password
    const passwordHash = await hashPassword(args.password);

    // Create the user
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      passwordHash: passwordHash,
      role: args.role as "corporate_admin" | "admin" | "teacher" | "student",
      companyId: args.companyId,
      isActive: true,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Log the registration
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: userId,
      action: "user_registered",
      entityType: "user",
      entityId: userId,
      timestamp: now,
    });

    return { userId };
  },
});

// User login
export const loginUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password against stored hash (legacy - will be removed after migration)
    if (!user.passwordHash) {
      throw new Error("Invalid email or password");
    }
    const isPasswordValid = await verifyPassword(args.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated. Please contact your administrator.");
    }

    const now = Date.now();

    // Update last login
    await ctx.db.patch(user._id, {
      lastLogin: now,
      updatedAt: now,
    });

    // Log the login
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: user._id,
        action: "user_login",
        entityType: "user",
        entityId: user._id,
        timestamp: now,
      });
    }

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    };
  },
});

// Get current user
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
      subscriptionPlan: company.subscriptionPlan,
      subscriptionStatus: company.subscriptionStatus,
      maxStudents: company.maxStudents,
      currentStudentCount: company.currentStudentCount,
      settings: company.settings,
    };
  },
});

// Change password
export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Verify the old password against the current passwordHash (legacy)
    if (!user.passwordHash) {
      throw new Error("Password not set for this user");
    }
    const isOldPasswordValid = await verifyPassword(args.oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(args.newPassword);
    const now = Date.now();

    // Update user record with new password hash
    await ctx.db.patch(user._id, {
      passwordHash: newPasswordHash,
      updatedAt: now,
    });

    // Log the password change
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: user._id,
        action: "password_changed",
        entityType: "user",
        entityId: user._id,
        timestamp: now,
      });
    }

    return { success: true };
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

// Set initial password (for users created without password)
export const setInitialPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Only allow setting password if user doesn't have one yet
    if (user.passwordHash && user.passwordHash !== "") {
      throw new Error("Password already set. Use 'Change Password' or 'Forgot Password' instead.");
    }

    // Hash the new password
    const passwordHash = await hashPassword(args.password);
    const now = Date.now();

    // Update user with password
    await ctx.db.patch(user._id, {
      passwordHash: passwordHash,
      isActive: true, // Activate user when they set their password
      updatedAt: now,
    });

    // Log the action
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: user._id,
        action: "initial_password_set",
        entityType: "user",
        entityId: user._id,
        timestamp: now,
      });
    }

    return { success: true };
  },
});

// Request password reset
export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      // Don't reveal whether the email exists or not
      return { success: true, message: "If an account with that email exists, a password reset link has been sent." };
    }

    // In a real app, you would:
    // 1. Generate a secure token
    // 2. Store it with an expiration time
    // 3. Send an email with the reset link

    // For now, just log the request
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: user._id,
        action: "password_reset_requested",
        entityType: "user",
        entityId: user._id,
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    };
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