import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

      if (material.accessScope === "group" && args.groupIds) {
        return material.accessGroupIds?.some((gid) =>
          args.groupIds!.includes(gid as any)
        );
      }

      if (material.accessScope === "individual" && args.userId) {
        return material.accessStudentIds?.includes(args.userId);
      }

      return false;
    });
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

    await ctx.db.patch(args.materialId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

