# AI-Powered Quiz Creation Module - Developer Implementation Guide

## Project: Simmonds LMS
## Module: Quiz Creation with AI & ElevenLabs Audio
## Version: 2.0

---

# Part 1: Understanding the Feature

## Who Can Create Quizzes?

| Role | Can Create | Can See |
|------|------------|---------|
| Admin | ✅ Yes | All quizzes (entire platform) |
| Teacher | ✅ Yes | Only their own quizzes |
| Student | ❌ No | Only quizzes assigned to them |

## Who Can Be Assigned a Quiz?

Quizzes can be assigned to:
- **Individual Student** - One specific person
- **Group** - A class/group of students
- **Company** - All students from a corporate client

---

# Part 2: The 12 Question Types

**IMPORTANT:** Currently only 4 types are implemented. You must add all 12.

| # | Type | What It Is | Example Use |
|---|------|------------|-------------|
| 1 | **Multiple Choice** | 4 options, pick ONE correct | "Which word means 'happy'?" |
| 2 | **Multiple Select** | 4+ options, pick ALL correct | "Select all past tense verbs" |
| 3 | **Fill in Blank** | Type the missing word | "She _____ to school yesterday" |
| 4 | **Matching** | Drag items to match pairs | Match words to definitions |
| 5 | **Ordering** | Drag to arrange in sequence | Put sentence words in order |
| 6 | **True/False** | Is statement true or false? | "London is in France" → False |
| 7 | **Short Answer** | Type a written response | "Describe your weekend" |
| 8 | **Listening** | Listen to audio, answer questions | Hear dialogue, answer about it |
| 9 | **Speaking** | Record voice response | "Pronounce this word" |
| 10 | **Image-Based** | Look at picture, answer question | "What is this object?" |
| 11 | **Video-Based** | Watch video, answer questions | Watch clip, answer comprehension |
| 12 | **Cloze** | Passage with multiple blanks | Fill 5 gaps in a paragraph |

---

# Part 3: Quiz Creation Modes

The system supports TWO ways to create quizzes:

