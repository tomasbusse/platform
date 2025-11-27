# Simmonds Enhanced Assessment System Plan

## Overview

Transform the current assessment system into a Cambridge-style multimedia evaluation platform with adaptive AI capabilities, supporting all four language skills: Reading, Writing, Listening, and Speaking.

---

## Phase 1: Schema & Infrastructure Updates

### 1.1 Update Question Bank Schema

**File:** `convex/schema.ts`

Add new fields to `questionBank` table:

```typescript
questionBank: defineTable({
  // ... existing fields ...

  // NEW: Media fields
  imageUrl: v.optional(v.string()),           // For visual questions
  imagePrompt: v.optional(v.string()),        // AI prompt used to generate image
  audioUrl: v.optional(v.string()),           // For listening questions (existing)
  audioScript: v.optional(v.string()),        // Text that was converted to audio
  videoUrl: v.optional(v.string()),           // For HeyGen dialogue videos
  videoScript: v.optional(v.string()),        // Dialogue script for video

  // NEW: Enhanced question types
  questionFormat: v.optional(v.union(
    v.literal("text_only"),
    v.literal("image_based"),
    v.literal("audio_based"),
    v.literal("video_based"),
    v.literal("mixed_media")
  )),

  // NEW: For writing/speaking questions
  rubric: v.optional(v.object({
    criteria: v.array(v.object({
      name: v.string(),
      weight: v.number(),
      levels: v.array(v.object({
        score: v.number(),
        description: v.string(),
      })),
    })),
    maxScore: v.number(),
  })),

  // NEW: Sample answers for AI grading reference
  sampleAnswers: v.optional(v.array(v.object({
    answer: v.string(),
    score: v.number(),
    feedback: v.string(),
  }))),
})
```

### 1.2 Update Test Sessions Schema

Add fields for storing user responses:

```typescript
testSessions: defineTable({
  // ... existing fields ...

  // NEW: Rich answer storage
  richAnswers: v.optional(v.array(v.object({
    questionId: v.string(),
    answerType: v.union(
      v.literal("multiple_choice"),
      v.literal("text"),
      v.literal("audio"),
      v.literal("file")
    ),
    selectedOption: v.optional(v.number()),
    textAnswer: v.optional(v.string()),
    audioUrl: v.optional(v.string()),        // Recorded audio for speaking
    audioDuration: v.optional(v.number()),
    aiScore: v.optional(v.number()),
    aiFeedback: v.optional(v.string()),
    timestamp: v.number(),
  }))),
})
```

---

## Phase 2: Image-Based Questions

### 2.1 Question Types with Images

| Question Type | Description | Example |
|--------------|-------------|---------|
| **Vocabulary Image** | Show image, identify word | Picture of "umbrella" → select correct word |
| **Picture Description** | Describe what you see | Image of park scene → write/select description |
| **Spot the Difference** | Compare two images | Find 5 differences between images |
| **Sequence Ordering** | Arrange images in order | Put story images in correct sequence |
| **Image Multiple Choice** | Image as answer options | "Which shows a celebration?" → 4 image options |

### 2.2 Implementation

**File:** `convex/mediaActions.ts` (already created)

Use the `generateImage` and `generateVocabularyImage` actions to create:

```typescript
// Example: Generate vocabulary image
const result = await generateVocabularyImage({
  apiKey: openaiKey,
  word: "umbrella",
  definition: "a device for protection against rain",
  context: "weather vocabulary for A1 learners",
  model: "gpt-image-1"
});
```

### 2.3 New Convex Action: Generate Image Question

**File:** `convex/assessmentActions.ts` (NEW)

```typescript
export const generateImageQuestion = action({
  args: {
    openaiKey: v.string(),
    word: v.string(),
    level: v.string(),
    skill: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Generate image with OpenAI
    // 2. Generate distractors with AI
    // 3. Return complete question object
  }
});
```

### 2.4 UI Component Updates

**File:** `src/pages/PublicAssessment.tsx`

Add image rendering in question display:

