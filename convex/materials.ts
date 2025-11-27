import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ============================================================================
// UPLOAD MATERIAL
// ============================================================================

export const uploadMaterial = mutation({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.union(
      v.literal("document"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("link"),
      v.literal("other")
    ),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    accessScope: v.union(
      v.literal("company"),
      v.literal("group"),
      v.literal("individual")
    ),
    accessGroupIds: v.optional(v.array(v.union(v.id("groups"), v.string()))),
    accessStudentIds: v.optional(v.array(v.string())),
    scheduledLessonId: v.optional(v.id("scheduledLessons")),
    virtualLessonId: v.optional(v.id("virtualLessons")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const materialId = await ctx.db.insert("lessonMaterials", {
      companyId: args.companyId,
      title: args.title,
      description: args.description,
      category: args.category,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      storageId: args.storageId,
      externalUrl: args.externalUrl,
      accessScope: args.accessScope,
      accessGroupIds: args.accessGroupIds,
      accessStudentIds: args.accessStudentIds,
      scheduledLessonId: args.scheduledLessonId,
      virtualLessonId: args.virtualLessonId,
      uploadedBy: user.email,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return materialId;
  },
});

// ============================================================================
// GET MATERIALS FOR USER (with access control)
// ============================================================================

export const getMaterialsForUser = query({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    userId: v.optional(v.string()),
    groupIds: v.optional(v.array(v.union(v.id("groups"), v.string()))),
  },
  handler: async (ctx, args) => {
    try {
      const materials = await ctx.db
        .query("lessonMaterials")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect();

      // Filter based on access scope
      return materials.filter((material) => {
        if (!material.isActive) return false;

        if (material.accessScope === "company") {
          return true;
        }

        if (material.accessScope === "group") {
          if (!args.groupIds || args.groupIds.length === 0) {
            return false;
          }
          return material.accessGroupIds?.some((gid) =>
            args.groupIds!.includes(gid as any)
          ) || false;
        }

        if (material.accessScope === "individual") {
          if (!args.userId) {
            return false;
          }
          return material.accessStudentIds?.includes(args.userId) || false;
        }

        return false;
      });
    } catch (error) {
      console.error("Error in getMaterialsForUser:", error);
      return [];
    }
  },
});

// ============================================================================
// GET MATERIALS FOR LESSON
// ============================================================================

export const getMaterialsForLesson = query({
  args: {
    lessonId: v.id("virtualLessons"),
  },
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("lessonMaterials")
      .withIndex("by_virtual_lesson", (q) => q.eq("virtualLessonId", args.lessonId))
      .collect();

    return materials.filter((m) => m.isActive);
  },
});

// ============================================================================
// UPDATE MATERIAL
// ============================================================================

export const updateMaterial = mutation({
  args: {
    materialId: v.id("lessonMaterials"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("document"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("link"),
      v.literal("other")
    )),
    accessScope: v.optional(v.union(
      v.literal("company"),
      v.literal("group"),
      v.literal("individual")
    )),
    accessGroupIds: v.optional(v.array(v.union(v.id("groups"), v.string()))),
    accessStudentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.accessScope !== undefined) updates.accessScope = args.accessScope;
    if (args.accessGroupIds !== undefined) updates.accessGroupIds = args.accessGroupIds;
    if (args.accessStudentIds !== undefined) updates.accessStudentIds = args.accessStudentIds;
    updates.updatedAt = Date.now();

    await ctx.db.patch(args.materialId, updates);
    return args.materialId;
  },
});

// ============================================================================
// DELETE MATERIAL
// ============================================================================