```
┌─────────────────────────────────────────────────────┐
│           CREATE NEW QUIZ                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌─────────────┐       ┌─────────────┐            │
│   │   MANUAL    │       │ AI-ASSISTED │            │
│   │  CREATION   │       │  CREATION   │            │
│   └─────────────┘       └─────────────┘            │
│                                                     │
│   Create each            Tell AI what you          │
│   question by hand       want, it generates        │
│                          questions for you         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Manual Creation** = Teacher types every question, option, and answer themselves
**AI-Assisted** = Teacher provides topic/settings, Claude generates questions, teacher reviews/edits

---

# Part 4: AI Quiz Generation - Step by Step Flow

This is the core of the feature. Follow these steps exactly.

## Overview Diagram

```
USER FLOW:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Step 1  │───▶│  Step 2  │───▶│  Step 3  │───▶│  Step 4  │───▶│  Step 5  │
│  Config  │    │ Generate │    │  Audio   │    │  Review  │    │   Save   │
│   Form   │    │Questions │    │(if needed│    │  & Edit  │    │  Quiz    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## STEP 1: Configuration Form

**What happens:** User fills out a form with quiz settings.

### Form Fields

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI QUIZ GENERATOR                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Quiz Title: [_________________________________]                │
│                                                                 │
│  Language:   [English ▼]     Target Level: [B1 ▼]              │
│                                                                 │
│  Topic/Theme: [________________________________________]        │
│  (e.g., "Business meetings", "Travel vocabulary")               │
│                                                                 │
│  Number of Questions: [15]  (slider or input, 5-50)            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  QUESTION TYPES TO INCLUDE:                                     │
│                                                                 │
│  ☑ Multiple Choice      ☑ Fill in Blank     ☐ Matching         │
│  ☐ Multiple Select      ☑ True/False        ☐ Ordering         │
│  ☐ Short Answer         ☑ Listening         ☐ Speaking         │
│  ☐ Image-Based          ☐ Video-Based       ☐ Cloze            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  AUDIO SETTINGS (shown if Listening is checked):                │
│                                                                 │
│  Max words per audio: [50]  (slider 20-150)                    │
│                                                                 │
│  Voice Selection:                                               │
│  ○ Female Voice 1 (Sarah)  [▶ Preview]                         │
│  ● Female Voice 2 (Emma)   [▶ Preview]                         │
│  ○ Male Voice 1 (James)    [▶ Preview]                         │
│  ○ Male Voice 2 (Daniel)   [▶ Preview]                         │
│                                                                 │
│  Audio Replays Allowed: [3]  (dropdown 0-10)                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  ASSIGNMENT (optional - can also assign later):                 │
│                                                                 │
│  Assign to: ○ Nobody yet  ○ Student  ○ Group  ○ Company        │
│                                                                 │
│  Time Limit: [30] minutes  ☐ No time limit                     │
│                                                                 │
│                              [Generate Quiz with AI]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Form Data Structure

```typescript
interface QuizGenerationConfig {
  // Basic Info
  title: string;
  language: 'english' | 'german';
  targetLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topic: string;
  numberOfQuestions: number; // 5-50
  
  // Question Types (at least one must be selected)
  questionTypes: QuestionType[];
  
  // Audio Settings (only relevant if 'listening' is in questionTypes)
  audioWordLimit: number; // 20-150
  selectedVoiceId: string;
  replaysAllowed: number; // 0-10
  
  // Assignment (optional)
  assignTo?: {
    type: 'student' | 'group' | 'company';
    id: string;
  };
  
  // Time
  timeLimitMinutes?: number;
}

type QuestionType = 
  | 'multiple-choice'
  | 'multiple-select'
  | 'fill-blank'
  | 'matching'
  | 'ordering'
  | 'true-false'
  | 'short-answer'
  | 'listening'
  | 'speaking'
  | 'image-based'
  | 'video-based'
  | 'cloze';
```

---

## STEP 2: Generate Questions with Claude AI

**What happens:** System sends the config to Claude API, Claude returns question data.

### How It Works (Simple Explanation)

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│   User's Form   │────────▶│   Claude API    │────────▶│  JSON Questions │
│     Config      │         │   (Anthropic)   │         │      Array      │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘

We send:                    Claude creates:             We receive:
- Topic                     - Questions                 - Array of question
- Level                     - Options                     objects ready to
- Number of questions       - Correct answers             use (but no audio
- Question types            - Explanations                URLs yet)
- Word limit for audio
```

### The Claude API Call

**File:** `convex/ai/generateQuestions.ts`

```typescript
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

export const generateQuestionsWithClaude = action({
  args: {
    language: v.string(),
    targetLevel: v.string(),
    topic: v.string(),
    numberOfQuestions: v.number(),
    questionTypes: v.array(v.string()),
    audioWordLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build the prompt
    const prompt = buildQuestionGenerationPrompt(args);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text from response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Parse JSON from Claude's response
    const questions = JSON.parse(content.text);

    return {
      questions,
      generatedAt: new Date().toISOString(),
    };
  },
});

function buildQuestionGenerationPrompt(args: {
  language: string;
  targetLevel: string;
  topic: string;
  numberOfQuestions: number;
  questionTypes: string[];
  audioWordLimit: number;
}): string {
  
  return `You are an expert ${args.language} language teacher. Create a quiz for ${args.targetLevel} level students.

TASK: Generate exactly ${args.numberOfQuestions} questions about "${args.topic}".

QUESTION TYPES TO CREATE: ${args.questionTypes.join(', ')}

Distribute the questions across the selected types. If "listening" is included, create audio scripts that are MAXIMUM ${args.audioWordLimit} words.

RULES:
1. All content must be appropriate for ${args.targetLevel} CEFR level
2. Questions must be clear and have one unambiguous correct answer
3. For listening questions: write natural, conversational scripts
4. Include explanations for why answers are correct

OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown, no explanation text.

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

Now generate the quiz:`;
}
```

### What Claude Returns

Claude returns a JSON array like this:

```json
[
  {
    "type": "multiple-choice",
    "question": "Which word means 'to begin'?",
    "options": ["finish", "start", "stop", "continue"],
    "correctAnswer": 1,
    "explanation": "'Start' means to begin something"
  },
  {
    "type": "listening",
    "audioScript": "Good morning! Welcome to City Bank. How can I help you today? I would like to open a new account please.",
    "audioWordCount": 22,
    "questions": [
      {
        "question": "Where is this conversation taking place?",
        "type": "multiple-choice",
        "options": ["At a restaurant", "At a bank", "At a hospital", "At a school"],
        "correctAnswer": 1
      }
    ]
  },
  {
    "type": "fill-blank",
    "sentence": "She _____ English every day.",
    "correctAnswer": "studies",
    "acceptableAnswers": ["studies", "learns"],
    "explanation": "Present simple for routine actions"
  }
]
```

**Note:** Listening questions have `audioScript` but NO `audioUrl` yet. That comes in Step 3.

---

## STEP 3: Generate Audio for Listening Questions

**What happens:** For each listening question, we send the script to ElevenLabs and get back an audio file.

### How It Works

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│   Audio Script  │────────▶│  ElevenLabs API │────────▶│   Audio File    │
│   (text)        │         │                 │         │   (MP3 URL)     │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘

We send:                    ElevenLabs:                 We receive:
- The script text           - Converts to speech        - MP3 audio file
- Voice ID                  - Uses selected voice       - We store it and
- Speed settings                                          get a URL
```

### The Process (Step by Step)

```
FOR EACH question in the quiz:
  
  IF question.type === "listening":
    
    1. Take the audioScript text
    2. Check word count (must be ≤ audioWordLimit)
    3. Send to ElevenLabs with selected voice
    4. Receive MP3 audio data
    5. Upload to Convex storage
    6. Get URL for the stored file
    7. Add audioUrl to the question object
    
  END IF
  
END FOR
```

### ElevenLabs API Call

**File:** `convex/ai/generateAudio.ts`

```typescript
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

// Available voices for preview and selection
export const AVAILABLE_VOICES = {
  english: [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", preview: true },
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Emma", gender: "female", preview: true },
    { id: "pNInz6obpgDQGcFmaJgB", name: "James", gender: "male", preview: true },
    { id: "ErXwobaYiN019PkySvjV", name: "Daniel", gender: "male", preview: true },
  ],
  german: [
    { id: "oWAxZDx7w5VEj9dCyTzz", name: "Freya", gender: "female", preview: true },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Hans", gender: "male", preview: true },
  ],
};

export const generateAudioFromScript = action({
  args: {
    script: v.string(),
    voiceId: v.string(),
    speed: v.optional(v.number()), // 0.7 to 1.3, default 1.0
  },
  handler: async (ctx, args) => {
    // Step 1: Validate word count
    const wordCount = args.script.trim().split(/\s+/).length;
    if (wordCount > 150) {
      throw new Error(`Script too long: ${wordCount} words. Maximum is 150.`);
    }

    // Step 2: Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: args.script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            speed: args.speed || 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs error: ${error}`);
    }

    // Step 3: Get audio data
    const audioBuffer = await response.arrayBuffer();

    // Step 4: Upload to Convex storage
    const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const storageId = await ctx.storage.store(blob);

    // Step 5: Get the URL
    const audioUrl = await ctx.storage.getUrl(storageId);

    return {
      audioUrl,
      storageId,
      wordCount,
    };
  },
});