```tsx
{currentQuestion.imageUrl && (
  <div className="mb-6">
    <img
      src={currentQuestion.imageUrl}
      alt="Question image"
      className="max-w-md mx-auto rounded-xl shadow-lg"
    />
  </div>
)}
```

---

## Phase 3: Audio Listening Exercises

### 3.1 Listening Question Types

| Question Type | Description | Level |
|--------------|-------------|-------|
| **Word Recognition** | Listen to word, select spelling | A1-A2 |
| **Sentence Completion** | Fill in missing word from audio | A2-B1 |
| **Short Dialogue** | Listen to conversation, answer Qs | B1-B2 |
| **Monologue Comprehension** | Listen to speech, multiple Qs | B2-C1 |
| **Note Taking** | Listen and complete notes | C1-C2 |

### 3.2 Audio Generation Action

**File:** `convex/audioActions.ts` (NEW)

```typescript
"use node";

export const generateListeningQuestion = action({
  args: {
    elevenLabsKey: v.string(),
    script: v.string(),
    voiceId: v.string(),
    speed: v.optional(v.number()), // Slower for lower levels
    questionType: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Generate audio with ElevenLabs
    // 2. Upload to Convex storage
    // 3. Return audio URL and duration
  }
});

export const generateDialogueAudio = action({
  args: {
    elevenLabsKey: v.string(),
    dialogue: v.array(v.object({
      speaker: v.string(),
      voiceId: v.string(),
      text: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // Generate multi-voice dialogue
    // Combine audio clips
    // Return complete dialogue audio
  }
});
```

### 3.3 Audio Player Component

**File:** `src/components/assessment/AudioPlayer.tsx` (NEW)

```tsx
interface AudioPlayerProps {
  src: string;
  maxPlays?: number;  // Limit replays like real Cambridge
  onComplete?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, maxPlays = 2 }) => {
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Cambridge-style: Audio auto-plays once, can replay limited times
  // Show visual waveform/progress
  // Disable after max plays reached
};
```

### 3.4 Sample Listening Questions by Level

**A1-A2:**
```json
{
  "type": "listening",
  "level": "A1",
  "audioScript": "My name is Sarah. I am from London.",
  "question": "Where is Sarah from?",
  "options": ["Paris", "London", "New York", "Berlin"],
  "correctAnswer": "London"
}
```

**B1-B2:**
```json
{
  "type": "listening",
  "level": "B1",
  "audioScript": "Customer: Hi, I'd like to return this jacket. It doesn't fit.\nShop assistant: Do you have the receipt?\nCustomer: Yes, here it is. I bought it last Tuesday.\nShop assistant: No problem. Would you like an exchange or a refund?",
  "question": "What does the customer want to do?",
  "options": [
    "Buy a new jacket",
    "Return a jacket",
    "Get the jacket repaired",
    "Ask about sizes"
  ],
  "correctAnswer": "Return a jacket"
}
```

---

## Phase 4: HeyGen Video Dialogues

### 4.1 Video Question Types

| Question Type | Description | Use Case |
|--------------|-------------|----------|
| **Conversation Context** | Watch dialogue, answer comprehension Qs | B1+ listening/reading |
| **Role Play Prompt** | Watch scenario, student responds | Speaking practice |
| **Interview Simulation** | Avatar asks questions, student answers | Speaking assessment |
| **Cultural Context** | Avatar explains situation | Pragmatics/culture |

### 4.2 HeyGen Integration

**File:** `convex/mediaActions.ts` (already has basics)

Enhance with:

```typescript
export const createAssessmentDialogue = action({
  args: {
    heygenKey: v.string(),
    scenario: v.string(),
    level: v.string(),
    speakers: v.array(v.object({
      name: v.string(),
      avatarId: v.string(),
      lines: v.array(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // 1. Create HeyGen video with dialogue
    // 2. Poll until complete
    // 3. Store video URL
    // 4. Generate comprehension questions
  }
});
```

### 4.3 Video Player Component

**File:** `src/components/assessment/VideoPlayer.tsx` (NEW)

```tsx
interface VideoPlayerProps {
  src: string;
  maxPlays?: number;
  showSubtitles?: boolean;
  onComplete?: () => void;
}

// Cambridge-style video player with:
// - Play count limiting
// - Optional subtitles toggle
// - Full-screen capability
// - Progress indicator
```

