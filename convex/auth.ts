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

// Setup admin account - creates company if needed and assigns user as admin
export const setupAdminAccount = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found. Please sign up first.");
    }

    // Check if there's an existing company, or create one
    let company = await ctx.db.query("companies").first();

    if (!company) {
      // Create a default company
      const companyId = await ctx.db.insert("companies", {
        name: "Simmonds Language Services",
        contactEmail: args.email,
        isActive: true,
        currentStudentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      company = await ctx.db.get(companyId);
    }

    // Update the user with admin role and company
    await ctx.db.patch(user._id, {
      role: "corporate_admin",
      companyId: company!._id,
      isActive: true,
      name: args.email.split("@")[0],
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: user.createdAt || Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, userId: user._id, companyId: company!._id };
  },
});
