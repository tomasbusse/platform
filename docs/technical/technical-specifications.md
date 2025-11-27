# Language School Management Platform - Technical Specifications

**Author:** Architect
**Date:** 2025-11-10
**Version:** 1.0
**Project:** Language School Management Platform
**Technology Stack:** Convex + React + TypeScript + AI Integration

---

## 1. Architecture Overview

### 1.1 System Architecture

The Language School Management Platform follows a modern, serverless-first architecture built on **Convex** as the primary backend infrastructure, with **React + TypeScript** for the frontend. The system is designed to be multi-tenant, scalable, and AI-powered.

**Core Technologies:**
- **Database & Backend:** Convex (real-time, serverless, TypeScript-first)
- **Frontend:** React 18+ with TypeScript and Vite
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** Zustand for client state, Convex queries for server state
- **Authentication:** Convex Auth (supports email/password, OAuth providers)
- **AI Integration:** OpenRouter (Claude), ElevenLabs (TTS), Cambridge API, Resend (Email)
- **Deployment:** Convex Cloud with Vercel/Netlify for frontend

**Architectural Principles:**
- **Real-time First:** All data operations use Convex's real-time capabilities
- **Type-Safe End-to-End:** Full TypeScript coverage from database to UI
- **Serverless by Design:** No server management, automatic scaling
- **Multi-tenant Architecture:** Company-based data isolation
- **API-First External Integrations:** REST APIs for all external services

### 1.2 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
│  React + TypeScript + Tailwind CSS + shadcn/ui             │
│                     (Vercel/Netlify)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Convex Backend                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Queries   │ │ Mutations   │ │   Actions   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Real-time   │ │ Database    │ │   Auth      │           │
│  │ Subscriptions│ │   Schema   │ │  System     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Scheduled  │ │ File        │ │ Business    │           │
│  │  Functions  │ │ Storage     │ │  Logic      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP APIs
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 External Services                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ OpenRouter  │ │ ElevenLabs  │ │ Cambridge   │           │
│  │   (AI)      │ │   (TTS)     │ │    API      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │   Resend    │ │    CDN      │                           │
│  │  (Email)    │ │ (Assets)    │                           │
│  └─────────────┘ └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## 2. Database Schema (Convex)

### 2.1 Core Schema Structure

The Convex database schema is designed to support multi-tenant architecture with proper data isolation and real-time capabilities.

