import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});

// Helper to get user from identity
async function getUserFromIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Get user ID from subject (format: "userId|sessionId")
  if (identity.subject) {
    const subjectParts = identity.subject.split("|");
    const authUserId = subjectParts[0];
    try {
      // First, try to get the user directly by the auth user ID
      const authUser = await ctx.db.get(authUserId as any);

      if (authUser) {
        // Check if this user record has the required app fields (role)
        if ('role' in authUser && authUser.role) {
          return authUser;
        }

        // If the auth user has an email, find the app user by email
        if (authUser.email) {
          const appUser = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
            .first();

          // If we found a different user record with the same email that has role set
          if (appUser && appUser._id !== authUser._id && 'role' in appUser && appUser.role) {
            return appUser;
          }

          // Otherwise return the auth user (it just needs to be set up)
          return authUser;
        }

        // Return the auth user even without role
        return authUser;
      }
    } catch (e) {
      console.error("Error getting user from subject:", e);
      // Continue to email lookup
    }
  }

  // Fallback: Try to find user by email from identity
  if (identity.email) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", identity.email))
      .first();
    if (user) {
      return user;
    }
  }

  return null;
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
        subscriptionPlan: "enterprise",
        subscriptionStatus: "active",
        maxStudents: 1000,
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
