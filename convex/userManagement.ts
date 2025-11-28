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
      isActive: true,
      currentStudentCount: 0,
      settings: args.settings,
      createdAt: now,
      updatedAt: now,
    });

    // Create admin user (password managed by Clerk)
    const adminUserId = await ctx.db.insert("users", {
      name: args.name + " Administrator",
      email: args.contactEmail,
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

// Add employee to company (password managed by Clerk)
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
    individualLessonsOnly: v.optional(v.boolean()), // DEPRECATED: use takesIndividualLessons
    takesIndividualLessons: v.optional(v.boolean()), // For students who take individual lessons
    groupId: v.optional(v.id("groups")), // Optional group assignment for students
    sendPlacementTest: v.optional(v.boolean()), // Whether to send placement test link
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

    // If groupId is provided, validate it belongs to the same company
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) {
        throw new Error("Group not found");
      }
      if (String(group.companyId) !== String(args.companyId)) {
        throw new Error("Group does not belong to this company");
      }
      if (!group.isActive) {
        throw new Error("Cannot assign to an inactive group");
      }
      if (group.currentStudentCount >= group.maxStudents) {
        throw new Error("Group is at maximum capacity");
      }
    }

    // Determine the student's level - use group level if assigned to a group
    let studentLevel = args.currentLevel;
    if (args.groupId && args.role === "student") {
      const group = await ctx.db.get(args.groupId);
      if (group) {
        studentLevel = group.level;
      }
    }

    // Create employee user (password managed by Clerk)
    // Support both old and new field names for backwards compatibility
    const takesIndividual = args.takesIndividualLessons ?? args.individualLessonsOnly ?? false;

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
      companyId: args.companyId,
      isActive: true, // User will be active, they authenticate via Clerk
      currentLevel: studentLevel,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      individualLessonsOnly: takesIndividual, // Keep for backwards compatibility
      takesIndividualLessons: takesIndividual,
      placementTestCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    // Update company student count (only for students)
    if (args.role === "student") {
      const company = await ctx.db.get(args.companyId);
      if (company) {
        await ctx.db.patch(args.companyId, {
          currentStudentCount: company.currentStudentCount + 1,
          updatedAt: now,
        });
      }
    }

    // If groupId is provided and role is student, add to group
    if (args.groupId && args.role === "student") {
      const group = await ctx.db.get(args.groupId);
      if (group) {
        await ctx.db.patch(args.groupId, {
          studentIds: [...group.studentIds, userId],
          currentStudentCount: group.currentStudentCount + 1,
          updatedAt: now,
        });

        // Create notification for group assignment
        await ctx.db.insert("notifications", {
          userId: userId,
          companyId: args.companyId,
          title: "Group Assignment",
          message: `You have been assigned to ${group.name} (${group.level} level)`,
          type: "info",
          isEmailSent: false,
          isRead: false,
          relatedEntityId: args.groupId,
          relatedEntityType: "group",
          createdAt: now,
        });
      }
    }

    // Log the action
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      action: "employee_added",
      entityType: "user",
      entityId: userId,
      newValues: {
        name: args.name,
        email: args.email,
        role: args.role,
        takesIndividualLessons: takesIndividual,
        groupId: args.groupId,
      },
      timestamp: now,
    });

    return { userId, sendPlacementTest: args.sendPlacementTest, groupId: args.groupId };
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

