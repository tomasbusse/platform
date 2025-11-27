"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// AUDIO GENERATION FOR LISTENING EXERCISES
// ============================================================================

export const generateListeningAudio = action({
  args: {
    apiKey: v.string(),
    text: v.string(),
    voiceId: v.optional(v.string()),
    speed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { apiKey, text, voiceId = "21m00Tcm4TlvDq8ikWAM", speed = 1.0 } = args;

    if (!apiKey) {
      return { success: false, message: "ElevenLabs API key is required" };
    }

    if (!text) {
      return { success: false, message: "Text is required for audio generation" };
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
            speed: speed,
          },
        }),
      });

      if (response.ok) {
        // Convert to base64 for storage
        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");
        const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

        return {
          success: true,
          message: "Audio generated successfully",
          audioDataUrl: audioDataUrl,
          duration: Math.ceil(text.length / 15), // Rough estimate: 15 chars per second
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Failed to generate audio: ${errorData.detail?.message || response.statusText}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Network error: ${error.message || "Unknown error"}`,
      };
    }
  },
});

// ============================================================================
// AI QUESTION GENERATOR
// ============================================================================

export const generateCambridgeQuestions = action({
  args: {
    apiKey: v.string(),
    level: v.string(),
    skill: v.string(),
    questionType: v.string(),
    topic: v.optional(v.string()),
    count: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      apiKey,
      level,
      skill,
      questionType,
      topic = "general",
      count = 5,
      model = "anthropic/claude-3.5-sonnet"
    } = args;

    if (!apiKey) {
      return { success: false, message: "OpenRouter API key is required", questions: [] };
    }

    const promptByType: Record<string, string> = {
      multiple_choice: `Generate ${count} Cambridge English ${level} level multiple choice questions testing ${skill}. Topic: ${topic}.

For each question provide:
- question: The question text with a blank (_____) where appropriate
- options: Array of 4 options (A, B, C, D)
- correctAnswer: The correct option text
- explanation: Why the answer is correct
- difficulty: easy/medium/hard based on ${level} level

Format as JSON array.`,

      fill_in_blank: `Generate ${count} Cambridge English ${level} level fill-in-the-blank questions testing ${skill}. Topic: ${topic}.

For each question provide:
- question: The sentence with _____ for the blank
- correctAnswer: The correct word/phrase
- options: Array of 4 possible answers (one correct)
- explanation: Why the answer is correct
- difficulty: easy/medium/hard

Format as JSON array.`,

      sentence_completion: `Generate ${count} Cambridge English ${level} level sentence completion questions testing ${skill}. Topic: ${topic}.

For each question provide:
- question: "Complete the sentence:"
- sentenceWithGap: The sentence with a gap (use _______)
- options: 4 possible completions
- correctAnswer: The correct completion
- explanation: Grammar/usage explanation

Format as JSON array.`,

      error_correction: `Generate ${count} Cambridge English ${level} level error correction questions testing ${skill}. Topic: ${topic}.

For each question provide:
- question: "Find and correct the error in this sentence:"
- sentenceWithError: A sentence containing ONE grammatical error
- options: 4 corrected versions (one correct)
- correctAnswer: The correctly corrected sentence
- explanation: What the error was and why

Format as JSON array.`,

      word_formation: `Generate ${count} Cambridge English ${level} level word formation questions testing ${skill}. Topic: ${topic}.

For each question provide:
- question: "Use the word in capitals to form a word that fits the gap:"
- sentenceWithGap: Sentence with _____ gap
- wordToTransform: The BASE WORD in capitals
- correctAnswer: The correctly transformed word
- explanation: What word formation rule was applied

Format as JSON array.`,

      reading_comprehension: `Generate a Cambridge English ${level} level reading comprehension passage about ${topic} with ${count} questions.

Provide:
- passage: A reading text appropriate for ${level} level (150-300 words)
- questions: Array of ${count} questions, each with:
  - question: The question text
  - options: 4 multiple choice options
  - correctAnswer: The correct answer
  - explanation: Where in the text the answer can be found

Format as JSON with "passage" and "questions" keys.`,

      listening: `Generate ${count} Cambridge English ${level} level listening comprehension questions. Create a dialogue or monologue script about ${topic} followed by questions.

Provide:
- script: The audio transcript (what will be spoken) - 100-200 words for ${level}
- questions: Array of ${count} questions about the script, each with:
  - question: The question text
  - options: 4 multiple choice options
  - correctAnswer: The correct answer
  - explanation: What part of the script contains the answer

Format as JSON with "script" and "questions" keys.`,
    };

    const prompt = promptByType[questionType] || promptByType.multiple_choice;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://simmonds.online",
          "X-Title": "Simmonds Language Platform",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: `You are an expert Cambridge English exam question writer. Generate questions that match the official Cambridge English exam format and difficulty for the specified CEFR level. Always respond with valid JSON only, no markdown formatting.`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        // Parse the JSON response
        let questions;
        try {
          // Remove markdown code blocks if present
          const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          questions = JSON.parse(cleanContent);
        } catch (parseError) {
          return {
            success: false,
            message: "Failed to parse AI response as JSON",
            questions: [],
            rawContent: content,
          };
        }

        return {
          success: true,
          message: `Generated ${Array.isArray(questions) ? questions.length : (questions.questions?.length || 0)} questions`,
          questions: questions,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `API Error: ${errorData.error?.message || response.statusText}`,
          questions: [],
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Network error: ${error.message || "Unknown error"}`,
        questions: [],
      };
    }
  },
});

// ============================================================================
// GENERATE COMPLETE PLACEMENT TEST
// ============================================================================

