"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Available question types for AI quiz generation
 */
export const QUESTION_TYPES = [
  "multiple-choice",
  "multiple-select",
  "fill-blank",
  "matching",
  "ordering",
  "true-false",
  "short-answer",
  "listening",
  "speaking",
  "image-based",
  "video-based",
  "cloze",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Generate quiz questions using Claude AI
 *
 * This action calls the Anthropic API directly to generate quiz questions
 * based on the provided configuration.
 */
// Default model to use if none specified
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export const generateQuestionsWithClaude = action({
  args: {
    apiKey: v.string(),
    language: v.string(),
    targetLevel: v.string(),
    topic: v.string(),
    numberOfQuestions: v.number(),
    questionTypes: v.array(v.string()),
    audioWordLimit: v.number(),
    documentContent: v.optional(v.string()),
    modelId: v.optional(v.string()), // Optional model ID from OpenRouter
  },
  handler: async (ctx, args) => {
    const { apiKey, language, targetLevel, topic, numberOfQuestions, questionTypes, audioWordLimit, documentContent, modelId } = args;

    // Determine which model to use (declare before try block so it's accessible in catch)
    const selectedModel = modelId || DEFAULT_MODEL;

    // Validate API key early but return error object instead of throwing
    if (!apiKey) {
      console.error("Question generation error: API key is required");
      return {
        success: false,
        error: "API key is required for question generation. Please configure your OpenRouter API key in company settings.",
        questions: [],
        generatedAt: new Date().toISOString(),
        model: selectedModel,
        questionCount: 0,
      };
    }

    try {
      // Build the prompt for Claude
      const prompt = buildQuestionGenerationPrompt({
        language,
        targetLevel,
        topic,
        numberOfQuestions,
        questionTypes,
        audioWordLimit,
        documentContent,
      });
      // Call OpenRouter API which supports multiple models
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://simmonds-platform.vercel.app",
          "X-Title": "Simmonds LMS Quiz Generator",
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 8000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || response.statusText;
        console.error("OpenRouter API error response:", JSON.stringify(errorData));
        throw new Error(
          `OpenRouter API error (${response.status}): ${errorMsg}`
        );
      }

      const data = await response.json();
      console.log("OpenRouter response received, model:", data.model);

      // Extract text from OpenRouter response format
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error("Unexpected response format:", JSON.stringify(data).substring(0, 500));
        throw new Error("Unexpected response format from AI model - no content in response");
      }

      // Parse JSON from response
      const jsonText = extractJSON(content);
      let questions;
      try {
        questions = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("JSON parse error. Raw content:", content.substring(0, 500));
        throw new Error("Failed to parse AI response as JSON. The AI may have returned invalid JSON.");
      }

      if (!Array.isArray(questions)) {
        throw new Error("Expected an array of questions from AI");
      }

      return {
        success: true,
        questions,
        generatedAt: new Date().toISOString(),
        model: selectedModel,
        questionCount: questions.length,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Question generation error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        questions: [],
        generatedAt: new Date().toISOString(),
        model: selectedModel,
        questionCount: 0,
      };
    }
  },
});

/**
 * Regenerate a single question of a specific type
 */
export const regenerateSingleQuestion = action({
  args: {
    apiKey: v.string(),
    language: v.string(),
    targetLevel: v.string(),
    topic: v.string(),
    questionType: v.string(),
    audioWordLimit: v.number(),
    modelId: v.optional(v.string()), // Optional model ID from OpenRouter
  },
  handler: async (ctx, args) => {
    const { apiKey, language, targetLevel, topic, questionType, audioWordLimit, modelId } = args;

    // Determine which model to use (declare before try block so it's accessible in catch)
    const selectedModel = modelId || DEFAULT_MODEL;

    // Validate API key early but return error object instead of throwing
    if (!apiKey) {
      console.error("Question regeneration error: API key is required");
      return {
        success: false,
        error: "API key is required for question generation. Please configure your OpenRouter API key in company settings.",
        question: null,
      };
    }

    try {
      const prompt = buildSingleQuestionPrompt({
        language,
        targetLevel,
        topic,
        questionType,
        audioWordLimit,
      });
      // Call OpenRouter API which supports multiple models
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://simmonds-platform.vercel.app",
          "X-Title": "Simmonds LMS Quiz Generator",
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Unexpected response format from AI model");
      }

      const jsonText = extractJSON(content);
      const question = JSON.parse(jsonText);

      return {
        success: true,
        question,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        question: null,
      };
    }
  },
});

/**
 * Extract JSON from text that may contain markdown code blocks
 */