```typescript
// convex/schema.ts
import { defineSchema, defineTable, defineField, defineIndex } from 'convex/schema';

// Define the main schema
export default defineSchema({
  // ===== USER MANAGEMENT =====
  users: defineTable({
    // User identification
    _id: defineField("string").isId(),
    email: defineField("string").isRequired(),
    name: defineField("string").isRequired(),
    
    // Profile information
    firstName: defineField("string"),
    lastName: defineField("string"),
    profileImage: defineField("string"), // URL to profile image
    
    // Role-based access control
    role: defineField("string").isRequired(), // 'super_admin', 'school_admin', 'corporate_admin', 'teacher', 'student'
    companyId: defineField("string").isRequired(), // Links to companies table
    isActive: defineField("boolean").isRequired().default(true),
    
    // Authentication
    emailVerified: defineField("boolean").default(false),
    lastLogin: defineField("number"), // Unix timestamp
    
    // Progress tracking (for students)
    currentLevel: defineField("string"), // 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    targetLevel: defineField("string"),
    totalScore: defineField("number").default(0),
    averageScore: defineField("number").default(0),
    completedTests: defineField("number").default(0),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_email", ["email"])
  .index("by_company", ["companyId"])
  .index("by_role", ["role"])
  .index("by_active", ["isActive"]),

  // ===== COMPANY MANAGEMENT =====
  companies: defineTable({
    _id: defineField("string").isId(),
    name: defineField("string").isRequired(),
    
    // Company details
    domain: defineField("string"), // Company domain
    description: defineField("string"),
    logo: defineField("string"), // URL to company logo
    
    // Contact information
    contactEmail: defineField("string").isRequired(),
    contactPhone: defineField("string"),
    address: defineField("string"),
    
    // Subscription information
    subscriptionPlan: defineField("string").isRequired().default("trial"), // 'trial', 'basic', 'premium', 'enterprise'
    subscriptionStatus: defineField("string").isRequired().default("active"), // 'active', 'inactive', 'cancelled'
    subscriptionStartDate: defineField("number"),
    subscriptionEndDate: defineField("number"),
    maxStudents: defineField("number").default(50),
    currentStudentCount: defineField("number").default(0),
    
    // Configuration
    settings: defineField("any"), // Flexible settings object
    customBranding: defineField("any"),
    
    // Billing
    billingEmail: defineField("string"),
    billingAddress: defineField("string"),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_domain", ["domain"])
  .index("by_subscription_plan", ["subscriptionPlan"]),

  // ===== GROUP MANAGEMENT =====
  groups: defineTable({
    _id: defineField("string").isId(),
    name: defineField("string").isRequired(),
    description: defineField("string"),
    companyId: defineField("string").isRequired(),
    
    // Group configuration
    level: defineField("string").isRequired(), // 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    teacherId: defineField("string").isRequired(),
    maxStudents: defineField("number").default(20),
    
    // Schedule
    meetingTimes: defineField("any"), // Array of meeting times
    timeZone: defineField("string").default("UTC"),
    
    // Status
    isActive: defineField("boolean").isRequired().default(true),
    startDate: defineField("number"),
    endDate: defineField("number"),
    
    // Progress tracking
    completedLessons: defineField("number").default(0),
    totalLessons: defineField("number").default(0),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_company", ["companyId"])
  .index("by_teacher", ["teacherId"])
  .index("by_level", ["level"])
  .index("by_active", ["isActive"]),

  // ===== TEST MANAGEMENT =====
  tests: defineTable({
    _id: defineField("string").isId(),
    name: defineField("string").isRequired(),
    description: defineField("string"),
    companyId: defineField("string").isRequired(),
    
    // Test configuration
    cambridgeTestId: defineField("string"), // Reference to Cambridge test
    testType: defineField("string").isRequired(), // 'placement', 'progress', 'final', 'custom'
    level: defineField("string").isRequired(), // 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    duration: defineField("number"), // Duration in minutes
    
    // Test content
    cambridgeQuestionIds: defineField("any"), // Array of Cambridge question IDs
    customQuestions: defineField("any"), // Custom questions for this test
    instructions: defineField("string"),
    
    // Scoring
    maxScore: defineField("number").isRequired(),
    passingScore: defineField("number").isRequired(),
    
    // Status
    isActive: defineField("boolean").isRequired().default(true),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_company", ["companyId"])
  .index("by_level", ["level"])
  .index("by_type", ["testType"])
  .index("by_active", ["isActive"]),

  // ===== TEST SESSIONS =====
  testSessions: defineTable({
    _id: defineField("string").isId(),
    testId: defineField("string").isRequired(),
    userId: defineField("string").isRequired(),
    companyId: defineField("string").isRequired(),
    
    // Session data
    cambridgeSessionId: defineField("string"), // Cambridge API session ID
    status: defineField("string").isRequired().default("pending"), // 'pending', 'in_progress', 'completed', 'expired'
    
    // Test results
    totalScore: defineField("number"),
    levelAwarded: defineField("string"),
    sectionScores: defineField("any"), // Reading, Writing, Listening, Speaking scores
    
    // Timing
    startedAt: defineField("number"),
    completedAt: defineField("number"),
    expiresAt: defineField("number"),
    
    // Content tracking
    questionsAnswered: defineField("number").default(0),
    totalQuestions: defineField("number").default(0),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_user", ["userId"])
  .index("by_test", ["testId"])
  .index("by_company", ["companyId"])
  .index("by_status", ["status"])
  .index("by_cambridge_session", ["cambridgeSessionId"]),

  // ===== LESSON MANAGEMENT =====
  lessons: defineTable({
    _id: defineField("string").isId(),
    title: defineField("string").isRequired(),
    description: defineField("string"),
    companyId: defineField("string").isRequired(),
    
    // Lesson content
    level: defineField("string").isRequired(), // 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    topic: defineField("string").isRequired(),
    type: defineField("string").isRequired(), // 'reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary'
    
    // Content
    content: defineField("string"), // Main lesson content
    exercises: defineField("any"), // Array of exercises
    audioFiles: defineField("any"), // Array of audio file URLs
    videoFiles: defineField("any"), // Array of video file URLs
    
    // AI-generated content
    aiGeneratedContent: defineField("any"), // OpenRouter generated content
    aiAudioContent: defineField("any"), // ElevenLabs generated audio
    
    // Metadata
    duration: defineField("number"), // Estimated duration in minutes
    difficulty: defineField("string"), // 'beginner', 'intermediate', 'advanced'
    
    // Status
    isPublished: defineField("boolean").default(false),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_company", ["companyId"])
  .index("by_level", ["level"])
  .index("by_type", ["type"])
  .index("by_published", ["isPublished"]),

  // ===== PROGRESS TRACKING =====
  progress: defineTable({
    _id: defineField("string").isId(),
    userId: defineField("string").isRequired(),
    companyId: defineField("string").isRequired(),
    
    // Progress data
    currentLevel: defineField("string").isRequired(),
    targetLevel: defineField("string"),
    
    // Skills tracking
    skillsProgress: defineField("any"), // Reading, Writing, Listening, Speaking progress
    overallScore: defineField("number").default(0),
    
    // Session tracking
    totalSessions: defineField("number").default(0),
    completedLessons: defineField("number").default(0),
    totalLessons: defineField("number").default(0),
    streakDays: defineField("number").default(0),
    
    // Recent activity
    lastActivity: defineField("number"),
    lastTestDate: defineField("number"),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_user", ["userId"])
  .index("by_company", ["companyId"])
  .index("by_level", ["currentLevel"])
  .index("by_activity", ["lastActivity"]),

  // ===== NOTIFICATIONS =====
  notifications: defineTable({
    _id: defineField("string").isId(),
    userId: defineField("string").isRequired(),
    companyId: defineField("string").isRequired(),
    
    // Notification content
    title: defineField("string").isRequired(),
    message: defineField("string").isRequired(),
    type: defineField("string").isRequired(), // 'info', 'success', 'warning', 'error', 'reminder'
    
    // Related data
    relatedEntityId: defineField("string"), // ID of related entity (test, lesson, etc.)
    relatedEntityType: defineField("string"), // Type of related entity
    
    // Status
    isRead: defineField("boolean").default(false),
    isEmailSent: defineField("boolean").default(false),
    
    // Action
    actionUrl: defineField("string"),
    actionText: defineField("string"),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    readAt: defineField("number"),
  })
  .index("by_user", ["userId"])
  .index("by_company", ["companyId"])
  .index("by_unread", ["isRead"])
  .index("by_type", ["type"]),

  // ===== ANALYTICS & REPORTING =====
  analytics: defineTable({
    _id: defineField("string").isId(),
    companyId: defineField("string").isRequired(),
    
    // Time period
    date: defineField("string").isRequired(), // YYYY-MM-DD format
    period: defineField("string").isRequired(), // 'daily', 'weekly', 'monthly', 'quarterly'
    
    // Metrics
    activeUsers: defineField("number").default(0),
    newRegistrations: defineField("number").default(0),
    completedTests: defineField("number").default(0),
    averageScore: defineField("number").default(0),
    totalStudyTime: defineField("number").default(0), // in minutes
    lessonCompletions: defineField("number").default(0),
    
    // Level distribution
    levelDistribution: defineField("any"), // { 'A1': 10, 'A2': 15, ... }
    
    // Additional metrics
    customMetrics: defineField("any"), // Flexible metrics object
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_company", ["companyId"])
  .index("by_date", ["date"])
  .index("by_period", ["period"]),

  // ===== SYSTEM CONFIGURATION =====
  systemConfig: defineTable({
    _id: defineField("string").isId(),
    key: defineField("string").isRequired().unique(),
    value: defineField("any").isRequired(),
    description: defineField("string"),
    
    // Configuration type
    type: defineField("string").isRequired(), // 'api_key', 'setting', 'feature_flag'
    category: defineField("string"), // 'email', 'ai', 'cambridge', 'elevenlabs'
    
    // Environment
    environment: defineField("string").default("production"), // 'development', 'staging', 'production'
    
    // Status
    isActive: defineField("boolean").default(true),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_key", ["key"])
  .index("by_category", ["category"])
  .index("by_active", ["isActive"]),

  // ===== EMAIL TEMPLATES =====
  emailTemplates: defineTable({
    _id: defineField("string").isId(),
    name: defineField("string").isRequired(),
    companyId: defineField("string"),
    
    // Template content
    subject: defineField("string").isRequired(),
    htmlContent: defineField("string").isRequired(),
    textContent: defineField("string"),
    
    // Template configuration
    type: defineField("string").isRequired(), // 'welcome', 'test_invitation', 'results', 'reminder', 'custom'
    variables: defineField("any"), // Array of variable names
    
    // Status
    isActive: defineField("boolean").default(true),
    isDefault: defineField("boolean").default(false),
    
    // Timestamps
    createdAt: defineField("number").isRequired(),
    updatedAt: defineField("number").isRequired(),
  })
  .index("by_type", ["type"])
  .index("by_company", ["companyId"])
  .index("by_active", ["isActive"]),

  // ===== AUDIT LOG =====
  auditLogs: defineTable({
    _id: defineField("string").isId(),
    companyId: defineField("string").isRequired(),
    userId: defineField("string"),
    
    // Action details
    action: defineField("string").isRequired(), // 'create', 'update', 'delete', 'login', 'test_start', 'test_complete'
    entityType: defineField("string"), // Type of entity affected
    entityId: defineField("string"), // ID of entity affected
    
    // Action data
    oldValues: defineField("any"),
    newValues: defineField("any"),
    metadata: defineField("any"), // Additional context data
    
    // Request details
    ipAddress: defineField("string"),
    userAgent: defineField("string"),
    
    // Timestamps
    timestamp: defineField("number").isRequired(),
  })
  .index("by_company", ["companyId"])
  .index("by_user", ["userId"])
  .index("by_action", ["action"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_timestamp", ["timestamp"]),
});
```

