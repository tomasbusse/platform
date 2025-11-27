import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Company Registration
export const registerCompany = mutation({
  args: {
    name: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    maxStudents: v.number(),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Create company
    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      domain: args.domain,
      description: args.description,
      subscriptionPlan: "trial",
      subscriptionStatus: "active",
      maxStudents: args.maxStudents,
      currentStudentCount: 0,
      settings: args.settings,
      createdAt: now,
      updatedAt: now,
    });

    // Create admin user
    const adminUserId = await ctx.db.insert("users", {
      name: args.name + " Administrator",
      email: args.contactEmail,
      passwordHash: "", // Admin will need to set password via password reset flow
      role: "corporate_admin",
      companyId: companyId,
      isActive: true,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Log the registration
    await ctx.db.insert("auditLogs", {
      companyId: companyId,
      userId: adminUserId,
      action: "company_registered",
      entityType: "company",
      entityId: companyId,
      timestamp: now,
    });

    return { companyId, adminUserId };
  },
});

// Get company by ID
export const getCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    return company;
  },
});

// Simple password hashing using Web Crypto API (server context)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Add employee to company
export const addEmployee = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("corporate_admin"),
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student")
    ),
    currentLevel: v.optional(v.string()),
    password: v.optional(v.string()), // Optional password - if not provided, user must set via invitation
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password if provided
    let passwordHash = "";
    let isActive = false;
    if (args.password) {
      passwordHash = await hashPassword(args.password);
      isActive = true; // If password is set, user is active
    }

    // Create employee user
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      passwordHash: passwordHash,
      role: args.role,
      companyId: args.companyId,
      isActive: isActive,
      currentLevel: args.currentLevel,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Update company student count
    const company = await ctx.db.get(args.companyId);
    if (company) {
      await ctx.db.patch(args.companyId, {
        currentStudentCount: company.currentStudentCount + 1,
        updatedAt: now,
      });
    }

    // Log the action
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      action: "employee_added",
      entityType: "user",
      entityId: userId,
      newValues: { name: args.name, email: args.email, role: args.role },
      timestamp: now,
    });

    return { userId };
  },
});

// Get company employees
export const getCompanyEmployees = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all users and filter by companyId (handles both Id and string storage)
    const allUsers = await ctx.db.query("users").collect();
    console.log("getCompanyEmployees - targetCompanyId:", args.companyId);
    console.log("getCompanyEmployees - total users in DB:", allUsers.length);
    const employees = allUsers.filter(user => {
      const userCompanyId = String(user.companyId);
      const targetCompanyId = String(args.companyId);
      console.log("Comparing:", userCompanyId, "vs", targetCompanyId, "match:", userCompanyId === targetCompanyId);
      return userCompanyId === targetCompanyId;
    });
    console.log("getCompanyEmployees - filtered employees:", employees.length);
    return employees;
  },
});

// Get user notifications
export const getUserNotifications = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return notifications;
  },
});

// Update user status
export const updateUserStatus = mutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      isActive: args.isActive,
      updatedAt: now,
    });

    // Log the action
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: args.userId,
        action: args.isActive ? "user_activated" : "user_deactivated",
        entityType: "user",
        entityId: args.userId,
        timestamp: now,
      });
    }

    return { success: true };
  },
});

// Get users by role
export const getUsersByRole = query({
  args: {
    companyId: v.id("companies"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("role"), args.role))
      .collect();
    return users;
  },
});

// Get all company users (alias for getCompanyEmployees for compatibility)
export const getCompanyUsers = query({
  args: { companyId: v.union(v.id("companies"), v.string()) },
  handler: async (ctx, args) => {
    // Get all users and filter by companyId (handles both Id and string storage)
    const allUsers = await ctx.db.query("users").collect();
    const users = allUsers.filter(user => {
      const userCompanyId = String(user.companyId);
      const targetCompanyId = String(args.companyId);
      return userCompanyId === targetCompanyId;
    });
    return users;
  },
});

// Get all users (admin only)
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users;
  },
});

// Update user
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("corporate_admin"),
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student")
    )),
    currentLevel: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    // If changing email, check it doesn't already exist
    if (args.email && args.email !== user.email) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email!))
        .first();

      if (existingUser) {
        throw new Error("User with this email already exists");
      }
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = { updatedAt: now };
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.role !== undefined) updates.role = args.role;
    if (args.currentLevel !== undefined) updates.currentLevel = args.currentLevel;
    if (args.companyId !== undefined) updates.companyId = args.companyId;

    await ctx.db.patch(args.userId, updates);

    // Log the action
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: args.userId,
        action: "user_updated",
        entityType: "user",
        entityId: args.userId,
        oldValues: { name: user.name, email: user.email, role: user.role },
        newValues: updates,
        timestamp: now,
      });
    }

    return { success: true };
  },
});

// Delete user
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Update company student count
    if (user.companyId) {
      const company = await ctx.db.get(user.companyId as Id<"companies">);
      if (company && company.currentStudentCount > 0) {
        await ctx.db.patch(user.companyId as Id<"companies">, {
          currentStudentCount: company.currentStudentCount - 1,
          updatedAt: now,
        });
      }
    }

    // Log the action before deleting
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        action: "user_deleted",
        entityType: "user",
        entityId: args.userId,
        oldValues: { name: user.name, email: user.email, role: user.role },
        timestamp: now,
      });
    }

    // Delete the user
    await ctx.db.delete(args.userId);

    return { success: true };
  },
});