function extractJSON(text: string): string {
  // Remove markdown code blocks if present
  let cleaned = text.trim();

  // Check for ```json ... ``` pattern
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  // Try to find JSON array or object
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  return cleaned;
}

/**
 * Build the main prompt for generating multiple questions
 */
function buildQuestionGenerationPrompt(args: {
  language: string;
  targetLevel: string;
  topic: string;
  numberOfQuestions: number;
  questionTypes: string[];
  audioWordLimit: number;
  documentContent?: string;
}): string {
  const { language, targetLevel, topic, numberOfQuestions, questionTypes, audioWordLimit, documentContent } = args;

  const languageName = language === "german" ? "German" : "English";

  // Build document context section if provided
  const documentSection = documentContent
    ? `\n\nSOURCE DOCUMENT CONTENT:\n"""
${documentContent}
"""

IMPORTANT: Generate questions based SPECIFICALLY on the content from the document above. The questions should test comprehension and understanding of this specific material.`
    : "";

  return `You are an expert ${languageName} language teacher creating quiz questions. Generate exactly ${numberOfQuestions} questions about "${topic}" for ${targetLevel} CEFR level students.${documentSection}

QUESTION TYPES TO CREATE: ${questionTypes.join(", ")}

Distribute the questions evenly across the selected types. If "listening" is included, create audio scripts that are MAXIMUM ${audioWordLimit} words.

RULES:
1. All content must be appropriate for ${targetLevel} CEFR level
2. Questions must be clear and have one unambiguous correct answer (except multiple-select)
3. For listening questions: write natural, conversational scripts
4. Include explanations for why answers are correct
5. Use appropriate vocabulary and grammar for the level${documentContent ? "\n6. Questions MUST be based on the provided document content" : ""}

OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown formatting, no explanation text, just the JSON.

QUESTION STRUCTURES BY TYPE:

For "multiple-choice":
{
  "type": "multiple-choice",
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "explanation": "Why this is correct"
}

For "multiple-select":
{
  "type": "multiple-select",
  "question": "Select ALL correct answers...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswers": [0, 2],
  "explanation": "Why these are correct"
}

For "fill-blank":
{
  "type": "fill-blank",
  "sentence": "She _____ to the store yesterday.",
  "correctAnswer": "went",
  "acceptableAnswers": ["went"],
  "explanation": "Past tense of 'go'"
}

For "matching":
{
  "type": "matching",
  "instruction": "Match the words to their definitions",
  "pairs": [
    { "left": "happy", "right": "feeling joy" },
    { "left": "sad", "right": "feeling sorrow" },
    { "left": "angry", "right": "feeling rage" }
  ]
}

For "ordering":
{
  "type": "ordering",
  "instruction": "Put these words in the correct order to make a sentence",
  "items": ["went", "I", "yesterday", "to", "school"],
  "correctOrder": ["I", "went", "to", "school", "yesterday"]
}

For "true-false":
{
  "type": "true-false",
  "statement": "The capital of England is London.",
  "correctAnswer": true,
  "explanation": "London is indeed the capital of England"
}

For "short-answer":
{
  "type": "short-answer",
  "question": "Describe what you did last weekend in 2-3 sentences.",
  "sampleAnswer": "Last weekend I visited my grandmother. We had lunch together and talked about old times.",
  "gradingCriteria": ["Uses past tense correctly", "Complete sentences", "Relevant to prompt"]
}

For "listening":
{
  "type": "listening",
  "audioScript": "Hello, my name is Emma. I work at a bank in London. Every morning, I take the train to work. It takes about thirty minutes.",
  "audioWordCount": 28,
  "questions": [
    {
      "question": "Where does Emma work?",
      "type": "multiple-choice",
      "options": ["At a school", "At a bank", "At a hospital", "At a shop"],
      "correctAnswer": 1
    },
    {
      "question": "How does Emma get to work?",
      "type": "multiple-choice",
      "options": ["By bus", "By car", "By train", "On foot"],
      "correctAnswer": 2
    }
  ]
}

For "speaking":
{
  "type": "speaking",
  "prompt": "Introduce yourself. Say your name, where you are from, and what you do.",
  "sampleResponse": "Hello, my name is John. I am from Germany. I am a student.",
  "gradingCriteria": ["Clear pronunciation", "Complete sentences", "Relevant information"]
}

For "image-based":
{
  "type": "image-based",
  "imageDescription": "A picture of a family having dinner at a restaurant",
  "imageKeywords": ["family", "restaurant", "dinner", "eating"],
  "question": "What are the people doing in this picture?",
  "responseType": "multiple-choice",
  "options": ["They are cooking", "They are eating at a restaurant", "They are shopping", "They are sleeping"],
  "correctAnswer": 1
}

For "video-based":
{
  "type": "video-based",
  "videoDescription": "A short clip of someone ordering coffee at a cafe",
  "questions": [
    {
      "question": "What does the customer order?",
      "type": "multiple-choice",
      "options": ["Tea", "Coffee", "Juice", "Water"],
      "correctAnswer": 1
    }
  ]
}

For "cloze":
{
  "type": "cloze",
  "instruction": "Fill in all the blanks in this passage",
  "passage": "Yesterday I {{1}} to the park with my friends. We {{2}} football for two hours. After that, we {{3}} very tired but happy.",
  "blanks": [
    { "id": 1, "correctAnswer": "went", "acceptableAnswers": ["went"] },
    { "id": 2, "correctAnswer": "played", "acceptableAnswers": ["played"] },
    { "id": 3, "correctAnswer": "were", "acceptableAnswers": ["were", "felt"] }
  ]
}

Now generate exactly ${numberOfQuestions} questions. Return ONLY the JSON array:`;
}