### 2.2 Real-time Subscriptions Strategy

```typescript
// Key real-time subscriptions for optimal performance
export const subscriptions = {
  // User-specific real-time data
  userNotifications: {
    table: "notifications",
    filter: (query) => query.eq("userId", userId),
    orderBy: { field: "createdAt", order: "desc" }
  },
  
  // Company-wide analytics (for admins)
  companyAnalytics: {
    table: "analytics", 
    filter: (query) => query.eq("companyId", companyId)
  },
  
  // Teacher group updates
  teacherGroups: {
    table: "groups",
    filter: (query) => query.eq("teacherId", teacherId)
  },
  
  // Student progress updates
  studentProgress: {
    table: "progress",
    filter: (query) => query.eq("userId", studentId)
  }
};
```

## 3. API Integration Architecture

### 3.1 External Service Integration Pattern

All external API integrations follow a consistent pattern with error handling, retry logic, and proper authentication.

```typescript
// services/api-client.ts
interface APIConfig {
  baseURL: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryable: boolean;
}

export class APIBase {
  protected config: APIConfig;
  protected retries = 0;

  constructor(config: APIConfig) {
    this.config = config;
  }

  protected async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.retries = 0; // Reset on success
      return { success: true, data };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (this.retries < this.config.retryAttempts) {
        this.retries++;
        await this.delay(Math.pow(2, this.retries) * 1000); // Exponential backoff
        return this.makeRequest<T>(endpoint, options);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error)
      };
    }
  }

  private isRetryableError(error: any): boolean {
    return error.name === 'AbortError' || 
           error.message?.includes('5') || 
           error.message?.includes('timeout');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3.2 Cambridge English API Integration

```typescript
// services/cambridge-api.ts
export class CambridgeAPI extends APIBase {
  private baseURL = process.env.CAMBRIDGE_API_URL!;
  private apiKey = process.env.CAMBRIDGE_API_KEY!;

