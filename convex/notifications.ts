import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getUserNotifications = query({
  args: {
    userId: v.id("users"),
    isRead: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let notificationsQuery = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId));

    const notifications = await notificationsQuery.collect();

    if (args.isRead !== undefined) {
      return notifications.filter(n => n.isRead === args.isRead);
    }

    return notifications.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getUnreadCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return notifications.filter(n => !n.isRead).length;
  },
});

export const createNotification = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    title: v.string(),
    message: v.string(),
    type: v.string(),
    isEmailSent: v.optional(v.boolean()),
    relatedEntityId: v.optional(v.string()),
    relatedEntityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      companyId: args.companyId,
      title: args.title,
      message: args.message,
      type: args.type as "info" | "success" | "warning" | "error",
      isRead: false,
      isEmailSent: args.isEmailSent ?? false,
      createdAt: Date.now(),
      relatedEntityId: args.relatedEntityId,
      relatedEntityType: args.relatedEntityType,
    });

    return notificationId;
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });

    return args.notificationId;
  },
});

export const markAllNotificationsRead = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isRead"), false))
      .collect();

    const updatePromises = notifications.map(notification =>
      ctx.db.patch(notification._id, {
        isRead: true,
        readAt: Date.now(),
      })
    );

    await Promise.all(updatePromises);

    return notifications.length;
  },
});