/**
 * Build prompt for regenerating a single question
 */
function buildSingleQuestionPrompt(args: {
  language: string;
  targetLevel: string;
  topic: string;
  questionType: string;
  audioWordLimit: number;
}): string {
  const { language, targetLevel, topic, questionType, audioWordLimit } = args;
  const languageName = language === "german" ? "German" : "English";

  const typeExamples: Record<string, string> = {
    "multiple-choice": `{
  "type": "multiple-choice",
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "explanation": "Why this is correct"
}`,
    "multiple-select": `{
  "type": "multiple-select",
  "question": "Select ALL correct answers...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswers": [0, 2],
  "explanation": "Why these are correct"
}`,
    "fill-blank": `{
  "type": "fill-blank",
  "sentence": "She _____ to the store yesterday.",
  "correctAnswer": "went",
  "acceptableAnswers": ["went"],
  "explanation": "Past tense of 'go'"
}`,
    "matching": `{
  "type": "matching",
  "instruction": "Match the words to their definitions",
  "pairs": [
    { "left": "word1", "right": "definition1" },
    { "left": "word2", "right": "definition2" },
    { "left": "word3", "right": "definition3" }
  ]
}`,
    "ordering": `{
  "type": "ordering",
  "instruction": "Put these words in the correct order",
  "items": ["word1", "word2", "word3", "word4"],
  "correctOrder": ["word2", "word1", "word4", "word3"]
}`,
    "true-false": `{
  "type": "true-false",
  "statement": "A statement to evaluate",
  "correctAnswer": true,
  "explanation": "Why this is true/false"
}`,
    "short-answer": `{
  "type": "short-answer",
  "question": "A question requiring a written response",
  "sampleAnswer": "An example of a good answer",
  "gradingCriteria": ["Criterion 1", "Criterion 2"]
}`,
    "listening": `{
  "type": "listening",
  "audioScript": "The audio transcript (max ${audioWordLimit} words)",
  "audioWordCount": 30,
  "questions": [
    {
      "question": "Question about the audio",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}`,
    "speaking": `{
  "type": "speaking",
  "prompt": "Instructions for what to say",
  "sampleResponse": "An example response",
  "gradingCriteria": ["Criterion 1", "Criterion 2"]
}`,
    "image-based": `{
  "type": "image-based",
  "imageDescription": "Description of the image",
  "imageKeywords": ["keyword1", "keyword2"],
  "question": "Question about the image",
  "responseType": "multiple-choice",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0
}`,
    "video-based": `{
  "type": "video-based",
  "videoDescription": "Description of the video content",
  "questions": [
    {
      "question": "Question about the video",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}`,
    "cloze": `{
  "type": "cloze",
  "instruction": "Fill in all the blanks",
  "passage": "A passage with {{1}} blanks {{2}} to fill.",
  "blanks": [
    { "id": 1, "correctAnswer": "answer1", "acceptableAnswers": ["answer1"] },
    { "id": 2, "correctAnswer": "answer2", "acceptableAnswers": ["answer2"] }
  ]
}`,
  };

  return `You are an expert ${languageName} language teacher. Generate ONE ${questionType} question about "${topic}" for ${targetLevel} CEFR level students.

Return ONLY a valid JSON object matching this structure:

${typeExamples[questionType] || typeExamples["multiple-choice"]}

RULES:
1. Content must be appropriate for ${targetLevel} level
2. Question must be clear and unambiguous
3. Include a helpful explanation
${questionType === "listening" ? `4. Audio script must be MAXIMUM ${audioWordLimit} words` : ""}

Return ONLY the JSON object, no markdown, no explanation:`;
}
