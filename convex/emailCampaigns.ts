import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getEmailCampaigns = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let campaigns = await ctx.db
      .query("emailCampaigns")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.status) {
      campaigns = campaigns.filter(c => c.status === args.status);
    }

    return campaigns.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getEmailCampaignById = query({
  args: { campaignId: v.id("emailCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    return campaign;
  },
});

export const createEmailCampaign = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    templateId: v.id("emailTemplates"),
    status: v.string(),
    recipientType: v.string(),
    recipients: v.array(v.string()),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const campaignId = await ctx.db.insert("emailCampaigns", {
      companyId: args.companyId,
      name: args.name,
      templateId: args.templateId,
      status: args.status as "draft" | "scheduled" | "sending" | "sent" | "failed",
      recipientType: args.recipientType as "by_level" | "by_group" | "all_students" | "specific_users",
      recipients: args.recipients,
      scheduledAt: args.scheduledAt,
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return campaignId;
  },
});

export const updateEmailCampaign = mutation({
  args: {
    campaignId: v.id("emailCampaigns"),
    name: v.optional(v.string()),
    templateId: v.optional(v.id("emailTemplates")),
    status: v.optional(v.string()),
    recipientType: v.optional(v.string()),
    recipients: v.optional(v.array(v.string())),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { campaignId, ...updates } = args;

    const updateData: any = { updatedAt: Date.now() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.templateId !== undefined) updateData.templateId = updates.templateId;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.recipientType !== undefined) updateData.recipientType = updates.recipientType;
    if (updates.recipients !== undefined) updateData.recipients = updates.recipients;
    if (updates.scheduledAt !== undefined) updateData.scheduledAt = updates.scheduledAt;
    if (updates.sentAt !== undefined) updateData.sentAt = updates.sentAt;

    await ctx.db.patch(campaignId, updateData);
    return campaignId;
  },
});

export const updateCampaignStatus = mutation({
  args: {
    campaignId: v.id("emailCampaigns"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "sent") {
      updateData.sentAt = Date.now();
    }

    await ctx.db.patch(args.campaignId, updateData);
    return args.campaignId;
  },
});

export const updateCampaignStats = mutation({
  args: {
    campaignId: v.id("emailCampaigns"),
    sentCount: v.optional(v.number()),
    openedCount: v.optional(v.number()),
    clickedCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { campaignId, ...updates } = args;

    const updateData: any = { updatedAt: Date.now() };
    if (updates.sentCount !== undefined) updateData.sentCount = updates.sentCount;
    if (updates.openedCount !== undefined) updateData.openedCount = updates.openedCount;
    if (updates.clickedCount !== undefined) updateData.clickedCount = updates.clickedCount;

    await ctx.db.patch(campaignId, updateData);
    return campaignId;
  },
});
