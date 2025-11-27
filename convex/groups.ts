import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================================================
// GROUP CRUD OPERATIONS
// ============================================================================

// Create a new group
export const createGroup = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
    teacherId: v.optional(v.union(v.id("users"), v.string())),
    maxStudents: v.number(),
    scheduleInfo: v.optional(v.string()),
    autoAssign: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const groupId = await ctx.db.insert("groups", {
      companyId: args.companyId,
      name: args.name,
      description: args.description,
      level: args.level,
      teacherId: args.teacherId,
      maxStudents: args.maxStudents,
      currentStudentCount: 0,
      studentIds: [],
      scheduleInfo: args.scheduleInfo,
      isActive: true,
      autoAssign: args.autoAssign,
      createdAt: now,
      updatedAt: now,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      action: "group_created",
      entityType: "group",
      entityId: groupId,
      newValues: { name: args.name, level: args.level },
      timestamp: now,
    });

    return groupId;
  },
});

// Update a group
export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    teacherId: v.optional(v.union(v.id("users"), v.string())),
    maxStudents: v.optional(v.number()),
    scheduleInfo: v.optional(v.string()),
    autoAssign: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    const updateData: any = { updatedAt: now };
    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.teacherId !== undefined) updateData.teacherId = args.teacherId;
    if (args.maxStudents !== undefined) updateData.maxStudents = args.maxStudents;
    if (args.scheduleInfo !== undefined) updateData.scheduleInfo = args.scheduleInfo;
    if (args.autoAssign !== undefined) updateData.autoAssign = args.autoAssign;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;

    await ctx.db.patch(args.groupId, updateData);

    return { success: true };
  },
});

// Delete a group
export const deleteGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Soft delete by setting isActive to false
    await ctx.db.patch(args.groupId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get all groups for a company
export const getCompanyGroups = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    level: v.optional(v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    )),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.level !== undefined) {
      groups = groups.filter((g) => g.level === args.level);
    }
    if (args.isActive !== undefined) {
      groups = groups.filter((g) => g.isActive === args.isActive);
    }

    // Sort by level and name
    const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    groups.sort((a, b) => {
      const levelDiff = levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    });

    return groups;
  },
});

// Get a single group by ID
export const getGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.groupId);
  },
});

// ============================================================================
// STUDENT ASSIGNMENT OPERATIONS
// ============================================================================

// Add a student to a group
export const addStudentToGroup = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    if (!group.isActive) {
      throw new Error("Cannot add students to an inactive group");
    }

    if (group.currentStudentCount >= group.maxStudents) {
      throw new Error("Group is at maximum capacity");
    }

    // Check if student is already in the group
    if (group.studentIds.includes(args.userId as string)) {
      throw new Error("Student is already in this group");
    }

    // Add student to group
    await ctx.db.patch(args.groupId, {
      studentIds: [...group.studentIds, args.userId as string],
      currentStudentCount: group.currentStudentCount + 1,
      updatedAt: now,
    });

    // Update user's group assignment (add groupId to user if needed)
    const user = await ctx.db.get(args.userId as any);
    if (user) {
      await ctx.db.patch(args.userId as any, {
        currentLevel: group.level,
        updatedAt: now,
      });
    }

    // Create notification for the student
    await ctx.db.insert("notifications", {
      userId: args.userId as string,
      companyId: group.companyId,
      title: "Group Assignment",
      message: `You have been assigned to ${group.name} (${group.level} level)`,
      type: "info",
      isEmailSent: false,
      isRead: false,
      relatedEntityId: args.groupId,
      relatedEntityType: "group",
      createdAt: now,
    });

    return { success: true };
  },
});

// Remove a student from a group
export const removeStudentFromGroup = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    const studentIndex = group.studentIds.indexOf(args.userId as string);
    if (studentIndex === -1) {
      throw new Error("Student is not in this group");
    }

    // Remove student from group
    const newStudentIds = group.studentIds.filter(id => id !== args.userId);
    await ctx.db.patch(args.groupId, {
      studentIds: newStudentIds,
      currentStudentCount: group.currentStudentCount - 1,
      updatedAt: now,
    });

    return { success: true };
  },
});

// ============================================================================
// AUTO-ASSIGNMENT LOGIC
// ============================================================================

