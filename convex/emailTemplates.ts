import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getEmailTemplates = query({
  args: {
    companyId: v.id("companies"),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let templates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.category) {
      templates = templates.filter(t => t.category === args.category);
    }

    if (args.isActive !== undefined) {
      templates = templates.filter(t => t.isActive === args.isActive);
    }

    return templates.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getEmailTemplateById = query({
  args: { templateId: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    return template;
  },
});

export const createEmailTemplate = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    category: v.string(),
    subject: v.string(),
    htmlContent: v.string(),
    textContent: v.string(),
    variables: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const templateId = await ctx.db.insert("emailTemplates", {
      companyId: args.companyId,
      name: args.name,
      category: args.category as "test_invitation" | "results_notification" | "progress_update" | "welcome" | "reminder",
      subject: args.subject,
      htmlContent: args.htmlContent,
      textContent: args.textContent,
      variables: args.variables,
      isActive: args.isActive,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return templateId;
  },
});

export const updateEmailTemplate = mutation({
  args: {
    templateId: v.id("emailTemplates"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    subject: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { templateId, ...updates } = args;

    const updateData: any = { updatedAt: Date.now() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.htmlContent !== undefined) updateData.htmlContent = updates.htmlContent;
    if (updates.textContent !== undefined) updateData.textContent = updates.textContent;
    if (updates.variables !== undefined) updateData.variables = updates.variables;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await ctx.db.patch(templateId, updateData);
    return templateId;
  },
});

export const toggleTemplateActive = mutation({
  args: {
    templateId: v.id("emailTemplates"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.templateId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return args.templateId;
  },
});