### 4.4 Sample Video Scenarios

**B1 - At the Hotel:**
```
Avatar 1 (Receptionist): Good afternoon. Welcome to the Grand Hotel. How may I help you?
Avatar 2 (Guest): Hello. I have a reservation under the name Thompson.
Avatar 1: Let me check... Yes, Mr. Thompson. A double room for three nights?
Avatar 2: That's right. Is breakfast included?
Avatar 1: Yes, breakfast is served from 7 to 10 AM in the restaurant on the ground floor.

Questions:
1. What is the guest's name?
2. How long is the guest staying?
3. What time does breakfast start?
```

---

## Phase 5: AI-Generated Adaptive Questions

### 5.1 Adaptive Algorithm

```
┌─────────────────────────────────────────────────────────────┐
│                    ADAPTIVE FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  START: 3 questions at B1 level                             │
│                    │                                         │
│                    ▼                                         │
│  ┌─────────────────────────────────┐                        │
│  │ Calculate rolling accuracy      │                        │
│  │ (last 3 questions)              │                        │
│  └─────────────────────────────────┘                        │
│                    │                                         │
│        ┌──────────┼──────────┐                              │
│        ▼          ▼          ▼                              │
│   < 40%       40-70%      > 70%                             │
│   Go DOWN     STAY        Go UP                             │
│   one level   same level  one level                         │
│        │          │          │                              │
│        └──────────┼──────────┘                              │
│                   ▼                                         │
│  ┌─────────────────────────────────┐                        │
│  │ Generate next question with AI  │                        │
│  │ at calculated level             │                        │
│  └─────────────────────────────────┘                        │
│                   │                                         │
│                   ▼                                         │
│  After 15-25 questions: Calculate final level               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 AI Question Generation

**File:** `convex/aiAssessment.ts` (NEW)

```typescript
"use node";

export const generateAdaptiveQuestion = action({
  args: {
    openrouterKey: v.string(),
    targetLevel: v.string(),
    skill: v.string(),
    previousQuestions: v.array(v.string()), // Avoid repetition
    studentWeaknesses: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const prompt = `Generate a ${args.targetLevel} level ${args.skill} question...`;

    // Call OpenRouter API
    // Parse response into question format
    // Validate question quality
    // Return structured question
  }
});
```

### 5.3 Question Generation Prompts

**Grammar Question Prompt:**
```
Generate a Cambridge-style ${level} grammar question.

Requirements:
- Focus on: ${grammarTopic}
- Format: Multiple choice with 4 options
- One clearly correct answer
- Distractors should be plausible errors
- Include brief explanation

Level guidelines:
- A1: Basic verb forms, articles, pronouns
- A2: Past tense, comparatives, prepositions
- B1: Conditionals, present perfect, modals
- B2: Passive voice, reported speech, mixed conditionals
- C1: Inversion, cleft sentences, advanced modals
- C2: Subjunctive, nuanced grammar distinctions

Output JSON format:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "...",
  "explanation": "...",
  "grammarPoint": "..."
}
```

**Vocabulary Question Prompt:**
```
Generate a Cambridge-style ${level} vocabulary question.

Requirements:
- Test understanding of: ${vocabularyArea}
- Format: Multiple choice OR fill-in-the-blank
- Use authentic context
- Avoid obscure words at lower levels

Vocabulary areas by level:
- A1: Family, colors, numbers, daily routines
- A2: Travel, shopping, weather, hobbies
- B1: Work, health, education, environment
- B2: Business, media, society, abstract concepts
- C1: Academic, idiomatic expressions, collocations
- C2: Nuanced synonyms, rare idioms, technical terms