export const generateAdaptivePlacementTest = action({
  args: {
    apiKey: v.string(),
    startLevel: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, startLevel = "B1", model = "anthropic/claude-3.5-sonnet" } = args;

    if (!apiKey) {
      return { success: false, message: "OpenRouter API key is required", questions: [] };
    }

    const prompt = `Generate a complete Cambridge English placement test with 25 questions spanning all CEFR levels (A1-C2).

Structure the test with progressive difficulty:
- 4 questions at A1 level (very basic)
- 4 questions at A2 level (elementary)
- 5 questions at B1 level (intermediate)
- 5 questions at B2 level (upper intermediate)
- 4 questions at C1 level (advanced)
- 3 questions at C2 level (proficiency)

Include a mix of:
- Grammar (verb tenses, conditionals, modal verbs, articles, prepositions)
- Vocabulary (collocations, phrasal verbs, idioms)
- Reading comprehension (1-2 short passages with questions)

For each question provide:
{
  "id": "q_1",
  "type": "multiple_choice",
  "skill": "grammar" or "vocabulary" or "reading",
  "level": "A1"/"A2"/"B1"/"B2"/"C1"/"C2",
  "question": "The question text with _____ for blanks",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "The correct option text",
  "explanation": "Why this is correct",
  "points": 1-3 based on difficulty
}

Return as a JSON array of 25 questions.`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://simmonds.online",
          "X-Title": "Simmonds Language Platform",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: `You are an expert Cambridge English placement test designer. Create questions that accurately assess English proficiency across CEFR levels A1-C2. Follow Cambridge exam standards and question formats. Always respond with valid JSON only.`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 8000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        let questions;
        try {
          const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          questions = JSON.parse(cleanContent);
        } catch (parseError) {
          return {
            success: false,
            message: "Failed to parse AI response",
            questions: [],
            rawContent: content,
          };
        }

        return {
          success: true,
          message: `Generated placement test with ${Array.isArray(questions) ? questions.length : 0} questions`,
          questions: questions,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `API Error: ${errorData.error?.message || response.statusText}`,
          questions: [],
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Network error: ${error.message || "Unknown error"}`,
        questions: [],
      };
    }
  },
});

// ============================================================================
// GENERATE IMAGE-BASED VOCABULARY QUESTION
// ============================================================================

export const generateImageQuestion = action({
  args: {
    openaiApiKey: v.string(),
    word: v.string(),
    level: v.string(),
    imageModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { openaiApiKey, word, level, imageModel = "gpt-image-1" } = args;

    if (!openaiApiKey) {
      return { success: false, message: "OpenAI API key is required" };
    }

    const prompt = `A clear, simple illustration representing the English word "${word}". The image should be suitable for language learning, showing the concept in an obvious and educational way. Clean, professional style with no text. The scene should make it easy for a ${level}-level English learner to identify what is shown.`;

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: prompt,
          n: 1,
          size: "512x512",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;

        if (!imageUrl) {
          return { success: false, message: "No image URL returned" };
        }

        // Generate question options for "What does this image show?"
        const questionOptions = generateVocabularyOptions(word, level);

        return {
          success: true,
          imageUrl: imageUrl,
          question: {
            type: "image_description",
            skill: "vocabulary",
            level: level,
            questionText: "What does this image show?",
            questionData: {
              imageUrl: imageUrl,
              imageAlt: `Image representing the word: ${word}`,
              options: questionOptions.options,
              correctAnswer: word,
              explanation: `The image shows "${word}".`,
            },
            points: level === "A1" || level === "A2" ? 1 : 2,
          },
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Failed to generate image: ${errorData.error?.message || response.statusText}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Network error: ${error.message || "Unknown error"}`,
      };
    }
  },
});

// Helper function to generate vocabulary options
function generateVocabularyOptions(correctWord: string, level: string): { options: string[] } {
  // Common distractors based on level
  const distractorsByLevel: Record<string, string[]> = {
    A1: ["apple", "book", "cat", "dog", "house", "car", "tree", "ball", "chair", "table", "water", "food", "bed", "phone", "door"],
    A2: ["garden", "kitchen", "office", "street", "beach", "mountain", "river", "airport", "hospital", "restaurant", "umbrella", "bicycle", "camera", "wallet", "basket"],
    B1: ["appointment", "colleague", "equipment", "furniture", "ingredient", "luggage", "membership", "neighbourhood", "opportunity", "passenger", "receipt", "schedule", "traffic", "volunteer", "workplace"],
    B2: ["accommodation", "achievement", "advertisement", "atmosphere", "circumstance", "contribution", "determination", "embarrassment", "enthusiasm", "investigation", "negotiation", "perception", "requirement", "significance", "unemployment"],
    C1: ["acknowledgement", "acquisition", "ambiguity", "bureaucracy", "commemoration", "discrepancy", "extravagance", "fluctuation", "implication", "jurisdiction", "manifestation", "negligence", "proliferation", "reconciliation", "surveillance"],
    C2: ["acquiescence", "circumlocution", "conflagration", "disambiguation", "equivocation", "fastidiousness", "heterogeneity", "idiosyncrasy", "juxtaposition", "magnanimity", "obsequiousness", "perspicacity", "quintessence", "sycophancy", "vicissitude"],
  };

  const distractors = distractorsByLevel[level] || distractorsByLevel.B1;
  const filteredDistractors = distractors.filter(d => d.toLowerCase() !== correctWord.toLowerCase());

  // Pick 3 random distractors
  const shuffled = filteredDistractors.sort(() => Math.random() - 0.5);
  const selectedDistractors = shuffled.slice(0, 3);

  // Combine with correct answer and shuffle
  const options = [...selectedDistractors, correctWord].sort(() => Math.random() - 0.5);

  return { options };
}