  async createTestSession(params: {
    testId: string;
    candidateId: string;
    email: string;
  }): Promise<APIResponse<CambridgeSession>> {
    return this.makeRequest<CambridgeSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        test: params.testId,
        candidate: {
          id: params.candidateId,
          email: params.email
        }
      })
    });
  }

  async getTestResults(sessionId: string): Promise<APIResponse<CambridgeResults>> {
    return this.makeRequest<CambridgeResults>(`/sessions/${sessionId}/results`);
  }

  async getAvailableTests(): Promise<APIResponse<CambridgeTest[]>> {
    return this.makeRequest<CambridgeTest[]>('/tests');
  }

  async submitTestResponse(params: {
    sessionId: string;
    questionId: string;
    response: any;
  }): Promise<APIResponse<void>> {
    return this.makeRequest<void>(`/sessions/${params.sessionId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: params.questionId,
        response: params.response
      })
    });
  }
}

interface CambridgeSession {
  id: string;
  testId: string;
  status: 'pending' | 'in_progress' | 'completed';
  startTime?: string;
  endTime?: string;
  token: string; // JWT token for test access
}

interface CambridgeResults {
  sessionId: string;
  overallScore: number;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  sectionScores: {
    reading: number;
    writing: number;
    listening: number;
    speaking: number;
  };
  certificateUrl?: string;
}

interface CambridgeTest {
  id: string;
  name: string;
  level: string;
  duration: number;
  sections: CambridgeSection[];
}

interface CambridgeSection {
  id: string;
  name: string;
  questions: CambridgeQuestion[];
}

interface CambridgeQuestion {
  id: string;
  type: 'multiple_choice' | 'fill_blank' | 'essay';
  prompt: string;
  options?: string[];
  maxScore: number;
}
```

### 3.3 OpenRouter AI Integration

```typescript
// services/openrouter-api.ts
export class OpenRouterAPI extends APIBase {
  private baseURL = 'https://openrouter.ai/api/v1';
  private apiKey = process.env.OPENROUTER_API_KEY!;

  async generateContent(prompt: AIRequest): Promise<AIResponse> {
    const response = await this.makeRequest<AIResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "system",
            content: prompt.systemPrompt
          },
          {
            role: "user", 
            content: prompt.userPrompt
          }
        ],
        max_tokens: prompt.maxTokens || 2000,
        temperature: prompt.temperature || 0.7
      })
    });

    return response;
  }

  async generateQuiz(content: string, level: string): Promise<QuizGeneration> {
    const prompt = `
      Generate an English learning quiz at ${level} level.
      Content to base questions on: ${content}
      
      Include:
      - 5 multiple choice questions
      - 3 fill-in-the-blank questions  
      - 2 comprehension questions
      
      Return as JSON with questions, correct answers, and explanations.
    `;

    return this.generateContent({
      userPrompt: prompt,
      systemPrompt: "You are an expert English language teacher creating educational content."
    });
  }

  async generateFeedback(testResults: any): Promise<string> {
    const prompt = `
      Provide encouraging and constructive feedback for this English test result:
      ${JSON.stringify(testResults)}
      
      Focus on:
      - Areas of strength
      - Specific areas for improvement
      - Next steps for learning
      - Motivational messaging
    `;

    return this.generateContent({
      userPrompt: prompt,
      systemPrompt: "You are a supportive English language instructor providing personalized feedback."
    });
  }
}

interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
  usage: {
    total_tokens: number;
  };
}

interface QuizGeneration extends AIResponse {
  parsedContent?: QuizContent;
}

interface QuizContent {
  multipleChoice: MCQuestion[];
  fillInBlank: FillInBlankQuestion[];
  comprehension: ComprehensionQuestion[];
}

interface MCQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface FillInBlankQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  explanation: string;
}

interface ComprehensionQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  explanation: string;
}
```

### 3.4 ElevenLabs TTS Integration

```typescript
// services/elevenlabs-api.ts
export class ElevenLabsAPI extends APIBase {
  private baseURL = 'https://api.elevenlabs.io/v1';
  private apiKey = process.env.ELEVENLABS_API_KEY!;

  async generateSpeech(params: {
    text: string;
    voiceId: string;
    modelId?: string;
  }): Promise<Buffer> {
    const response = await fetch(`${this.baseURL}/text-to-speech/${params.voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: params.text,
        model_id: params.modelId || 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    const response = await this.makeRequest<{voices: ElevenLabsVoice[]}>('/voices');
    return response.data?.voices || [];
  }

  async generateAudioForLesson(lessonContent: string, voiceId: string): Promise<string[]> {
    const textChunks = this.chunkText(lessonContent, 1000); // 1000 char chunks
    const audioPromises = textChunks.map(chunk => 
      this.generateSpeech({ text: chunk, voiceId })
    );

    const audioBuffers = await Promise.all(audioPromises);
    
    // Upload each audio buffer to storage and return URLs
    const audioUrls = await Promise.all(
      audioBuffers.map((buffer, index) => this.uploadAudio(buffer, `lesson-audio-${index}.mp3`))
    );

    return audioUrls;
  }

  private chunkText(text: string, maxLength: number): string[] {
    const sentences = text.split(/[.!?]+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += sentence + '.';
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence + '.';
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  private async uploadAudio(buffer: Buffer, filename: string): Promise<string> {
    // Upload to your storage service (S3, Convex file storage, etc.)
    // Return public URL
    throw new Error('Upload implementation needed');
  }
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  gender: 'male' | 'female';
  accent?: string;
  age?: string;
  description?: string;
  use_cases: string[];
}
```

### 3.5 Resend Email Integration

```typescript
// services/resend-api.ts
export class ResendAPI {
  private apiKey = process.env.RESEND_API_KEY!;
  private baseURL = 'https://api.resend.com';

  async sendEmail(params: {
    to: string | string[];
    from: string;
    subject: string;
    html?: string;
    text?: string;
    templateId?: string;
    templateData?: Record<string, any>;
  }): Promise<ResendResponse> {
    const response = await fetch(`${this.baseURL}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        template_id: params.templateId,
        template_data: params.templateData
      })
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.statusText}`);
    }

    return response.json();
  }

  async sendTestInvitation(params: {
    to: string;
    studentName: string;
    testName: string;
    testDate: string;
    testDuration: string;
    companyName: string;
  }): Promise<ResendResponse> {
    return this.sendEmail({
      to: params.to,
      from: 'noreply@languagelearning.com',
      subject: `English Test Invitation - ${params.companyName}`,
      templateId: 'test-invitation',
      templateData: {
        studentName: params.studentName,
        testName: params.testName,
        testDate: params.testDate,
        testDuration: params.testDuration,
        companyName: params.companyName
      }
    });
  }

  async sendTestResults(params: {
    to: string;
    studentName: string;
    testName: string;
    score: number;
    level: string;
    companyName: string;
  }): Promise<ResendResponse> {
    return this.sendEmail({
      to: params.to,
      from: 'results@languagelearning.com',
      subject: `Your English Test Results - ${params.companyName}`,
      templateId: 'test-results',
      templateData: {
        studentName: params.studentName,
        testName: params.testName,
        score: params.score,
        level: params.level,
        companyName: params.companyName
      }
    });
  }

  async sendProgressUpdate(params: {
    to: string;
    studentName: string;
    currentLevel: string;
    progress: number;
    companyName: string;
  }): Promise<ResendResponse> {
    return this.sendEmail({
      to: params.to,
      from: 'progress@languagelearning.com',
      subject: `Progress Update - ${params.studentName}`,
      templateId: 'progress-update',
      templateData: {
        studentName: params.studentName,
        currentLevel: params.currentLevel,
        progress: params.progress,
        companyName: params.companyName
      }
    });
  }
}

interface ResendResponse {
  id: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained';
}
```

## 4. React Component Architecture

### 4.1 Component Structure and Patterns

The React application follows a modular, type-safe architecture with consistent patterns for data fetching, state management, and UI composition.

```typescript
// src/types/index.ts
export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'school_admin' | 'corporate_admin' | 'teacher' | 'student';
  companyId: string;
  isActive: boolean;
  currentLevel?: string;
  profileImage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Company {
  _id: string;
  name: string;
  contactEmail: string;
  subscriptionPlan: 'trial' | 'basic' | 'premium' | 'enterprise';
  subscriptionStatus: 'active' | 'inactive' | 'cancelled';
  maxStudents: number;
  currentStudentCount: number;
  logo?: string;
  settings: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface Test {
  _id: string;
  name: string;
  description?: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  testType: 'placement' | 'progress' | 'final' | 'custom';
  maxScore: number;
  passingScore: number;
  duration?: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TestSession {
  _id: string;
  testId: string;
  userId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  totalScore?: number;
  levelAwarded?: string;
  startedAt?: number;
  completedAt?: number;
  expiresAt?: number;
}

// src/hooks/useConvexQuery.ts
import { useQuery, useMutation, useAction, useFunction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export function useCurrentUser() {
  return useQuery(api.users.getCurrentUser);
}

export function useUser(userId: Id<"users">) {
  return useQuery(api.users.getUser, { userId });
}

export function useCompany(companyId: Id<"companies">) {
  return useQuery(api.companies.getCompany, { companyId });
}

export function useTestsByCompany(companyId: Id<"companies">) {
  return useQuery(api.tests.getTestsByCompany, { companyId });
}

export function useTestSessionsByUser(userId: Id<"users">) {
  return useQuery(api.testSessions.getTestSessionsByUser, { userId });
}

export function useCreateTest() {
  return useMutation(api.tests.createTest);
}

export function useUpdateTest() {
  return useMutation(api.tests.updateTest);
}

// src/hooks/useAuth.ts
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function useAuth() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const isAuthenticated = !!currentUser;

  const signIn = useMutation(api.auth.signIn);
  const signOut = useMutation(api.auth.signOut);
  const signUp = useMutation(api.auth.signUp);

  return {
    currentUser,
    isAuthenticated,
    signIn,
    signOut,
    signUp,
  };
}
```

### 4.2 Component Library Structure

```typescript
// src/components/ui/Button.tsx
import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
```

### 4.3 Page Components Architecture

```typescript
// src/pages/Dashboard.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, BookOpen, TrendingUp, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Role-based dashboard components
  const getDashboardContent = () => {
    if (!currentUser) return <div>Loading...</div>;

    switch (currentUser.role) {
      case 'corporate_admin':
        return <CorporateAdminDashboard companyId={currentUser.companyId} />;
      case 'teacher':
        return <TeacherDashboard teacherId={currentUser._id} />;
      case 'student':
        return <StudentDashboard studentId={currentUser._id} />;
      default:
        return <div>Unauthorized role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Language Learning Platform
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Welcome, {currentUser?.name}
              </span>
              <Button variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {getDashboardContent()}
      </main>
    </div>
  );
}

function CorporateAdminDashboard({ companyId }: { companyId: string }) {
  const { company, analytics, recentTests } = useDashboardData(companyId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your company's language training.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{company?.currentStudentCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {company?.maxStudents || 0} max students
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentTests?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              tests in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.averageScore || 0}</div>
            <p className="text-xs text-muted-foreground">
              across all assessments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Level Distribution</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.levelDistribution ? Object.keys(analytics.levelDistribution).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              different CEFR levels
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Test Results</CardTitle>
            <CardDescription>
              Latest completed assessments from your students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TestResultsList tests={recentTests || []} />
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline">
              Invite New Students
            </Button>
            <Button className="w-full justify-start" variant="outline">
              Create New Test
            </Button>
            <Button className="w-full justify-start" variant="outline">
              View Analytics
            </Button>
            <Button className="w-full justify-start" variant="outline">
              Manage Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// src/components/TestResultsList.tsx
function TestResultsList({ tests }: { tests: any[] }) {
  if (tests.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">No test results yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tests.map((test) => (
        <div key={test._id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="font-medium">{test.studentName}</p>
            <p className="text-sm text-muted-foreground">{test.testName}</p>
          </div>
          <div className="text-right">
            <p className="font-medium">{test.score}/{test.maxScore}</p>
            <p className="text-sm text-muted-foreground">{test.level}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4.4 State Management with Zustand

```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  profileImage?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

// src/store/appStore.ts
import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  currentPage: string;
  notifications: Notification[];
  setSidebarOpen: (open: boolean) => void;
  setCurrentPage: (page: string) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  currentPage: 'dashboard',
  notifications: [],
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentPage: (page) => set({ currentPage: page }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, notification],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
```

## 5. Security Implementation

### 5.1 Authentication & Authorization

```typescript
// src/lib/auth.ts
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Authentication hooks and utilities
export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new ConvexError("Invalid email or password");
    }

    // Verify password (implement proper password hashing)
    // const isValidPassword = await verifyPassword(args.password, user.passwordHash);
    // if (!isValidPassword) {
    //   throw new ConvexError("Invalid email or password");
    // }

    // Update last login
    await ctx.db.patch(user._id, {
      lastLogin: Date.now(),
    });

    return {
      user,
      token: generateJWTToken(user._id, user.companyId, user.role),
    };
  },
});

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("corporate_admin"),
      v.literal("teacher"),
      v.literal("student")
    ),
    companyId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new ConvexError("User already exists");
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      role: args.role,
      companyId: args.companyId,
      isActive: true,
      emailVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const user = await ctx.db.get(userId);
    return { user };
  },
});

// Role-based access control
export const requireRole = (user: any, requiredRoles: string[]) => {
  if (!user) {
    throw new ConvexError("Authentication required");
  }

  if (!requiredRoles.includes(user.role)) {
    throw new ConvexError("Insufficient permissions");
  }

  return user;
};

export const requireCompanyAccess = (user: any, companyId: string) => {
  if (!user) {
    throw new ConvexError("Authentication required");
  }

  if (user.companyId !== companyId && user.role !== 'super_admin') {
    throw new ConvexError("Access denied to company resources");
  }

  return user;
};

// Data isolation helper
export const getFilteredQuery = (ctx: any, tableName: string, user: any) => {
  let query = ctx.db.query(tableName);
  
  // Apply company-based data filtering for multi-tenant architecture
  if (user.role !== 'super_admin') {
    query = query.filter((doc: any) => doc.companyId === user.companyId);
  }
  
  return query;
};
```

### 5.2 Data Validation and Sanitization

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// User validation schemas
export const userSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  role: z.enum(['super_admin', 'school_admin', 'corporate_admin', 'teacher', 'student']),
  companyId: z.string().min(1, "Company ID is required"),
  currentLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  targetLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
});

export const testSchema = z.object({
  name: z.string().min(1, "Test name is required").max(200, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  testType: z.enum(['placement', 'progress', 'final', 'custom']),
  maxScore: z.number().min(1).max(1000),
  passingScore: z.number().min(0).max(1000),
  duration: z.number().min(1).max(300).optional(), // 1-300 minutes
});

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .trim()
    .substring(0, 1000); // Limit length
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

// API request validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (data: any) => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConvexError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  };
};
```

### 5.3 Rate Limiting and Security Headers

```typescript
// src/lib/security.ts
import { mutation } from "./_generated/server";

// Rate limiting implementation (store in memory or Redis for production)
const rateLimits = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (identifier: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  const userLimit = rateLimits.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userLimit.count >= limit) {
    return false;
  }

  userLimit.count++;
  return true;
};

export const apiRateLimit = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUser();
    const identifier = user?._id || ctx.request.ip;
    
    if (!checkRateLimit(identifier, 100, 60000)) { // 100 requests per minute
      throw new ConvexError("Rate limit exceeded");
    }
    
    return { success: true };
  },
});

// Security headers for web requests
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Input validation for file uploads
export const validateFileUpload = (file: File): boolean => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  return allowedTypes.includes(file.type) && file.size <= maxSize;
};
```

## 6. Performance Optimization

### 6.1 Database Query Optimization

```typescript
// src/convex/queries.ts
import { query } from "./_generated/server";

// Optimized queries with proper indexing and filtering
export const getTestsByCompany = query({
  args: {
    companyId: v.string(),
    page: v.number().default(0),
    limit: v.number().default(20),
    level: v.union(v.literal('A1'), v.literal('A2'), v.literal('B1'), v.literal('B2'), v.literal('C1'), v.literal('C2')).optional(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("tests")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc");

    if (args.level) {
      q = q.filter((doc) => doc.level === args.level);
    }

    // Pagination
    const results = await q
      .skip(args.page * args.limit)
      .take(args.limit)
      .collect();

    return results;
  },
});

// Aggregated queries for analytics
export const getCompanyAnalytics = query({
  args: {
    companyId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    // Use efficient aggregation queries
    const testSessions = await ctx.db
      .query("testSessions")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((doc) => 
        doc.createdAt >= args.startDate && 
        doc.createdAt <= args.endDate &&
        doc.status === "completed"
      )
      .collect();

    // Calculate metrics efficiently
    const totalTests = testSessions.length;
    const averageScore = totalTests > 0 
      ? testSessions.reduce((sum, session) => sum + (session.totalScore || 0), 0) / totalTests
      : 0;

    const levelDistribution = testSessions.reduce((acc, session) => {
      if (session.levelAwarded) {
        acc[session.levelAwarded] = (acc[session.levelAwarded] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTests,
      averageScore,
      levelDistribution,
      testSessions: testSessions.slice(0, 10), // Latest 10 for display
    };
  },
});
```

### 6.2 Caching Strategy

```typescript
// src/lib/cache.ts
import { useQuery, useMutation } from "convex/react";
import { useState, useEffect } from "react";

// Simple in-memory cache for client-side data
class ClientCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttlMs: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const cache = new ClientCache();

// React hook for cached queries
export function useCachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await queryFn();
        setData(result);
        cache.set(key, result, ttlMs);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [key]);

  return { data, loading, error, refetch: () => cache.set(key, null, 0) };
}

// Database-level caching for frequently accessed data
export const getCachedUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Implement Redis or database-level caching for user data
    const cacheKey = `user:${args.userId}`;
    const cached = await ctx.db.get(cacheKey); // Implement cache layer
    
    if (cached) {
      return cached;
    }

    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.put(cacheKey, user, { ttl: 300 }); // 5 minute TTL
    }
    
    return user;
  },
});
```

### 6.3 Code Splitting and Lazy Loading

```typescript
// src/App.tsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load route components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const TestTaking = lazy(() => import('@/pages/TestTaking'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const Settings = lazy(() => import('@/pages/Settings'));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/test/:testId" element={<TestTaking />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
```

## 7. Deployment Strategy

### 7.1 Environment Configuration

```typescript
// .env.production
# Convex Configuration
CONVEX_DEPLOYMENT=prod-xxx
CONVEX_ORIGIN=https://your-convex-url.convex.cloud