// Get students in a company who are NOT assigned to any group
export const getUnallocatedStudents = query({
  args: { companyId: v.union(v.id("companies"), v.string()) },
  handler: async (ctx, args) => {
    // Get all students in the company
    const allUsers = await ctx.db.query("users").collect();
    const students = allUsers.filter(user => {
      const userCompanyId = String(user.companyId);
      const targetCompanyId = String(args.companyId);
      return userCompanyId === targetCompanyId && user.role === "student";
    });

    // Get all active groups for this company
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Collect all student IDs that are in any group
    const studentsInGroups = new Set<string>();
    for (const group of groups) {
      for (const studentId of group.studentIds) {
        studentsInGroups.add(studentId);
      }
    }

    // Filter to students NOT in any group
    const unallocatedStudents = students.filter(
      student => !studentsInGroups.has(student._id)
    );

    return unallocatedStudents;
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

// Generate a secure random token for invitations
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create user with invitation (admin creates user, sends invite link for password setup)
export const createUserWithInvitation = mutation({
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
    createdBy: v.id("users"),
    individualLessonsOnly: v.optional(v.boolean()), // DEPRECATED: use takesIndividualLessons
    takesIndividualLessons: v.optional(v.boolean()), // For students who take individual lessons
    groupId: v.optional(v.id("groups")), // Optional group assignment for students
    sendPlacementTest: v.optional(v.boolean()), // Whether to send placement test link
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

    // If groupId is provided, validate it belongs to the same company
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) {
        throw new Error("Group not found");
      }
      if (String(group.companyId) !== String(args.companyId)) {
        throw new Error("Group does not belong to this company");
      }
      if (!group.isActive) {
        throw new Error("Cannot assign to an inactive group");
      }
      if (group.currentStudentCount >= group.maxStudents) {
        throw new Error("Group is at maximum capacity");
      }
    }

    // Determine the student's level - use group level if assigned to a group
    let studentLevel = args.currentLevel;
    if (args.groupId && args.role === "student") {
      const group = await ctx.db.get(args.groupId);
      if (group) {
        studentLevel = group.level;
      }
    }

    // Support both old and new field names for backwards compatibility
    const takesIndividual = args.takesIndividualLessons ?? args.individualLessonsOnly ?? false;

    // Create the user (inactive until they set password)
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
      companyId: args.companyId,
      isActive: false, // Will be activated when they set password
      currentLevel: studentLevel,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      individualLessonsOnly: takesIndividual, // Keep for backwards compatibility
      takesIndividualLessons: takesIndividual,
      placementTestCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    // Generate invitation token
    const token = generateToken();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Create invitation record
    const invitationId = await ctx.db.insert("userInvitations", {
      userId: userId,
      companyId: args.companyId,
      email: args.email,
      token: token,
      status: "pending",
      expiresAt: expiresAt,
      createdBy: args.createdBy,
      createdAt: now,
    });

    // Update company student count (only for students)
    if (args.role === "student") {
      const company = await ctx.db.get(args.companyId);
      if (company) {
        await ctx.db.patch(args.companyId, {
          currentStudentCount: company.currentStudentCount + 1,
          updatedAt: now,
        });
      }
    }

    // If groupId is provided and role is student, add to group
    if (args.groupId && args.role === "student") {
      const group = await ctx.db.get(args.groupId);
      if (group) {
        await ctx.db.patch(args.groupId, {
          studentIds: [...group.studentIds, userId],
          currentStudentCount: group.currentStudentCount + 1,
          updatedAt: now,
        });

        // Create notification for group assignment
        await ctx.db.insert("notifications", {
          userId: userId,
          companyId: args.companyId,
          title: "Group Assignment",
          message: `You have been assigned to ${group.name} (${group.level} level)`,
          type: "info",
          isEmailSent: false,
          isRead: false,
          relatedEntityId: args.groupId,
          relatedEntityType: "group",
          createdAt: now,
        });
      }
    }

    // Log the action
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.createdBy,
      action: "user_invited",
      entityType: "user",
      entityId: userId,
      newValues: {
        name: args.name,
        email: args.email,
        role: args.role,
        takesIndividualLessons: takesIndividual,
        groupId: args.groupId,
      },
      timestamp: now,
    });

    return {
      userId,
      invitationId,
      token,
      expiresAt,
      groupId: args.groupId,
    };
  },
});

// Get invitation by token (for the password setup page)
export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("userInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return { error: "Invitation not found" };
    }

    // Check if expired
    if (invitation.status === "expired" || invitation.expiresAt < Date.now()) {
      return { error: "Invitation has expired" };
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return { error: "Invitation has already been used" };
    }

    // Get user details
    const user = await ctx.db.get(invitation.userId);
    if (!user) {
      return { error: "User not found" };
    }

    // Get company details
    let companyName = "Unknown Company";
    if (invitation.companyId) {
      try {
        const company = await ctx.db.get(invitation.companyId as Id<"companies">);
        if (company) {
          companyName = company.name;
        }
      } catch {
        // Ignore if company not found
      }
    }

    return {
      invitation: {
        _id: invitation._id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      companyName,
    };
  },
});

// Resend invitation (generate new token)
export const resendInvitation = mutation({
  args: {
    userId: v.id("users"),
    resendBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Find existing pending invitation
    const existingInvitation = await ctx.db
      .query("userInvitations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    // If there's an existing invitation, mark it as expired
    if (existingInvitation) {
      await ctx.db.patch(existingInvitation._id, {
        status: "expired",
      });
    }

    // Generate new token
    const token = generateToken();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days

    // Create new invitation
    const invitationId = await ctx.db.insert("userInvitations", {
      userId: args.userId,
      companyId: user.companyId || "",
      email: user.email || "",
      token: token,
      status: "pending",
      expiresAt: expiresAt,
      createdBy: args.resendBy,
      createdAt: now,
    });

    // Log the action
    if (user.companyId) {
      await ctx.db.insert("auditLogs", {
        companyId: user.companyId,
        userId: args.resendBy,
        action: "invitation_resent",
        entityType: "user",
        entityId: args.userId,
        timestamp: now,
      });
    }

    return {
      invitationId,
      token,
      expiresAt,
    };
  },
});

// Get user's pending invitation
export const getUserInvitation = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("userInvitations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    return invitation;
  },
});