// Auto-assign a student to an appropriate group based on their test results
export const autoAssignStudentToGroup = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    userId: v.union(v.id("users"), v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find all active groups for this company and level that have auto-assign enabled
    const availableGroups = await ctx.db
      .query("groups")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .filter((q) =>
        q.and(
          q.eq(q.field("companyId"), args.companyId),
          q.eq(q.field("isActive"), true),
          q.eq(q.field("autoAssign"), true)
        )
      )
      .collect();

    // Filter to groups with available capacity
    const groupsWithCapacity = availableGroups.filter(
      g => g.currentStudentCount < g.maxStudents
    );

    if (groupsWithCapacity.length === 0) {
      // No groups available - create a notification for admin
      await ctx.db.insert("notifications", {
        userId: args.userId as string,
        companyId: args.companyId,
        title: "Group Assignment Pending",
        message: `No ${args.level} groups available. Please contact your administrator.`,
        type: "warning",
        isEmailSent: false,
        isRead: false,
        createdAt: now,
      });
      return { success: false, reason: "No groups available with capacity" };
    }

    // Select the group with the most capacity (to balance groups)
    const selectedGroup = groupsWithCapacity.reduce((best, current) => {
      const bestAvailable = best.maxStudents - best.currentStudentCount;
      const currentAvailable = current.maxStudents - current.currentStudentCount;
      return currentAvailable > bestAvailable ? current : best;
    });

    // Check if student is already in any group for this company
    const allGroups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    for (const group of allGroups) {
      if (group.studentIds.includes(args.userId as string)) {
        // Remove from existing group first
        await ctx.db.patch(group._id, {
          studentIds: group.studentIds.filter(id => id !== args.userId),
          currentStudentCount: group.currentStudentCount - 1,
          updatedAt: now,
        });
      }
    }

    // Add student to selected group
    await ctx.db.patch(selectedGroup._id, {
      studentIds: [...selectedGroup.studentIds, args.userId as string],
      currentStudentCount: selectedGroup.currentStudentCount + 1,
      updatedAt: now,
    });

    // Update user's level
    const user = await ctx.db.get(args.userId as any);
    if (user) {
      await ctx.db.patch(args.userId as any, {
        currentLevel: args.level,
        updatedAt: now,
      });
    }

    // Create notification
    await ctx.db.insert("notifications", {
      userId: args.userId as string,
      companyId: args.companyId,
      title: "Automatic Group Assignment",
      message: `Based on your assessment results, you have been assigned to ${selectedGroup.name} (${args.level} level)`,
      type: "success",
      isEmailSent: false,
      isRead: false,
      relatedEntityId: selectedGroup._id,
      relatedEntityType: "group",
      createdAt: now,
    });

    return {
      success: true,
      groupId: selectedGroup._id,
      groupName: selectedGroup.name,
      level: args.level
    };
  },
});

// Get students in a group with their details
export const getGroupStudents = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      return [];
    }

    // Fetch all student details
    const students = await Promise.all(
      group.studentIds.map(async (studentId) => {
        const user = await ctx.db.get(studentId as Id<"users">);
        if (!user) return null;
        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          currentLevel: user.currentLevel,
          totalScore: user.totalScore,
          averageScore: user.averageScore,
          completedTests: user.completedTests,
        };
      })
    );

    return students.filter(Boolean);
  },
});

// Get group statistics
export const getGroupStats = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const stats = {
      totalGroups: groups.length,
      totalStudents: groups.reduce((sum, g) => sum + g.currentStudentCount, 0),
      byLevel: {} as Record<string, { groups: number; students: number; capacity: number }>,
      autoAssignEnabled: groups.filter(g => g.autoAssign).length,
    };

    // Calculate by level
    for (const group of groups) {
      if (!stats.byLevel[group.level]) {
        stats.byLevel[group.level] = { groups: 0, students: 0, capacity: 0 };
      }
      stats.byLevel[group.level].groups += 1;
      stats.byLevel[group.level].students += group.currentStudentCount;
      stats.byLevel[group.level].capacity += group.maxStudents;
    }

    return stats;
  },
});

// Bulk assign students to groups based on their levels
export const bulkAssignStudentsByLevel = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all students in the company
    const students = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.and(q.eq(q.field("role"), "student"), q.eq(q.field("isActive"), true)))
      .collect();

    // Get all active auto-assign groups
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.and(q.eq(q.field("isActive"), true), q.eq(q.field("autoAssign"), true)))
      .collect();

    let assigned = 0;
    let failed = 0;

    for (const student of students) {
      const level = student.currentLevel || 'A1';

      // Find appropriate group
      const levelGroups = groups.filter(g =>
        g.level === level &&
        g.currentStudentCount < g.maxStudents &&
        !g.studentIds.includes(student._id)
      );

      if (levelGroups.length > 0) {
        // Select group with most capacity
        const selectedGroup = levelGroups.reduce((best, current) => {
          const bestAvailable = best.maxStudents - best.currentStudentCount;
          const currentAvailable = current.maxStudents - current.currentStudentCount;
          return currentAvailable > bestAvailable ? current : best;
        });

        // Add student to group
        await ctx.db.patch(selectedGroup._id, {
          studentIds: [...selectedGroup.studentIds, student._id],
          currentStudentCount: selectedGroup.currentStudentCount + 1,
          updatedAt: now,
        });

        // Update local reference
        selectedGroup.studentIds.push(student._id);
        selectedGroup.currentStudentCount += 1;

        assigned++;
      } else {
        failed++;
      }
    }

    return {
      success: true,
      assigned,
      failed,
      message: `Successfully assigned ${assigned} students. ${failed} students could not be assigned due to capacity.`
    };
  },
});
