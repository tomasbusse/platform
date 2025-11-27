"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// OpenAI Image Generation Action
export const generateImage = action({
  args: {
    apiKey: v.string(),
    prompt: v.string(),
    model: v.optional(v.string()),
    size: v.optional(v.string()),
    quality: v.optional(v.string()),
    style: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, prompt, model = "gpt-image-1", size = "1024x1024", quality = "auto", style = "natural" } = args;

    if (!apiKey) {
      return { success: false, message: "OpenAI API key is required" };
    }

    if (!prompt) {
      return { success: false, message: "Image prompt is required" };
    }

    try {
      // Determine endpoint based on model
      const isGptImage = model === "gpt-image-1";
      const endpoint = isGptImage
        ? "https://api.openai.com/v1/images/generations"
        : "https://api.openai.com/v1/images/generations";

      const requestBody: any = {
        model: model,
        prompt: `Educational illustration for language learning: ${prompt}. Style: clean, professional, suitable for educational content.`,
        n: 1,
        size: size,
      };

      // DALL-E 3 specific options
      if (model === "dall-e-3") {
        requestBody.quality = quality === "auto" ? "standard" : quality;
        requestBody.style = style;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

        if (!imageUrl) {
          return {
            success: false,
            message: "No image URL returned from API",
          };
        }

        return {
          success: true,
          message: "Image generated successfully",
          imageUrl: imageUrl,
          revisedPrompt: data.data?.[0]?.revised_prompt,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return {
            success: false,
            message: "API key is invalid or unauthorized.",
          };
        } else if (response.status === 400) {
          return {
            success: false,
            message: `Invalid request: ${errorData.error?.message || "Check your prompt and settings"}`,
          };
        } else if (response.status === 429) {
          return {
            success: false,
            message: "Rate limit exceeded. Please wait a moment and try again.",
          };
        } else {
          return {
            success: false,
            message: `Failed to generate image: ${errorData.error?.message || response.statusText}`,
          };
        }
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      return {
        success: false,
        message: `Network error: ${error.message || "Unknown error"}`,
      };
    }
  },
});

// Generate vocabulary card image
export const generateVocabularyImage = action({
  args: {
    apiKey: v.string(),
    word: v.string(),
    definition: v.string(),
    context: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, word, definition, context, model = "gpt-image-1" } = args;

    const prompt = `A simple, clear illustration representing the word "${word}" (${definition}). ${context ? `Context: ${context}.` : ""} The image should be easily understood by language learners, with minimal text and clear visual representation. Educational style, clean composition.`;

    // Reuse the generateImage action logic
    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          n: 1,
          size: "512x512",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          imageUrl: data.data?.[0]?.url,
          word: word,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.error?.message || "Failed to generate vocabulary image",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Network error",
      };
    }
  },
});

// HeyGen Video Generation Action
export const createHeyGenVideo = action({
  args: {
    apiKey: v.string(),
    avatarId: v.string(),
    script: v.string(),
    voiceId: v.optional(v.string()),
    background: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, avatarId, script, voiceId, background = "#ffffff" } = args;

    if (!apiKey) {
      return { success: false, message: "HeyGen API key is required" };
    }

    if (!avatarId || !script) {
      return { success: false, message: "Avatar ID and script are required" };
    }

    try {
      const requestBody: any = {
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: avatarId,
              avatar_style: "normal",
            },
            voice: voiceId
              ? { type: "audio", audio_url: voiceId }
              : {
                  type: "text",
                  input_text: script,
                  voice_id: "en-US-JennyNeural", // Default Microsoft voice
                },
            background: {
              type: "color",
              value: background,
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      };

      const response = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: "Video generation started",
          videoId: data.data?.video_id,
          status: "processing",
        };
      } else {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return {
            success: false,
            message: "API key is invalid or unauthorized.",
          };
        } else if (response.status === 400) {
          return {
            success: false,
            message: `Invalid request: ${errorData.message || "Check avatar ID and script"}`,
          };
        } else {
          return {
            success: false,
            message: `Failed to create video: ${errorData.message || response.statusText}`,
          };
        }
      }
    } catch (error: any) {
      console.error("Error creating HeyGen video:", error);
      return {
        success: false,
        message: `Network error: ${error.message || "Unknown error"}`,
      };
    }
  },
});

// Check HeyGen video status
export const checkHeyGenVideoStatus = action({
  args: {
    apiKey: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const { apiKey, videoId } = args;

    if (!apiKey || !videoId) {
      return { success: false, message: "API key and video ID are required" };
    }

    try {
      const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          status: data.data?.status,
          videoUrl: data.data?.video_url,
          thumbnailUrl: data.data?.thumbnail_url,
          duration: data.data?.duration,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || "Failed to check video status",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Network error",
      };
    }
  },
});

// Get HeyGen avatars list
export const getHeyGenAvatars = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { apiKey } = args;

    if (!apiKey) {
      return { success: false, message: "HeyGen API key is required", avatars: [] };
    }

    try {
      const response = await fetch("https://api.heygen.com/v2/avatars", {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const avatars = data.data?.avatars || [];

        return {
          success: true,
          avatars: avatars.map((avatar: any) => ({
            id: avatar.avatar_id,
            name: avatar.avatar_name,
            preview: avatar.preview_image_url,
            gender: avatar.gender,
          })),
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || "Failed to fetch avatars",
          avatars: [],
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Network error",
        avatars: [],
      };
    }
  },
});

// Create dialogue scene with two avatars
export const createDialogueScene = action({
  args: {
    apiKey: v.string(),
    avatar1Id: v.string(),
    avatar2Id: v.string(),
    dialogue: v.array(
      v.object({
        speaker: v.number(), // 1 or 2
        text: v.string(),
      })
    ),
    background: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, avatar1Id, avatar2Id, dialogue, background = "#f5f5f5" } = args;

    if (!apiKey) {
      return { success: false, message: "HeyGen API key is required" };
    }

    // For now, we'll create a simple video with the first speaker
    // Full dialogue scenes would require HeyGen's more advanced features
    const fullScript = dialogue.map((d) => d.text).join(" ");

    try {
      const requestBody = {
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: avatar1Id,
              avatar_style: "normal",
            },
            voice: {
              type: "text",
              input_text: fullScript,
              voice_id: "en-US-JennyNeural",
            },
            background: {
              type: "color",
              value: background,
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      };

      const response = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: "Dialogue scene generation started",
          videoId: data.data?.video_id,
          status: "processing",
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || "Failed to create dialogue scene",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Network error",
      };
    }
  },
});