# External API Keys
OPENROUTER_API_KEY=sk-or-v1-...
CAMBRIDGE_API_KEY=cambridge_...
ELEVENLABS_API_KEY=...
RESEND_API_KEY=re_...

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-encryption-key

# Email Configuration
FROM_EMAIL=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com

# Analytics
GOOGLE_ANALYTICS_ID=G-...
```

### 7.2 Deployment Scripts

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:analyze": "tsc && vite build --mode analyze",
    "deploy": "convex deploy",
    "deploy:production": "convex deploy --environment production",
    "deploy:staging": "convex deploy --environment staging",
    "test": "convex test",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  }
}
```

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Build application
      run: npm run build
    
    - name: Deploy to Convex
      env:
        CONVEX_DEPLOYMENT: ${{ secrets.CONVEX_DEPLOYMENT }}
      run: |
        npx convex deploy --token ${{ secrets.CONVEX_DEPLOY_TOKEN }}
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID}}
        vercel-project-id: ${{ secrets.PROJECT_ID}}
        vercel-args: '--prod'
```

### 7.3 Monitoring and Observability

```typescript
// src/lib/monitoring.ts
import { ConvexHttpError } from "convex/values";

// Error tracking and monitoring
export class Monitoring {
  static trackError(error: Error, context?: Record<string, any>) {
    // Send to error tracking service (Sentry, LogRocket, etc.)
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  static trackPerformance(metric: string, value: number, context?: Record<string, any>) {
    // Track performance metrics
    console.log('Performance Metric:', {
      metric,
      value,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  static trackUserAction(action: string, userId?: string, context?: Record<string, any>) {
    // Track user actions for analytics
    console.log('User Action:', {
      action,
      userId,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}

// Error boundary component
export class ErrorBoundary extends React.Component {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Monitoring.trackError(error, { errorInfo, componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
              <p className="mt-2 text-sm text-gray-500">
                We're sorry for the inconvenience. Please refresh the page or try again later.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Summary

This technical specification document provides a comprehensive foundation for implementing the Language School Management Platform. The architecture is designed to be:

- **Scalable**: Multi-tenant with proper data isolation
- **Real-time**: Built on Convex's real-time capabilities  
- **Type-safe**: End-to-end TypeScript coverage
- **Secure**: Role-based access with proper authentication
- **Performant**: Optimized queries and caching strategies
- **Modern**: Latest React patterns and component architecture

The specification covers all aspects needed for successful implementation, from database design to deployment strategies, providing clear guidance for the development team to build a production-ready platform.