// Accept invitation - called after user successfully signs up via invitation link
export const acceptInvitation = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the invitation
    const invitation = await ctx.db
      .query("userInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Check if expired
    if (invitation.status === "expired" || invitation.expiresAt < now) {
      throw new Error("Invitation has expired");
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      throw new Error("Invitation has already been used");
    }

    // Get the invited user
    const invitedUser = await ctx.db.get(invitation.userId);
    if (!invitedUser) {
      throw new Error("User not found");
    }

    // Find the auth-created user by email (created during signUp)
    const authUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", invitation.email))
      .order("desc")
      .first();

    if (authUser && authUser._id !== invitation.userId) {
      // Merge: Copy app data from invited user to auth user, then delete invited user
      await ctx.db.patch(authUser._id, {
        role: invitedUser.role,
        companyId: invitedUser.companyId,
        isActive: true,
        name: invitedUser.name,
        currentLevel: invitedUser.currentLevel,
        totalScore: invitedUser.totalScore || 0,
        averageScore: invitedUser.averageScore || 0,
        completedTests: invitedUser.completedTests || 0,
        createdAt: invitedUser.createdAt,
        updatedAt: now,
      });

      // Delete the original invited user (we merged into auth user)
      await ctx.db.delete(invitation.userId);

      // Update invitation to point to merged user
      await ctx.db.patch(invitation._id, {
        status: "accepted",
        acceptedAt: now,
        userId: authUser._id, // Point to the auth user now
      });

      // Log the action
      if (invitedUser.companyId) {
        await ctx.db.insert("auditLogs", {
          companyId: invitedUser.companyId,
          userId: authUser._id,
          action: "invitation_accepted",
          entityType: "user",
          entityId: authUser._id,
          timestamp: now,
        });
      }

      return { success: true, userId: authUser._id };
    } else {
      // No separate auth user - just activate the invited user
      await ctx.db.patch(invitation.userId, {
        isActive: true,
        updatedAt: now,
      });

      // Mark invitation as accepted
      await ctx.db.patch(invitation._id, {
        status: "accepted",
        acceptedAt: now,
      });

      // Log the action
      if (invitedUser.companyId) {
        await ctx.db.insert("auditLogs", {
          companyId: invitedUser.companyId,
          userId: invitation.userId,
          action: "invitation_accepted",
          entityType: "user",
          entityId: invitation.userId,
          timestamp: now,
        });
      }

      return { success: true, userId: invitation.userId };
    }
  },
});

// Send a placement test link to a user
export const sendPlacementTestToUser = mutation({
  args: {
    userId: v.id("users"),
    testType: v.optional(v.union(
      v.literal("placement"),
      v.literal("follow_up"),
      v.literal("level_assessment"),
      v.literal("practice"),
      v.literal("diagnostic"),
      v.literal("certification")
    )),
    quizId: v.optional(v.id("quizzes")),
    sentBy: v.id("users"),
    expiryDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresInDays = args.expiryDays || 7;
    const expiresAt = now + (expiresInDays * 24 * 60 * 60 * 1000);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.email) {
      throw new Error("User does not have an email address");
    }

    if (!user.companyId) {
      throw new Error("User is not associated with a company");
    }

    // Generate unique token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Make sure token is unique
    let existing = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    while (existing) {
      token = '';
      for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      existing = await ctx.db
        .query("assessmentInvitations")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
    }

    // Create the assessment invitation
    const invitationId = await ctx.db.insert("assessmentInvitations", {
      companyId: user.companyId,
      token,
      email: user.email,
      name: user.name || "Student",
      quizId: args.quizId,
      testType: args.testType || "placement",
      status: "pending",
      expiresAt,
      userId: args.userId,
      forIndividualLessons: user.individualLessonsOnly,
      createdBy: args.sentBy,
      createdAt: now,
    });

    // Log the action
    await ctx.db.insert("auditLogs", {
      companyId: user.companyId,
      userId: args.sentBy,
      action: "placement_test_sent",
      entityType: "user",
      entityId: args.userId,
      newValues: { testType: args.testType || "placement", quizId: args.quizId },
      timestamp: now,
    });

    return {
      invitationId,
      token,
      expiresAt,
    };
  },
});

// Get a user's placement test status/history
export const getUserPlacementTestStatus = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Get the user's assessment invitations
    const invitations = await ctx.db
      .query("assessmentInvitations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by creation date (most recent first)
    invitations.sort((a, b) => b.createdAt - a.createdAt);

    return {
      placementTestCompleted: user.placementTestCompleted,
      placementTestDate: user.placementTestDate,
      placementTestScore: user.placementTestScore,
      currentLevel: user.currentLevel,
      invitations: invitations.map(inv => ({
        _id: inv._id,
        testType: inv.testType,
        status: inv.status,
        score: inv.score,
        recommendedLevel: inv.recommendedLevel,
        createdAt: inv.createdAt,
        completedAt: inv.completedAt,
      })),
    };
  },
});