// For voice preview in the UI
export const getVoicePreview = action({
  args: {
    voiceId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const previewText = args.language === "german" 
      ? "Hallo, ich bin Ihre Lehrerin. Willkommen zum Deutschkurs."
      : "Hello, I am your teacher. Welcome to the English course.";

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: previewText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    const audioBuffer = await response.arrayBuffer();
    const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const storageId = await ctx.storage.store(blob);
    const audioUrl = await ctx.storage.getUrl(storageId);

    return { audioUrl };
  },
});
```

### Updated Question After Audio Generation

Before:
```json
{
  "type": "listening",
  "audioScript": "Good morning! Welcome to City Bank...",
  "audioWordCount": 22,
  "questions": [...]
}
```

After:
```json
{
  "type": "listening",
  "audioScript": "Good morning! Welcome to City Bank...",
  "audioWordCount": 22,
  "audioUrl": "https://convex-storage.com/abc123.mp3",
  "audioStorageId": "abc123",
  "questions": [...]
}
```

---

## STEP 4: Review and Edit

**What happens:** User sees all generated questions and can edit any of them before saving.

### Review Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  REVIEW GENERATED QUIZ                                          │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Title: Business English Basics                                 │
│  Level: B1  |  Questions: 15  |  Topic: Business meetings       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Question 1 of 15                          [Multiple Choice]    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Which word means 'to begin'?                              │  │
│  │                                                           │  │
│  │ A) finish                                                 │  │
│  │ B) start  ✓                                               │  │
│  │ C) stop                                                   │  │
│  │ D) continue                                               │  │
│  │                                                           │  │
│  │ [Edit Question]  [Delete]  [Regenerate]                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Question 2 of 15                              [Listening]      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🔊 Audio: "Good morning! Welcome to City Bank..."         │  │
│  │    [▶ Play Audio]  Words: 22/50                           │  │
│  │                                                           │  │
│  │ Q: Where is this conversation taking place?               │  │
│  │ A) At a restaurant                                        │  │
│  │ B) At a bank  ✓                                           │  │
│  │ C) At a hospital                                          │  │
│  │ D) At a school                                            │  │
│  │                                                           │  │
│  │ [Edit Question]  [Edit Audio Script]  [Delete]            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ... more questions ...                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [← Back to Config]    [Add Manual Question]    [Save Quiz →]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Edit Capabilities

Teachers can:

1. **Edit any question text** - Click edit, modify, save
2. **Edit options/answers** - Change wording, change correct answer
3. **Edit audio script** - If changed, regenerate audio automatically
4. **Delete a question** - Remove it entirely
5. **Regenerate a question** - Ask AI to create a new one of same type
6. **Add manual question** - Insert a hand-written question
7. **Reorder questions** - Drag to change sequence

### Edit Modal Example

```
┌─────────────────────────────────────────────────────────────────┐
│  EDIT QUESTION                                         [X]      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Question Type: Multiple Choice                                 │
│                                                                 │
│  Question Text:                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Which word means 'to begin'?                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Options:                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ A: [finish                    ]                           │  │
│  │ B: [start                     ]  ● Correct Answer         │  │
│  │ C: [stop                      ]                           │  │
│  │ D: [continue                  ]                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Explanation (shown after answer):                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 'Start' means to begin something                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│                              [Cancel]    [Save Changes]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Edit Audio Script Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  EDIT AUDIO SCRIPT                                     [X]      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Current Audio: [▶ Play]                                        │
│                                                                 │
│  Script Text:                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Good morning! Welcome to City Bank. How can I help you    │  │
│  │ today? I would like to open a new account please.         │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  Words: 22 / 50 maximum                                         │
│                                                                 │
│  Voice: [Emma (Female) ▼]    [▶ Preview Voice]                 │
│                                                                 │
│  ⚠️ Changing the script will regenerate the audio              │
│                                                                 │
│                      [Cancel]    [Save & Regenerate Audio]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## STEP 5: Save Quiz