Output JSON format:
{
  "question": "...",
  "context": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "...",
  "explanation": "..."
}
```

---

## Phase 6: AI-Graded Writing Assessment

### 6.1 Writing Task Types

| Level | Task Type | Word Count | Time |
|-------|-----------|------------|------|
| A1-A2 | Form filling, short messages | 25-50 | 10 min |
| B1 | Email, informal letter | 100-120 | 20 min |
| B2 | Essay, formal letter, review | 140-190 | 40 min |
| C1 | Essay, proposal, report | 220-260 | 45 min |
| C2 | Essay with complex argument | 280-320 | 60 min |

### 6.2 Writing Component

**File:** `src/components/assessment/WritingTask.tsx` (NEW)

```tsx
interface WritingTaskProps {
  prompt: string;
  minWords: number;
  maxWords: number;
  timeLimit: number;
  rubric: Rubric;
  onSubmit: (text: string) => void;
}

const WritingTask: React.FC<WritingTaskProps> = (props) => {
  // Rich text editor
  // Word count (live)
  // Timer
  // Auto-save
  // Submit with confirmation
};
```

### 6.3 AI Grading Action

**File:** `convex/aiGrading.ts` (NEW)

```typescript
"use node";

export const gradeWriting = action({
  args: {
    openrouterKey: v.string(),
    studentResponse: v.string(),
    taskPrompt: v.string(),
    targetLevel: v.string(),
    rubric: v.object({
      criteria: v.array(v.object({
        name: v.string(),
        weight: v.number(),
        descriptors: v.any(),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const gradingPrompt = `
You are a Cambridge English examiner. Grade this ${args.targetLevel} writing task.

TASK: ${args.taskPrompt}

STUDENT RESPONSE:
${args.studentResponse}

RUBRIC CRITERIA:
${JSON.stringify(args.rubric.criteria, null, 2)}

Provide scores and detailed feedback for each criterion.
Use Cambridge marking standards.
Be encouraging but accurate.

Output JSON:
{
  "scores": {
    "content": { "score": 0-5, "feedback": "..." },
    "communicativeAchievement": { "score": 0-5, "feedback": "..." },
    "organisation": { "score": 0-5, "feedback": "..." },
    "language": { "score": 0-5, "feedback": "..." }
  },
  "totalScore": 0-20,
  "overallFeedback": "...",
  "strengths": ["..."],
  "improvements": ["..."],
  "correctedExamples": [
    { "original": "...", "corrected": "...", "explanation": "..." }
  ]
}
`;
    // Call OpenRouter
    // Parse and validate response
    // Return structured feedback
  }
});
```

### 6.4 Cambridge Writing Rubric

```typescript
const cambridgeWritingRubric = {
  criteria: [
    {
      name: "Content",
      weight: 25,
      levels: [
        { score: 5, description: "All content is relevant. Target reader fully informed." },
        { score: 4, description: "Minor irrelevance. Target reader mostly informed." },
        { score: 3, description: "Some irrelevance. Target reader reasonably informed." },
        { score: 2, description: "Significant irrelevance. Target reader minimally informed." },
        { score: 1, description: "Largely irrelevant. Target reader not informed." },
        { score: 0, description: "Content totally irrelevant or too short." },
      ]
    },
    {
      name: "Communicative Achievement",
      weight: 25,
      levels: [
        { score: 5, description: "Completely appropriate register and format. Holds reader's attention." },
        { score: 4, description: "Generally appropriate. Engages reader." },
        { score: 3, description: "Reasonably appropriate. Some engagement." },
        { score: 2, description: "Inconsistent register. Limited engagement." },
        { score: 1, description: "Inappropriate register. Little engagement." },
        { score: 0, description: "Completely inappropriate." },
      ]
    },
    {
      name: "Organisation",
      weight: 25,
      levels: [
        { score: 5, description: "Well organised with excellent cohesion throughout." },
        { score: 4, description: "Generally well organised with good cohesion." },
        { score: 3, description: "Reasonably organised with adequate cohesion." },
        { score: 2, description: "Some organisation but cohesion issues." },
        { score: 1, description: "Poorly organised with minimal cohesion." },
        { score: 0, description: "No organisation." },
      ]
    },
    {
      name: "Language",
      weight: 25,
      levels: [
        { score: 5, description: "Wide range of vocabulary and grammar. Minimal errors." },
        { score: 4, description: "Good range. Occasional errors that don't impede." },
        { score: 3, description: "Adequate range. Errors sometimes impede." },
        { score: 2, description: "Limited range. Errors often impede." },
        { score: 1, description: "Very limited range. Errors seriously impede." },
        { score: 0, description: "Insufficient language." },
      ]
    }
  ],
  maxScore: 20
};
```

---

## Phase 7: AI-Graded Speaking Assessment

### 7.1 Speaking Task Types

| Part | Task | Duration | Level |
|------|------|----------|-------|
| 1 | Interview (personal questions) | 2 min | All |
| 2 | Individual long turn (describe photo/topic) | 3-4 min | B1+ |
| 3 | Collaborative task (discussion with AI) | 3-4 min | B1+ |
| 4 | Discussion (extended conversation) | 4 min | B2+ |

### 7.2 Voice Recording Component

**File:** `src/components/assessment/SpeakingTask.tsx` (NEW)

```tsx
interface SpeakingTaskProps {
  prompt: string;
  imageUrl?: string;
  prepTime: number;
  speakTime: number;
  onRecordingComplete: (audioBlob: Blob) => void;
}

const SpeakingTask: React.FC<SpeakingTaskProps> = (props) => {
  // Preparation timer
  // Recording controls
  // Waveform visualization
  // Playback before submission
  // Upload to storage
};
```

### 7.3 Speech-to-Text + Grading

**File:** `convex/speechAssessment.ts` (NEW)

```typescript
"use node";

export const assessSpeaking = action({
  args: {
    openaiKey: v.string(),
    openrouterKey: v.string(),
    audioUrl: v.string(),
    taskPrompt: v.string(),
    targetLevel: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Transcribe audio with OpenAI Whisper
    const transcription = await transcribeAudio(args.audioUrl, args.openaiKey);

    // 2. Analyze fluency metrics
    const fluencyMetrics = analyzeFluency(transcription, args.audioDuration);

    // 3. Grade content with LLM
    const contentGrade = await gradeSpokenContent(
      transcription,
      args.taskPrompt,
      args.targetLevel,
      args.openrouterKey
    );

    // 4. Combine scores
    return {
      transcription,
      fluencyMetrics,
      contentGrade,
      overallScore,
      feedback,
    };
  }
});

async function analyzeFluency(transcription: string, duration: number) {
  // Words per minute
  // Hesitation markers ("um", "uh", pauses)
  // Sentence complexity
  // Vocabulary range
}
```

### 7.4 Speaking Rubric

```typescript
const cambridgeSpeakingRubric = {
  criteria: [
    {
      name: "Grammar and Vocabulary",
      weight: 25,
      levels: [
        { score: 5, description: "Wide range, accurate, appropriate" },
        { score: 3, description: "Adequate range, some errors" },
        { score: 1, description: "Limited range, frequent errors" },
      ]
    },
    {
      name: "Discourse Management",
      weight: 25,
      levels: [
        { score: 5, description: "Extended, coherent, cohesive" },
        { score: 3, description: "Contributions relevant, some hesitation" },
        { score: 1, description: "Limited, repetitive, hesitant" },
      ]
    },
    {
      name: "Pronunciation",
      weight: 25,
      levels: [
        { score: 5, description: "Clear, natural intonation" },
        { score: 3, description: "Generally clear, some L1 influence" },
        { score: 1, description: "Difficult to understand" },
      ]
    },
    {
      name: "Interactive Communication",
      weight: 25,
      levels: [
        { score: 5, description: "Initiates and responds appropriately" },
        { score: 3, description: "Maintains interaction with some support" },
        { score: 1, description: "Difficulty maintaining interaction" },
      ]
    }
  ],
  maxScore: 20
};
```

---

## Phase 8: Results & Reporting

### 8.1 Enhanced Results Display

**File:** `src/components/assessment/ResultsDashboard.tsx` (NEW)

```tsx
interface ResultsDashboardProps {
  sessionId: string;
  scores: {
    reading: number;
    writing: number;
    listening: number;
    speaking: number;
    useOfEnglish: number;
  };
  overallLevel: string;
  detailedFeedback: any;
}

// Features:
// - Radar chart of skills
// - Level comparison (current vs target)
// - Detailed feedback per skill
// - Recommended study areas
// - Certificate generation
// - Shareable results
```

### 8.2 PDF Certificate Generation

**File:** `convex/certificateActions.ts` (NEW)

```typescript
export const generateCertificate = action({
  args: {
    studentName: v.string(),
    level: v.string(),
    scores: v.object({...}),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate PDF certificate
    // Upload to storage
    // Return download URL
  }
});
```

### 8.3 Analytics Dashboard

Track:
- Average scores by level
- Common error patterns
- Time spent per question type
- Improvement over time
- Question difficulty calibration

---

## Implementation Timeline

### Sprint 1: Foundation (Week 1-2)
- [ ] Update schema with new fields
- [ ] Create base media actions
- [ ] Set up file storage for audio/video
- [ ] Basic image question support

### Sprint 2: Audio (Week 3-4)
- [ ] ElevenLabs audio generation
- [ ] Audio player component
- [ ] Listening question types
- [ ] Audio question bank

### Sprint 3: Video (Week 5-6)
- [ ] HeyGen integration polish
- [ ] Video player component
- [ ] Dialogue scenarios
- [ ] Video question bank

### Sprint 4: Writing (Week 7-8)
- [ ] Writing task component
- [ ] AI grading system
- [ ] Rubric implementation
- [ ] Feedback display

### Sprint 5: Speaking (Week 9-10)
- [ ] Voice recording component
- [ ] Whisper transcription
- [ ] Speaking assessment AI
- [ ] Speaking rubric

### Sprint 6: Adaptive & Polish (Week 11-12)
- [ ] Adaptive algorithm
- [ ] AI question generation
- [ ] Results dashboard
- [ ] Certificate generation
- [ ] Testing & refinement

---

## API Keys Required

| Service | Purpose | Settings Location |
|---------|---------|-------------------|
| OpenAI | Image generation, Whisper STT | Settings > API > OpenAI |
| ElevenLabs | TTS for listening | Settings > API > ElevenLabs |
| HeyGen | Video avatars | Settings > API > HeyGen |
| OpenRouter | AI grading & generation | Settings > API > OpenRouter |

---

## File Structure

```
convex/
├── schema.ts                 # Updated schema
├── assessmentActions.ts      # NEW: Assessment orchestration
├── aiAssessment.ts          # NEW: AI question generation
├── aiGrading.ts             # NEW: Writing/speaking grading
├── audioActions.ts          # NEW: Audio generation
├── speechAssessment.ts      # NEW: Speaking assessment
├── certificateActions.ts    # NEW: Certificate generation
├── mediaActions.ts          # EXISTING: Image/video generation
├── quizzes.ts               # EXISTING: Quiz management
└── assessmentInvitations.ts # EXISTING: Invitation system

src/
├── components/
│   └── assessment/
│       ├── AudioPlayer.tsx      # NEW
│       ├── VideoPlayer.tsx      # NEW
│       ├── WritingTask.tsx      # NEW
│       ├── SpeakingTask.tsx     # NEW
│       ├── ImageQuestion.tsx    # NEW
│       ├── ResultsDashboard.tsx # NEW
│       └── AdaptiveEngine.tsx   # NEW
├── pages/
│   ├── PublicAssessment.tsx     # ENHANCED
│   └── AssessmentResults.tsx    # NEW
└── hooks/
    ├── useAudioRecording.ts     # NEW
    └── useAdaptiveTest.ts       # NEW
```

---

## Success Metrics

1. **Accuracy**: AI grading within 1 point of human examiner 90% of time
2. **Completion Rate**: 85%+ of started assessments completed
3. **User Satisfaction**: 4.5+ rating on assessment experience
4. **Level Accuracy**: 90% correlation with official Cambridge results
5. **Processing Time**: Results within 30 seconds of submission

---

## Next Steps

1. Review and approve this plan
2. Prioritize which phases to implement first
3. Begin with Phase 1 (Schema updates)
4. Iterate based on testing feedback

---

*Document created: November 2024*
*For: Simmonds Language Services Platform*