export const deleteMaterial = mutation({
  args: {
    materialId: v.id("lessonMaterials"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    await ctx.db.patch(args.materialId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    // Create notification for users who had access
    await ctx.scheduler.runAfter(0, internal.materials.notifyMaterialRemoved, {
      materialId: args.materialId,
      companyId: material.companyId,
    });

    return { success: true };
  },
});

// ============================================================================
// TRACK MATERIAL DOWNLOAD
// ============================================================================

export const trackMaterialDownload = mutation({
  args: {
    materialId: v.id("lessonMaterials"),
    userId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    // Record download
    await ctx.db.insert("materialDownloads", {
      materialId: args.materialId,
      userId: args.userId,
      companyId: material.companyId,
      downloadedAt: Date.now(),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    return { success: true };
  },
});

// ============================================================================
// GET DOWNLOAD STATS FOR MATERIAL
// ============================================================================

export const getMaterialDownloadStats = query({
  args: {
    materialId: v.id("lessonMaterials"),
  },
  handler: async (ctx, args) => {
    const downloads = await ctx.db
      .query("materialDownloads")
      .withIndex("by_material", (q) => q.eq("materialId", args.materialId))
      .collect();

    const uniqueUsers = new Set(downloads.map((d) => d.userId)).size;
    const totalDownloads = downloads.length;
    const lastDownloadedAt = downloads.length > 0
      ? Math.max(...downloads.map((d) => d.downloadedAt))
      : null;

    return {
      totalDownloads,
      uniqueUsers,
      lastDownloadedAt,
      downloads: downloads.sort((a, b) => b.downloadedAt - a.downloadedAt),
    };
  },
});

// ============================================================================
// GET NOTIFICATIONS FOR USER
// ============================================================================

export const getUserNotifications = query({
  args: {
    userId: v.string(),
    companyId: v.union(v.id("companies"), v.string()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      const notifications = await ctx.db
        .query("materialNotifications")
        .withIndex("by_recipient", (q) => q.eq("recipientId", args.userId))
        .collect();

      let filtered = notifications.filter((n) => n.companyId === args.companyId);

      if (args.unreadOnly) {
        filtered = filtered.filter((n) => !n.isRead);
      }

      return filtered.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error("Error in getUserNotifications:", error);
      return [];
    }
  },
});

// ============================================================================
// MARK NOTIFICATION AS READ
// ============================================================================

export const markNotificationAsRead = mutation({
  args: {
    notificationId: v.id("materialNotifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// GENERATE DOWNLOAD URL
// ============================================================================

export const generateDownloadUrl = query({
  args: {
    materialId: v.id("lessonMaterials"),
  },
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    if (material.externalUrl) {
      return { url: material.externalUrl, type: "external" };
    }

    if (material.storageId) {
      const url = await ctx.storage.getUrl(material.storageId);
      return { url, type: "storage" };
    }

    throw new Error("No download URL available for this material");
  },
});

// ============================================================================
// INTERNAL: NOTIFY MATERIAL REMOVED
// ============================================================================

export const notifyMaterialRemoved = mutation({
  args: {
    materialId: v.id("lessonMaterials"),
    companyId: v.union(v.id("companies"), v.string()),
  },
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) return;

    // Get all users who had access to this material
    const usersToNotify = new Set<string>();

    if (material.accessScope === "company") {
      // Notify all company users
      const users = await ctx.db
        .query("users")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect();
      users.forEach((u) => usersToNotify.add(u._id));
    } else if (material.accessScope === "group" && material.accessGroupIds) {
      // Notify users in specified groups
      for (const groupId of material.accessGroupIds) {
        const group = await ctx.db.get(groupId as Id<"groups">);
        if (group?.studentIds) {
          group.studentIds.forEach((id) => usersToNotify.add(id));
        }
      }
    } else if (material.accessScope === "individual" && material.accessStudentIds) {
      // Notify specified students
      material.accessStudentIds.forEach((id) => usersToNotify.add(id));
    }

    // Create notifications
    for (const userId of usersToNotify) {
      await ctx.db.insert("materialNotifications", {
        materialId: args.materialId,
        recipientId: userId,
        companyId: args.companyId,
        notificationType: "material_removed",
        message: `Material "${material.title}" has been removed.`,
        isRead: false,
        createdAt: Date.now(),
      });
    }
  },
});