**What happens:** Quiz is saved to database with all questions and settings.

### Database Schema

**File:** `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Quiz table
  quizzes: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    language: v.string(),
    targetLevel: v.string(),
    topic: v.string(),
    
    // Creator info
    createdBy: v.id("users"),
    createdByRole: v.union(v.literal("admin"), v.literal("teacher")),
    createdAt: v.number(),
    updatedAt: v.number(),
    
    // Settings
    timeLimitMinutes: v.optional(v.number()),
    shuffleQuestions: v.boolean(),
    showExplanations: v.boolean(),
    
    // Audio settings (for listening questions)
    audioSettings: v.optional(v.object({
      voiceId: v.string(),
      voiceName: v.string(),
      replaysAllowed: v.number(), // 0-10
    })),
    
    // Generation metadata
    generatedWithAI: v.boolean(),
    aiMetadata: v.optional(v.object({
      generatedAt: v.string(),
      model: v.string(),
    })),
    
    // Status
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    
    // Question count (denormalized for quick access)
    questionCount: v.number(),
  })
    .index("by_creator", ["createdBy"])
    .index("by_status", ["status"]),

  // Questions table (separate for flexibility)
  questions: defineTable({
    quizId: v.id("quizzes"),
    orderIndex: v.number(),
    type: v.string(), // 'multiple-choice', 'listening', etc.
    
    // The full question data (varies by type)
    data: v.any(),
    
    // Points for this question
    points: v.number(),
    
    // For listening questions
    audioUrl: v.optional(v.string()),
    audioStorageId: v.optional(v.id("_storage")),
    audioScript: v.optional(v.string()),
  })
    .index("by_quiz", ["quizId"]),

  // Quiz assignments
  quizAssignments: defineTable({
    quizId: v.id("quizzes"),
    
    // Who is assigned
    assignmentType: v.union(
      v.literal("student"),
      v.literal("group"),
      v.literal("company")
    ),
    assigneeId: v.string(), // ID of student, group, or company
    
    // Assignment details
    assignedBy: v.id("users"),
    assignedAt: v.number(),
    dueDate: v.optional(v.number()),
    
    // Status
    status: v.union(
      v.literal("assigned"),
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("overdue")
    ),
  })
    .index("by_quiz", ["quizId"])
    .index("by_assignee", ["assignmentType", "assigneeId"]),
});
```

