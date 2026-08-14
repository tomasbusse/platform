"use node";

// Voice provider is Hume (Octave TTS) ONLY — ElevenLabs is legacy and must not be used.

import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { parsePodcastScript, parseProviderModel } from "./lessonDbLogic";
import { callOpenRouter } from "./openRouterClient";

const HUME_TTS_URL = "https://api.hume.ai/v0/tts/file";

// Hume Voice Library presets (same voices the video-generator pipeline uses).
const HOST_VOICE = { name: "Donovan Sinclair", provider: "HUME_AI" };
const GUEST_VOICE = { name: "Ava Song", provider: "HUME_AI" };

type PodcastResult =
  | { success: false; error: string }
  | {
      success: true;
      title: string;
      audioUrl: string;
      storageId: string;
      segments: number;
      blocksUsed: number;
    };

export const generatePodcast = internalAction({
  args: {
    companyId: v.union(v.id("companies"), v.string()),
    level: v.union(
      v.literal("A1"),
      v.literal("A2"),
      v.literal("B1"),
      v.literal("B2"),
      v.literal("C1"),
      v.literal("C2"),
    ),
    topic: v.optional(v.string()),
    scriptModel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PodcastResult> => {
    try {
      const scriptModel = args.scriptModel ?? "cerebras/gemma-4-31b";

      const dialogues = await ctx.runQuery(api.lessonDb.listBlocks, {
        paginationOpts: { numItems: 4, cursor: null },
        blockType: "dialogue",
        level: args.level,
      });
      const listening = await ctx.runQuery(api.lessonDb.listBlocks, {
        paginationOpts: { numItems: 2, cursor: null },
        blockType: "listeningScript",
        level: args.level,
      });
      const blocks = [...dialogues.page, ...listening.page];
      if (blocks.length === 0) {
        return { success: false, error: `no dialogue/listeningScript blocks for level ${args.level}` };
      }

      const provider = parseProviderModel(scriptModel);
      const scriptApiKey = provider.keyEnvVar
        ? process.env[provider.keyEnvVar]
        : await ctx.runQuery(internal.lessonDb.getCompanyAiKey, { companyId: args.companyId });
      if (!scriptApiKey) return { success: false, error: "no script-model api key" };

      const scriptPrompt = `Write a short podcast episode script for adult German-speaking English learners at CEFR ${args.level}.
Topic: ${args.topic ?? "everyday professional English"}.
Base it on this material from the Simmonds lesson database (adapt, don't copy verbatim):
${JSON.stringify(blocks.map((block) => ({ title: block.title, topic: block.topic, body: block.body })))}

Format: two speakers — "host" (British English teacher, warm and professional) and "guest" (adult learner, natural but correct English).
Length: 8-14 short segments, ~400 words total. English throughout; the host may add one or two very brief German clarifications where genuinely helpful. Professional adult tone, never childish.
Return ONLY JSON: {"title": "...", "segments": [{"speaker": "host"|"guest", "text": "..."}]}`;

      const scriptResponse = await callOpenRouter({
        apiKey: scriptApiKey,
        model: provider.model,
        messages: [{ role: "user", content: scriptPrompt }],
        maxTokens: 4_000,
        endpoint: provider.endpoint,
      });
      if (!scriptResponse.success) return { success: false, error: scriptResponse.error };
      const script = parsePodcastScript(scriptResponse.content);

      const humeApiKey = process.env.HUME_API_KEY;
      if (!humeApiKey) return { success: false, error: "HUME_API_KEY env var is not set" };

      const ttsResponse = await fetch(HUME_TTS_URL, {
        method: "POST",
        headers: {
          "X-Hume-Api-Key": humeApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utterances: script.segments.map((segment) => ({
            text: segment.text,
            voice: segment.speaker === "host" ? HOST_VOICE : GUEST_VOICE,
            description:
              segment.speaker === "host"
                ? "warm, clear British accent, professional English teacher hosting a podcast"
                : "adult English learner, natural conversational delivery",
          })),
          format: { type: "mp3" },
        }),
      });
      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text().catch(() => ttsResponse.statusText);
        return { success: false, error: `Hume TTS failed (${ttsResponse.status}): ${errorText}` };
      }

      const audioBytes = await ttsResponse.arrayBuffer();
      const storageId = await ctx.storage.store(new Blob([audioBytes], { type: "audio/mpeg" }));
      const audioUrl = await ctx.storage.getUrl(storageId);
      if (!audioUrl) return { success: false, error: "stored audio has no URL" };

      return {
        success: true,
        title: script.title,
        audioUrl,
        storageId,
        segments: script.segments.length,
        blocksUsed: blocks.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown podcast generation error",
      };
    }
  },
});
