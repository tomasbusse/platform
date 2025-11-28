# AI-Powered Quiz Creation Module - Implementation Documentation

## Overview

This document tracks the implementation of the AI-Powered Quiz Creation Module for the Simmonds LMS platform. The module enables teachers and admins to create quizzes using Claude AI with ElevenLabs audio generation for listening exercises.

## Implementation Status

| Component | Status | File Location |
|-----------|--------|---------------|
| Documentation | ✅ Complete | `docs/AI-QUIZ-CREATION-IMPLEMENTATION.md` |
| Claude AI Question Generation | ✅ Complete | `convex/ai/generateQuizQuestions.ts` |
| ElevenLabs Audio Generation | ✅ Complete | `convex/ai/generateQuizAudio.ts` |
| AI Quiz Config Form | ✅ Complete | `src/components/quiz/AIQuizConfigForm.tsx` |
| Voice Selector | ✅ Complete | `src/components/quiz/VoiceSelector.tsx` |
| Audio Player | ✅ Complete | `src/components/quiz/AudioPlayer.tsx` |
| Question Type Selector | ✅ Complete | `src/components/quiz/QuestionTypeSelector.tsx` |
| Quiz Review Panel | ✅ Complete | `src/components/quiz/QuizReviewPanel.tsx` |
| Question Editor | ✅ Complete | `src/components/quiz/QuestionEditor.tsx` |
| AI Quiz Generator | ✅ Complete | `src/components/quiz/AIQuizGenerator.tsx` |
| QuizBuilder Integration | ✅ Complete | `src/components/QuizBuilder.tsx` |

## Architecture

### Flow Diagram

```
┌────────────────┐    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│   Config Form  │───▶│ Claude AI Gen  │───▶│  ElevenLabs    │───▶│  Review/Edit   │
│   (Settings)   │    │  (Questions)   │    │  (Audio Gen)   │    │   (Preview)    │
└────────────────┘    └────────────────┘    └────────────────┘    └────────────────┘
                                                                           │
                                                                           ▼
                                                                  ┌────────────────┐
                                                                  │   Save Quiz    │
                                                                  │  (Convex DB)   │
                                                                  └────────────────┘
```

### Question Types Supported

The 12 question types as specified:

1. **Multiple Choice** - 4 options, pick ONE correct
2. **Multiple Select** - 4+ options, pick ALL correct
3. **Fill in Blank** - Type the missing word
4. **Matching** - Drag items to match pairs
5. **Ordering** - Drag to arrange in sequence
6. **True/False** - Is statement true or false
7. **Short Answer** - Type a written response
8. **Listening** - Listen to audio, answer questions
9. **Speaking** - Record voice response
10. **Image-Based** - Look at picture, answer question
11. **Video-Based** - Watch video, answer questions
12. **Cloze** - Passage with multiple blanks

## API Integrations

### Claude AI (via Anthropic SDK)
- **Endpoint**: Direct Anthropic API
- **Model**: `claude-sonnet-4-20250514`
- **Purpose**: Generate quiz questions based on topic, level, and type
- **Configuration**: Uses `ANTHROPIC_API_KEY` from company settings

### ElevenLabs Text-to-Speech
- **Endpoint**: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- **Model**: `eleven_multilingual_v2`
- **Purpose**: Generate audio for listening exercises
- **Configuration**: Uses `ELEVENLABS_API_KEY` from company settings

### Available Voices

**English:**
| Voice ID | Name | Gender |
|----------|------|--------|
| EXAVITQu4vr4xnSDxMaL | Sarah | Female |
| 21m00Tcm4TlvDq8ikWAM | Emma | Female |
| pNInz6obpgDQGcFmaJgB | James | Male |
| ErXwobaYiN019PkySvjV | Daniel | Male |

**German:**
| Voice ID | Name | Gender |
|----------|------|--------|
| oWAxZDx7w5VEj9dCyTzz | Freya | Female |
| onwK4e9ZLuTAKqWW03F9 | Hans | Male |

## Role-Based Access

| Role | Can Create | Can View |
|------|------------|----------|
| Admin | ✅ All | All quizzes |
| Corporate Admin | ✅ Company | Company quizzes |
| Teacher | ✅ Own | Own quizzes |
| Student | ❌ No | Assigned only |

## Component Documentation

### 1. AIQuizGenerator (Main Component)

**Location**: `src/components/quiz/AIQuizGenerator.tsx`

**Props**:
```typescript
interface AIQuizGeneratorProps {
  currentUser: User | null;
  company: Company | null;
  onQuizCreated?: (quizId: string) => void;
  onCancel?: () => void;
}
```

**Features**:
- 5-step wizard flow: Config → Generate → Audio → Review → Save
- Progress indicator
- Error handling with retry
- State persistence between steps

### 2. AIQuizConfigForm