### Save Quiz Function

**File:** `convex/quizzes.ts`

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveGeneratedQuiz = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    language: v.string(),
    targetLevel: v.string(),
    topic: v.string(),
    timeLimitMinutes: v.optional(v.number()),
    audioSettings: v.optional(v.object({
      voiceId: v.string(),
      voiceName: v.string(),
      replaysAllowed: v.number(),
    })),
    questions: v.array(v.any()),
    aiMetadata: v.optional(v.object({
      generatedAt: v.string(),
      model: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");
    if (user.role !== "admin" && user.role !== "teacher") {
      throw new Error("Only admins and teachers can create quizzes");
    }

    const now = Date.now();

    // Create the quiz
    const quizId = await ctx.db.insert("quizzes", {
      title: args.title,
      description: args.description,
      language: args.language,
      targetLevel: args.targetLevel,
      topic: args.topic,
      createdBy: user._id,
      createdByRole: user.role,
      createdAt: now,
      updatedAt: now,
      timeLimitMinutes: args.timeLimitMinutes,
      shuffleQuestions: false,
      showExplanations: true,
      audioSettings: args.audioSettings,
      generatedWithAI: !!args.aiMetadata,
      aiMetadata: args.aiMetadata,
      status: "draft",
      questionCount: args.questions.length,
    });

    // Insert each question
    for (let i = 0; i < args.questions.length; i++) {
      const q = args.questions[i];
      
      await ctx.db.insert("questions", {
        quizId,
        orderIndex: i,
        type: q.type,
        data: q,
        points: 1, // Default 1 point per question
        audioUrl: q.audioUrl,
        audioStorageId: q.audioStorageId,
        audioScript: q.audioScript,
      });
    }

    return quizId;
  },
});

// Get quizzes for current user (respects role permissions)
export const getMyQuizzes = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    // Admins see all quizzes
    if (user.role === "admin") {
      return await ctx.db.query("quizzes").collect();
    }

    // Teachers see only their own
    if (user.role === "teacher") {
      return await ctx.db
        .query("quizzes")
        .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
        .collect();
    }

    // Students don't see quiz management
    return [];
  },
});
```

---

# Part 5: UI Components to Build

## Component Checklist

| Component | Purpose | Priority |
|-----------|---------|----------|
| `QuizCreationModeSelector` | Toggle between Manual/AI modes | High |
| `AIQuizConfigForm` | Form for AI generation settings | High |
| `VoiceSelector` | Pick and preview ElevenLabs voices | High |
| `QuestionTypeSelector` | Multi-select for question types | High |
| `GenerationProgress` | Show progress during generation | High |
| `QuizReviewPanel` | Display generated questions for review | High |
| `QuestionEditor` | Edit any question type | High |
| `AudioScriptEditor` | Edit audio script + regenerate | High |
| `AudioPlayer` | Modern player with replay limits | High |
| `QuizAssignment` | Assign to student/group/company | Medium |

---

## Audio Player Component

**File:** `components/quiz/AudioPlayer.tsx`

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  replaysAllowed: number; // 0-10
  onComplete?: () => void;
}

export function AudioPlayer({ audioUrl, replaysAllowed, onComplete }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  const replaysRemaining = replaysAllowed - replaysUsed;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress(audio.currentTime);
    };

    const handleLoaded = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setHasPlayedOnce(true);
      onComplete?.();
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onComplete]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Check if can play (first time or has replays)
      if (hasPlayedOnce && replaysRemaining <= 0) {
        return; // No replays left
      }
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReplay = () => {
    if (replaysRemaining <= 0) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio.play();
    setIsPlaying(true);
    setReplaysUsed(prev => prev + 1);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200 shadow-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Main Play Button */}
          <button
            onClick={togglePlay}
            disabled={hasPlayedOnce && replaysRemaining <= 0}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center
              transition-all duration-200 transform
              ${hasPlayedOnce && replaysRemaining <= 0
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white hover:scale-105 hover:shadow-lg active:scale-95"
              }
            `}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>

          {/* Replay Button */}
          {replaysAllowed > 0 && (
            <button
              onClick={handleReplay}
              disabled={replaysRemaining <= 0 || isPlaying}
              className={`
                w-11 h-11 rounded-full flex items-center justify-center
                transition-all duration-200
                ${replaysRemaining <= 0 || isPlaying
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                }
              `}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}

          {/* Mute Button */}
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Replay Counter */}
        {replaysAllowed > 0 && (
          <div className="text-sm font-medium">
            <span className={replaysRemaining === 0 ? "text-red-500" : "text-slate-600"}>
              {replaysRemaining} replay{replaysRemaining !== 1 ? "s" : ""} left
            </span>
          </div>
        )}
      </div>

      {/* Instruction */}
      {!hasPlayedOnce && (
        <p className="text-center text-sm text-slate-500 mt-4">
          Press play to listen to the audio.
          {replaysAllowed > 0 && ` You can replay ${replaysAllowed} time${replaysAllowed !== 1 ? "s" : ""}.`}
        </p>
      )}

      {/* No replays warning */}
      {hasPlayedOnce && replaysRemaining === 0 && (
        <p className="text-center text-sm text-amber-600 mt-4">
          No replays remaining. Answer the questions based on what you heard.
        </p>
      )}
    </div>
  );
}
```

---

## Voice Selector with Preview

**File:** `components/quiz/VoiceSelector.tsx`

```tsx
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Play, Loader2, Check } from "lucide-react";

