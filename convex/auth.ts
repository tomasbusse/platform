import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper to get user from Clerk identity
async function getUserFromIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // With Clerk, the identity contains email and subject (Clerk user ID)
  const email = identity.email;
  const clerkUserId = identity.subject;

  if (!email) {
    return null;
  }

  // Try to find user by email
  let user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .first();

  // If user exists but doesn't have clerkId, update it
  if (user && !user.clerkId && clerkUserId) {
    await ctx.db.patch(user._id, { clerkId: clerkUserId });
  }

  return user;
}

// Get the currently authenticated user with their data
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getUserFromIdentity(ctx);
  },
});

// Get company info for the current user
export const currentUserCompany = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserFromIdentity(ctx);

    if (!user || !user.companyId) {
      return null;
    }

    try {
      const company = await ctx.db.get(user.companyId as any);
      return company;
    } catch {
      return null;
    }
  },
});

// Auto-setup user from Clerk - called when user signs in and doesn't exist in Convex
// First user becomes admin, subsequent users need to be invited
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("Not authenticated");
    }

    const email = identity.email;
    const clerkUserId = identity.subject;
    const name = identity.name || identity.nickname || email.split("@")[0];
    const now = Date.now();

    // Check if user already exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (user) {
      // User exists - just update clerkId if needed
      if (!user.clerkId && clerkUserId) {
        await ctx.db.patch(user._id, { clerkId: clerkUserId });
      }
      return { success: true, userId: user._id, companyId: user.companyId, existing: true };
    }

    // User doesn't exist - check if this is the first user (becomes admin)
    const existingUsers = await ctx.db.query("users").first();
    const isFirstUser = !existingUsers;

    // Get or create company
    let company = await ctx.db.query("companies").first();

    if (!company) {
      // Create default company for first user
      const companyId = await ctx.db.insert("companies", {
        name: "Simmonds Language Services",
        contactEmail: email,
        isActive: true,
        currentStudentCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      company = await ctx.db.get(companyId);
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: email,
      name: name,
      clerkId: clerkUserId,
      role: isFirstUser ? "corporate_admin" : "student", // First user is admin, others are students
      companyId: company!._id,
      isActive: true,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, userId, companyId: company!._id, existing: false, isAdmin: isFirstUser };
  },
});

// Setup admin account - promotes a user to admin (manual)
export const setupAdminAccount = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if there's an existing company, or create one
    let company = await ctx.db.query("companies").first();

    if (!company) {
      // Create a default company
      const companyId = await ctx.db.insert("companies", {
        name: "Simmonds Language Services",
        contactEmail: args.email,
        isActive: true,
        currentStudentCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      company = await ctx.db.get(companyId);
    }

    // Find or create user by email
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      // Create new user
      const userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.name || args.email.split("@")[0],
        role: "corporate_admin",
        companyId: company!._id,
        isActive: true,
        totalScore: 0,
        averageScore: 0,
        completedTests: 0,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, userId, companyId: company!._id, created: true };
    }

    // Update existing user with admin role and company
    await ctx.db.patch(user._id, {
      role: "corporate_admin",
      companyId: company!._id,
      isActive: true,
      name: args.name || user.name || args.email.split("@")[0],
      totalScore: user.totalScore || 0,
      averageScore: user.averageScore || 0,
      completedTests: user.completedTests || 0,
      updatedAt: now,
    });

    return { success: true, userId: user._id, companyId: company!._id, created: false };
  },
});