**Location**: `src/components/quiz/AIQuizConfigForm.tsx`

**Configuration Options**:
- Quiz title
- Language (English/German)
- Target CEFR level (A1-C2)
- Topic/Theme
- Number of questions (5-50)
- Question types (multi-select)
- Audio settings (word limit, voice, replays)
- Optional assignment

### 3. VoiceSelector

**Location**: `src/components/quiz/VoiceSelector.tsx`

**Features**:
- Voice preview with ElevenLabs
- Visual selection with radio buttons
- Language-aware voice filtering
- Preview caching

### 4. AudioPlayer

**Location**: `src/components/quiz/AudioPlayer.tsx`

**Features**:
- Play/pause controls
- Progress bar with seek
- Replay counter with limits (0-10)
- Mute toggle
- Visual feedback for replay status

### 5. QuestionEditor

**Location**: `src/components/quiz/QuestionEditor.tsx`

**Supported Types**:
- All 12 question types with specific editors
- Audio script editor with regeneration
- Image/video URL support
- Matching pairs editor
- Cloze passage editor

### 6. QuizReviewPanel

**Location**: `src/components/quiz/QuizReviewPanel.tsx`

**Features**:
- Question list with type indicators
- Inline audio playback
- Edit/delete/regenerate actions
- Add manual question
- Drag-to-reorder (future)

## Database Schema

### Quiz Table (Extended)

```typescript
// Additional fields for AI-generated quizzes
{
  // ... existing fields ...
  generatedWithAI: boolean,
  aiMetadata: {
    generatedAt: string,
    model: string,
    topic: string,
    questionTypes: string[],
  },
  audioSettings: {
    voiceId: string,
    voiceName: string,
    language: string,
    replaysAllowed: number,
  },
}
```

### Question Data Structure

```typescript
interface AIGeneratedQuestion {
  type: QuestionType;
  question?: string;
  statement?: string;
  instruction?: string;
  sentence?: string;
  prompt?: string;
  passage?: string;

  // For multiple choice/select
  options?: string[];
  correctAnswer?: number | number[] | boolean | string;

  // For matching
  pairs?: { left: string; right: string }[];

  // For ordering
  items?: string[];
  correctOrder?: string[];

  // For cloze
  blanks?: { id: number; correctAnswer: string; acceptableAnswers?: string[] }[];

  // For listening
  audioScript?: string;
  audioUrl?: string;
  audioStorageId?: string;
  audioWordCount?: number;
  questions?: SubQuestion[];

  // Common
  explanation?: string;
  sampleAnswer?: string;
  gradingCriteria?: string[];
  imageDescription?: string;
  imageKeywords?: string[];
  videoDescription?: string;
}
```

## Usage Instructions

### For Teachers/Admins

1. Navigate to Quiz Builder
2. Click "AI Generate Quiz" button
3. Fill in the configuration form:
   - Enter a descriptive title
   - Select language and CEFR level
   - Enter topic (e.g., "Business meetings", "Travel vocabulary")
   - Choose number of questions
   - Select question types to include
   - If listening selected, configure audio settings
4. Click "Generate with AI"
5. Wait for generation (shows progress)
6. Review generated questions
7. Edit any questions as needed
8. Save quiz when satisfied

### For Developers

**Adding a new question type**:

1. Add type to `QuestionType` union in schema
2. Add prompt template in `generateQuizQuestions.ts`
3. Add editor UI in `QuestionEditor.tsx`
4. Add renderer in quiz-taking component

**Adding a new voice**:

1. Add voice info to `AVAILABLE_VOICES` in `VoiceSelector.tsx`
2. Add to `generateQuizAudio.ts` voice list

## Testing Checklist

- [ ] Manual quiz creation still works
- [ ] AI config form validates all fields
- [ ] Voice preview plays correctly
- [ ] All 12 question types generate properly
- [ ] Audio generation completes successfully
- [ ] Questions can be edited after generation
- [ ] Audio script edits regenerate audio
- [ ] Quiz saves correctly to database
- [ ] Role permissions enforced
- [ ] Error handling displays appropriate messages

## Troubleshooting

### "API key not configured"
- Ensure company has `openRouterApiKey` or `ANTHROPIC_API_KEY` set in settings

### "Audio generation failed"
- Check `elevenLabsApiKey` is set in company settings
- Verify voice ID is valid
- Check script word count is within limit

### "Question parsing failed"
- AI response may be malformed
- Try regenerating with simpler topic
- Check console for raw response

## Changelog

### v2.0 (Current)
- Full AI quiz generation with Claude
- ElevenLabs audio integration
- 12 question types support
- Voice selection with preview
- Audio replay limits
- Review and edit workflow

### v1.0 (Previous)
- Basic OpenRouter AI generation
- Limited question types
- No audio generation