interface Voice {
  id: string;
  name: string;
  gender: "male" | "female";
}

interface VoiceSelectorProps {
  language: "english" | "german";
  selectedVoiceId: string;
  onSelect: (voiceId: string, voiceName: string) => void;
}

const VOICES: Record<string, Voice[]> = {
  english: [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female" },
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Emma", gender: "female" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "James", gender: "male" },
    { id: "ErXwobaYiN019PkySvjV", name: "Daniel", gender: "male" },
  ],
  german: [
    { id: "oWAxZDx7w5VEj9dCyTzz", name: "Freya", gender: "female" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Hans", gender: "male" },
  ],
};

export function VoiceSelector({ language, selectedVoiceId, onSelect }: VoiceSelectorProps) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  
  const getPreview = useAction(api.ai.generateAudio.getVoicePreview);

  const handlePreview = async (voiceId: string) => {
    // Stop any current preview
    if (previewAudio) {
      previewAudio.pause();
    }

    setPreviewingVoice(voiceId);

    try {
      const result = await getPreview({ voiceId, language });
      
      const audio = new Audio(result.audioUrl);
      audio.onended = () => setPreviewingVoice(null);
      audio.play();
      setPreviewAudio(audio);
    } catch (error) {
      console.error("Preview failed:", error);
      setPreviewingVoice(null);
    }
  };

  const voices = VOICES[language] || VOICES.english;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Select Voice for Audio
      </label>
      
      <div className="grid gap-2">
        {voices.map((voice) => (
          <div
            key={voice.id}
            className={`
              flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer
              transition-all duration-200
              ${selectedVoiceId === voice.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
              }
            `}
            onClick={() => onSelect(voice.id, voice.name)}
          >
            <div className="flex items-center gap-3">
              {/* Selection indicator */}
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${selectedVoiceId === voice.id
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
                }
              `}>
                {selectedVoiceId === voice.id && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              
              {/* Voice info */}
              <div>
                <p className="font-medium text-gray-900">{voice.name}</p>
                <p className="text-sm text-gray-500 capitalize">{voice.gender}</p>
              </div>
            </div>

            {/* Preview button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(voice.id);
              }}
              disabled={previewingVoice === voice.id}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium
                flex items-center gap-1.5 transition-all
                ${previewingVoice === voice.id
                  ? "bg-gray-100 text-gray-400"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
            >
              {previewingVoice === voice.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Playing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Preview
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

# Part 6: Complete Generation Flow Component

**File:** `components/quiz/AIQuizGenerator.tsx`

```tsx
"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Sparkles, Check, AlertCircle, ChevronRight } from "lucide-react";

// Import sub-components (you need to build these)
import { AIQuizConfigForm } from "./AIQuizConfigForm";
import { QuizReviewPanel } from "./QuizReviewPanel";

type Step = "config" | "generating" | "audio" | "review" | "saving" | "done";

export function AIQuizGenerator() {
  const [step, setStep] = useState<Step>("config");
  const [config, setConfig] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [savedQuizId, setSavedQuizId] = useState<string | null>(null);

  // Convex actions and mutations
  const generateQuestions = useAction(api.ai.generateQuestions.generateQuestionsWithClaude);
  const generateAudio = useAction(api.ai.generateAudio.generateAudioFromScript);
  const saveQuiz = useMutation(api.quizzes.saveGeneratedQuiz);

  // STEP 1: User submits config form
  const handleConfigSubmit = async (formData: any) => {
    setConfig(formData);
    setError(null);
    setStep("generating");

    try {
      // STEP 2: Generate questions with Claude
      console.log("Generating questions with Claude...");
      
      const result = await generateQuestions({
        language: formData.language,
        targetLevel: formData.targetLevel,
        topic: formData.topic,
        numberOfQuestions: formData.numberOfQuestions,
        questionTypes: formData.questionTypes,
        audioWordLimit: formData.audioWordLimit,
      });

      let generatedQuestions = result.questions;

      // STEP 3: Generate audio for listening questions
      const listeningQuestions = generatedQuestions.filter(
        (q: any) => q.type === "listening" && q.audioScript
      );

      if (listeningQuestions.length > 0) {
        setStep("audio");
        setAudioProgress({ current: 0, total: listeningQuestions.length });

        for (let i = 0; i < generatedQuestions.length; i++) {
          const q = generatedQuestions[i];
          
          if (q.type === "listening" && q.audioScript) {
            console.log(`Generating audio ${i + 1}...`);
            
            const audioResult = await generateAudio({
              script: q.audioScript,
              voiceId: formData.selectedVoiceId,
            });

            // Add audio URL to question
            generatedQuestions[i] = {
              ...q,
              audioUrl: audioResult.audioUrl,
              audioStorageId: audioResult.storageId,
            };

            setAudioProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
        }
      }

      // STEP 4: Show review
      setQuestions(generatedQuestions);
      setStep("review");

    } catch (err) {
      console.error("Generation failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("config");
    }
  };

  // STEP 5: User saves the quiz
  const handleSave = async (editedQuestions: any[]) => {
    setStep("saving");

    try {
      const quizId = await saveQuiz({
        title: config.title,
        description: `AI-generated quiz about ${config.topic}`,
        language: config.language,
        targetLevel: config.targetLevel,
        topic: config.topic,
        timeLimitMinutes: config.timeLimitMinutes,
        audioSettings: config.includeAudio ? {
          voiceId: config.selectedVoiceId,
          voiceName: config.selectedVoiceName,
          replaysAllowed: config.replaysAllowed,
        } : undefined,
        questions: editedQuestions,
        aiMetadata: {
          generatedAt: new Date().toISOString(),
          model: "claude-sonnet-4-20250514",
        },
      });

      setSavedQuizId(quizId);
      setStep("done");

    } catch (err) {
      console.error("Save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save quiz");
      setStep("review");
    }
  };

  // Render based on current step
  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm">
          {[
            { key: "config", label: "Configure" },
            { key: "generating", label: "Generate" },
            { key: "audio", label: "Audio" },
            { key: "review", label: "Review" },
            { key: "done", label: "Done" },
          ].map((s, i, arr) => (
            <div key={s.key} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center font-medium
                ${getStepStatus(step, s.key) === "complete" ? "bg-green-500 text-white" : ""}
                ${getStepStatus(step, s.key) === "current" ? "bg-blue-600 text-white" : ""}
                ${getStepStatus(step, s.key) === "upcoming" ? "bg-gray-200 text-gray-500" : ""}
              `}>
                {getStepStatus(step, s.key) === "complete" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < arr.length - 1 && (
                <ChevronRight className="w-5 h-5 mx-2 text-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Generation Failed</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === "config" && (
        <AIQuizConfigForm onSubmit={handleConfigSubmit} />
      )}

      {step === "generating" && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Generating Questions
          </h3>
          <p className="text-gray-600">
            Claude AI is creating your quiz questions...
          </p>
        </div>
      )}

      {step === "audio" && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Creating Audio
          </h3>
          <p className="text-gray-600 mb-6">
            ElevenLabs is generating listening audio...
          </p>
          
          {/* Audio Progress */}
          <div className="max-w-xs mx-auto">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{
                  width: `${(audioProgress.current / audioProgress.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {audioProgress.current} of {audioProgress.total} audio files
            </p>
          </div>
        </div>
      )}

      {step === "review" && (
        <QuizReviewPanel
          questions={questions}
          config={config}
          onSave={handleSave}
          onBack={() => setStep("config")}
        />
      )}

      {step === "saving" && (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Saving your quiz...</p>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Quiz Created Successfully!
          </h3>
          <p className="text-gray-600 mb-6">
            Your AI-generated quiz is ready to use.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href={`/dashboard/quizzes/${savedQuizId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Quiz
            </a>
            <button
              onClick={() => {
                setStep("config");
                setQuestions([]);
                setConfig(null);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getStepStatus(currentStep: Step, checkStep: string): "complete" | "current" | "upcoming" {
  const order = ["config", "generating", "audio", "review", "done"];
  const currentIndex = order.indexOf(currentStep);
  const checkIndex = order.indexOf(checkStep);

  if (checkIndex < currentIndex) return "complete";
  if (checkIndex === currentIndex) return "current";
  return "upcoming";
}
```

---

# Part 7: Environment Setup

Add these to your `.env.local`:

```env
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# ElevenLabs Text-to-Speech
ELEVENLABS_API_KEY=...
```

---

# Part 8: Testing Checklist

Before marking this feature complete, test:

**Quiz Creation:**
- [ ] Manual creation still works
- [ ] AI creation form validates all fields
- [ ] Voice preview plays correctly
- [ ] Can select 1 or multiple question types

**Question Generation:**
- [ ] Claude returns valid JSON for all 12 question types
- [ ] Questions match the selected level (A1-C2)
- [ ] Word count for audio scripts is respected

**Audio Generation:**
- [ ] ElevenLabs generates audio successfully
- [ ] Audio URLs are saved with questions
- [ ] Different voices sound correct

**Review & Edit:**
- [ ] All generated questions display correctly
- [ ] Can edit question text and options
- [ ] Can edit audio script (regenerates audio)
- [ ] Can delete questions
- [ ] Can add manual questions

**Audio Player:**
- [ ] Play/pause works
- [ ] Progress bar updates
- [ ] Replay button works
- [ ] Replay count decrements correctly
- [ ] Disabled when no replays left
- [ ] Mute/unmute works

**Permissions:**
- [ ] Only admin and teacher can create quizzes
- [ ] Admin sees all quizzes
- [ ] Teacher sees only their quizzes

**Assignment:**
- [ ] Can assign to individual student
- [ ] Can assign to group
- [ ] Can assign to company

---

# Part 9: Git Commits

After each major piece:

```bash
git add . && git commit -m "feat(quiz): add creation mode selector UI"
git add . && git commit -m "feat(quiz): implement AI config form with voice selector"
git add . && git commit -m "feat(quiz): add all 12 question type interfaces"
git add . && git commit -m "feat(quiz): integrate Claude API for question generation"
git add . && git commit -m "feat(quiz): integrate ElevenLabs for audio generation"
git add . && git commit -m "feat(quiz): add modern audio player with replay limits"
git add . && git commit -m "feat(quiz): implement review and edit panel"
git add . && git commit -m "feat(quiz): add quiz save with permissions"
git add . && git commit -m "feat(quiz): implement quiz assignment (student/group/company)"
git add . && git commit -m "test(quiz): verify all question types render correctly"
```

---

# Summary

This document provides everything needed to implement:

1. ✅ AI quiz generation using Claude API
2. ✅ ElevenLabs audio for listening questions
3. ✅ Voice selection with preview
4. ✅ Word limit control for audio (20-150 words)
5. ✅ Replay limits (0-10, creator's choice)
6. ✅ All 12 question types
7. ✅ Review and edit before saving
8. ✅ Modern audio player
9. ✅ Role-based permissions (admin/teacher)
10. ✅ Assignment to student/group/company

The step-by-step flow ensures the programmer understands exactly what happens at each stage of the AI generation process.
