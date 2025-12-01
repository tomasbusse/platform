import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getUserSettings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const settingsObject: Record<string, any> = {};
    settings.forEach(setting => {
      settingsObject[setting.settingKey] = setting.settingValue;
    });

    return settingsObject;
  },
});

export const getCompanySettings = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    const settingsObject: Record<string, any> = {};
    settings.forEach(setting => {
      settingsObject[setting.settingKey] = setting.settingValue;
    });

    return settingsObject;
  },
});

export const saveUserSettings = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const existingSettings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const setting of existingSettings) {
      await ctx.db.delete(setting._id);
    }

    const settingIds = [];
    for (const [key, value] of Object.entries(args.settings)) {
      const settingId = await ctx.db.insert("settings", {
        userId: args.userId,
        companyId: args.companyId,
        settingKey: key,
        settingValue: value,
        category: "user",
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      settingIds.push(settingId);
    }

    return settingIds;
  },
});

export const saveCompanySettings = mutation({
  args: {
    companyId: v.id("companies"),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const existingSettings = await ctx.db
      .query("settings")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    for (const setting of existingSettings) {
      await ctx.db.delete(setting._id);
    }

    const settingIds = [];
    for (const [key, value] of Object.entries(args.settings)) {
      const settingId = await ctx.db.insert("settings", {
        companyId: args.companyId,
        settingKey: key,
        settingValue: value,
        category: "company",
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      settingIds.push(settingId);
    }

    const company = await ctx.db.get(args.companyId);
    if (company) {
      // Convert nested settings to flat format for company record
      const apis = args.settings.apis || {};
      const flatSettings: Record<string, unknown> = {
        openRouterApiKey: apis.openrouter?.apiKey || '',
        elevenLabsApiKey: apis.elevenlabs?.apiKey || '',
        geminiApiKey: apis.gemini?.apiKey || '',
        resendApiKey: apis.resend?.apiKey || '',
        cambridgeApiKey: apis.cambridge?.apiKey || '',
        replicateApiKey: apis.replicate?.apiKey || '',
        testFrequency: args.settings.company?.testFrequency || 30,
        autoGrouping: args.settings.company?.autoGrouping !== undefined ? args.settings.company.autoGrouping : true,
        emailNotifications: args.settings.company?.emailNotifications !== undefined ? args.settings.company.emailNotifications : true,
      };

      // Include available AI models if provided
      if (args.settings.availableAIModels) {
        flatSettings.availableAIModels = args.settings.availableAIModels;
      }

      // Build AI prompt templates if provided
      const aiPrompts = args.settings.aiPrompts;
      const aiPromptTemplates = aiPrompts ? {
        systemPrompt: aiPrompts.systemPrompt || undefined,
        presentationFormat: aiPrompts.presentationFormat || undefined,
        homeworkFormat: aiPrompts.homeworkFormat || undefined,
        defaultLanguage: aiPrompts.defaultLanguage || undefined,
      } : undefined;

      // Build voice config if provided
      const voiceConfigInput = args.settings.voiceConfig;
      const voiceConfig = voiceConfigInput ? {
        customVoices: voiceConfigInput.customVoices || undefined,
        defaultEnglishVoice: voiceConfigInput.defaultEnglishVoice || undefined,
        defaultGermanVoice: voiceConfigInput.defaultGermanVoice || undefined,
      } : undefined;

      await ctx.db.patch(args.companyId, {
        settings: flatSettings,
        ...(aiPromptTemplates && { aiPromptTemplates }),
        ...(voiceConfig && { voiceConfig }),
      });
    }

    return settingIds;
  },
});

export const updateCompanySetting = mutation({
  args: {
    companyId: v.id("companies"),
    settingKey: v.string(),
    settingValue: v.any(),
  },
  handler: async (ctx, args) => {
    const existingSetting = await ctx.db
      .query("settings")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("settingKey"), args.settingKey))
      .first();

    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        settingValue: args.settingValue,
        updatedAt: Date.now(),
      });
      return existingSetting._id;
    } else {
      const settingId = await ctx.db.insert("settings", {
        companyId: args.companyId,
        settingKey: args.settingKey,
        settingValue: args.settingValue,
        category: "company",
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return settingId;
    }
  },
});
