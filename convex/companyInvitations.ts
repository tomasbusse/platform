import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Generate a random token
function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Create a company invitation link
export const createCompanyInvitationLink = mutation({
  args: {
    companyId: v.id("companies"),
    role: v.union(v.literal("student"), v.literal("teacher"), v.literal("admin")),
    expiresAt: v.optional(v.number()), // Optional expiration date
    maxUses: v.optional(v.number()), // Optional max uses
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated and is admin
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify user is admin of this company
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .first();

    if (!currentUser || currentUser.companyId !== args.companyId || currentUser.role !== "corporate_admin") {
      throw new Error("Not authorized to create invitation links for this company");
    }

    const token = generateToken();
    const now = Date.now();

    const linkId = await ctx.db.insert("companyInvitationLinks", {
      companyId: args.companyId,
      token,
      role: args.role,
      isActive: true,
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      currentUses: 0,
      createdBy: currentUser._id,
      createdAt: now,
      updatedAt: now,
    });

    return {
      linkId,
      token,
      url: `https://app.simmonds.online/join/${token}`,
    };
  },
});

// Get invitation link by token (public - no auth required)
export const getInvitationLinkByToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("companyInvitationLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!link) {
      return null;
    }

    // Check if link is valid
    if (!link.isActive) {
      return null;
    }

    if (link.expiresAt && link.expiresAt < Date.now()) {
      return null;
    }

    if (link.maxUses && link.currentUses >= link.maxUses) {
      return null;
    }

    // Get company info
    const company = await ctx.db.get(link.companyId);

    return {
      linkId: link._id,
      companyId: link.companyId,
      companyName: company?.name,
      role: link.role,
      token: args.token,
    };
  },
});

// Accept invitation link (when user signs up)
export const acceptInvitationLink = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get the invitation link
    const link = await ctx.db
      .query("companyInvitationLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!link) {
      throw new Error("Invitation link not found");
    }

    // Validate link
    if (!link.isActive) {
      throw new Error("Invitation link is no longer active");
    }

    if (link.expiresAt && link.expiresAt < Date.now()) {
      throw new Error("Invitation link has expired");
    }

    if (link.maxUses && link.currentUses >= link.maxUses) {
      throw new Error("Invitation link has reached maximum uses");
    }

    // Get or create user
    let currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .first();

    if (!currentUser) {
      // Create new user
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        email: user.email,
        name: user.name || user.email,
        role: link.role,
        companyId: link.companyId,
        isActive: true,
        totalScore: 0,
        averageScore: 0,
        completedTests: 0,
        createdAt: now,
        updatedAt: now,
      });
      currentUser = await ctx.db.get(userId);
    } else if (currentUser.companyId !== link.companyId) {
      // Update existing user to join this company
      await ctx.db.patch(currentUser._id, {
        companyId: link.companyId,
        role: link.role,
        updatedAt: Date.now(),
      });
    }

    // Increment usage count
    await ctx.db.patch(link._id, {
      currentUses: link.currentUses + 1,
      updatedAt: Date.now(),
    });

    return { success: true, userId: currentUser._id };
  },
});

