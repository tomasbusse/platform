import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getAudioContent = query({
  args: {
    companyId: v.id("companies"),
    type: v.optional(v.string()),
    voiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let content = await ctx.db
      .query("audioContent")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    if (args.type) {
      content = content.filter(c => c.type === args.type);
    }

    if (args.voiceId) {
      content = content.filter(c => c.voiceId === args.voiceId);
    }

    return content.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getAudioContentById = query({
  args: { audioId: v.id("audioContent") },
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.audioId);
    return audio;
  },
});

export const createAudioContent = mutation({
  args: {
    companyId: v.id("companies"),
    createdBy: v.id("users"),
    type: v.string(),
    textContent: v.string(),
    audioUrl: v.string(),
    voiceId: v.string(),
    voiceName: v.string(),
    duration: v.number(),
    language: v.string(),
    quality: v.string(),
    relatedEntityId: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const audioId = await ctx.db.insert("audioContent", {
      companyId: args.companyId,
      createdBy: args.createdBy,
      type: args.type as "lesson_audio" | "exercise_audio" | "listening_exercise",
      textContent: args.textContent,
      audioUrl: args.audioUrl,
      voiceId: args.voiceId,
      voiceName: args.voiceName,
      duration: args.duration,
      language: args.language,
      quality: args.quality,
      relatedEntityId: args.relatedEntityId,
      isActive: args.isActive,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return audioId;
  },
});

export const updateAudioContent = mutation({
  args: {
    audioId: v.id("audioContent"),
    textContent: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { audioId, ...updates } = args;

    const updateData: any = {};
    if (updates.textContent !== undefined) updateData.textContent = updates.textContent;
    if (updates.audioUrl !== undefined) updateData.audioUrl = updates.audioUrl;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await ctx.db.patch(audioId, updateData);
    return audioId;
  },
});

export const toggleAudioActive = mutation({
  args: {
    audioId: v.id("audioContent"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.audioId, {
      isActive: args.isActive,
    });

    return args.audioId;
  },
});
