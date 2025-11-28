"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Available voices for quiz audio generation
 */
export const AVAILABLE_VOICES = {
  english: [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female" as const },
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Emma", gender: "female" as const },
    { id: "pNInz6obpgDQGcFmaJgB", name: "James", gender: "male" as const },
    { id: "ErXwobaYiN019PkySvjV", name: "Daniel", gender: "male" as const },
  ],
  german: [
    { id: "oWAxZDx7w5VEj9dCyTzz", name: "Freya", gender: "female" as const },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Hans", gender: "male" as const },
  ],
} as const;

export type VoiceInfo = {
  id: string;
  name: string;
  gender: "male" | "female";
};

/**
 * Generate audio from script text using ElevenLabs API
 *
 * This action converts text to speech and stores it in Convex storage,
 * returning a URL that can be used for playback.
 */
export const generateAudioFromScript = action({
  args: {
    apiKey: v.string(),
    script: v.string(),
    voiceId: v.string(),
    speed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { apiKey, script, voiceId, speed = 1.0 } = args;

    if (!apiKey) {
      throw new Error("ElevenLabs API key is required");
    }

    if (!script || script.trim().length === 0) {
      throw new Error("Script text is required");
    }

    // Validate word count
    const wordCount = script.trim().split(/\s+/).length;
    if (wordCount > 150) {
      throw new Error(`Script too long: ${wordCount} words. Maximum is 150.`);
    }

    try {
      // Call ElevenLabs API
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: script,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
              speed: speed,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail?.message || errorData.error || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(`ElevenLabs API error: ${errorMessage}`);
      }

      // Get audio data
      const audioBuffer = await response.arrayBuffer();

      // Store in Convex storage
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const storageId = await ctx.storage.store(blob);

      // Get the URL for the stored file
      const audioUrl = await ctx.storage.getUrl(storageId);

      if (!audioUrl) {
        throw new Error("Failed to get URL for stored audio");
      }

      // Estimate duration (rough: ~150 words per minute at normal speed)
      const estimatedDuration = Math.ceil((wordCount / 150) * 60);

      return {
        success: true,
        audioUrl,
        storageId,
        wordCount,
        estimatedDuration,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Audio generation error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        audioUrl: null,
        storageId: null,
        wordCount: 0,
        estimatedDuration: 0,
      };
    }
  },
});

/**
 * Generate a voice preview for the voice selector
 *
 * Uses a short sample text to demonstrate each voice.
 */
export const getVoicePreview = action({
  args: {
    apiKey: v.string(),
    voiceId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const { apiKey, voiceId, language } = args;

    if (!apiKey) {
      throw new Error("ElevenLabs API key is required");
    }

    // Use appropriate preview text based on language
    const previewText =
      language === "german"
        ? "Hallo, ich bin Ihre Lehrerin. Willkommen zum Deutschkurs. Heute lernen wir neue Vokabeln."
        : "Hello, I am your teacher. Welcome to the English course. Today we will learn new vocabulary.";

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: previewText,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();

      // Store preview in storage (could be cached)
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const storageId = await ctx.storage.store(blob);
      const audioUrl = await ctx.storage.getUrl(storageId);

      return {
        success: true,
        audioUrl,
        storageId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        audioUrl: null,
        storageId: null,
      };
    }
  },
});

/**
 * Batch generate audio for multiple listening questions
 *
 * This is more efficient when generating audio for multiple questions at once.
 */
export const generateBatchAudio = action({
  args: {
    apiKey: v.string(),
    scripts: v.array(
      v.object({
        id: v.string(),
        script: v.string(),
      })
    ),
    voiceId: v.string(),
    speed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { apiKey, scripts, voiceId, speed = 1.0 } = args;

    if (!apiKey) {
      throw new Error("ElevenLabs API key is required");
    }

    const results: Array<{
      id: string;
      success: boolean;
      audioUrl: string | null;
      storageId: string | null;
      error?: string;
    }> = [];

    // Process scripts sequentially to avoid rate limits
    for (const { id, script } of scripts) {
      try {
        // Validate word count
        const wordCount = script.trim().split(/\s+/).length;
        if (wordCount > 150) {
          results.push({
            id,
            success: false,
            audioUrl: null,
            storageId: null,
            error: `Script too long: ${wordCount} words`,
          });
          continue;
        }

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
            },
            body: JSON.stringify({
              text: script,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.75,
                similarity_boost: 0.75,
                speed: speed,
              },
            }),
          }
        );

        if (!response.ok) {
          results.push({
            id,
            success: false,
            audioUrl: null,
            storageId: null,
            error: `API error: ${response.statusText}`,
          });
          continue;
        }

        const audioBuffer = await response.arrayBuffer();
        const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
        const storageId = await ctx.storage.store(blob);
        const audioUrl = await ctx.storage.getUrl(storageId);

        results.push({
          id,
          success: true,
          audioUrl,
          storageId: storageId as string,
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          id,
          success: false,
          audioUrl: null,
          storageId: null,
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      success: successCount === scripts.length,
      results,
      totalProcessed: scripts.length,
      successCount,
      failedCount: scripts.length - successCount,
    };
  },
});

/**
 * Get available voices for a specific language
 */
export const getAvailableVoices = action({
  args: {
    language: v.string(),
  },
  handler: async (_ctx, args) => {
    const language = args.language.toLowerCase();

    if (language === "german") {
      return {
        voices: AVAILABLE_VOICES.german,
        language: "german",
      };
    }

    // Default to English
    return {
      voices: AVAILABLE_VOICES.english,
      language: "english",
    };
  },
});
