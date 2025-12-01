import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface VirtualLessonBuilderProps {
  currentUser: User | null;
  company: Company | null;
  scheduledLessonId?: string;
  onLessonCreated?: (lessonId: string) => void;
}

interface VocabularyItem {
  word: string;
  definition: string;
  example: string;
  pronunciation?: string;
  partOfSpeech?: string;
}

interface GrammarPoint {
  title: string;
  explanation: string;
  examples: string[];
  exercises?: {
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
  }[];
}

interface LessonSection {
  id: string;
  type: 'introduction' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'exercise' | 'summary';
  title: string;
  content: string;
  visualContent?: string;
  order: number;
}

interface GeneratedLesson {
  title: string;
  description: string;
  objectives: string[];
  sections: LessonSection[];
  vocabulary: VocabularyItem[];
  grammarPoints: GrammarPoint[];
  testQuestions: {
    id: string;
    type: 'multiple_choice' | 'fill_in_blank' | 'true_false' | 'listening';
    questionText: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    skill: 'vocabulary' | 'grammar' | 'comprehension' | 'listening';
    points: number;
    audioText?: string; // Text to generate audio for listening questions
    audioUrl?: string;
  }[];
}

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  description?: string;
}

// ElevenLabs Voice options - English and German voices
const ENGLISH_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'American', language: 'english' as const },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', accent: 'American', language: 'english' as const },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', accent: 'American', language: 'english' as const },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', accent: 'American', language: 'english' as const },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', accent: 'American', language: 'english' as const },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'American', language: 'english' as const },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', accent: 'American', language: 'english' as const },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', accent: 'British', language: 'english' as const },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', accent: 'British', language: 'english' as const },
];

const GERMAN_VOICES = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', accent: 'German', language: 'german' as const },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', accent: 'German', language: 'german' as const },
  { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', accent: 'German', language: 'german' as const },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', accent: 'German', language: 'german' as const },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', accent: 'German', language: 'german' as const },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', accent: 'German', language: 'german' as const },
];

// Combined voices for backward compatibility
const VOICES = [...ENGLISH_VOICES, ...GERMAN_VOICES];

const VirtualLessonBuilder: React.FC<VirtualLessonBuilderProps> = ({
  currentUser,
  company,
  scheduledLessonId,
  onLessonCreated,
}) => {
  const [activeStep, setActiveStep] = useState(1);
  const [transcript, setTranscript] = useState('');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('A1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedLesson, setGeneratedLesson] = useState<GeneratedLesson | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(ENGLISH_VOICES[0].id);
  const [generatedAudios, setGeneratedAudios] = useState<Record<string, string>>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Language selection for lesson and voices
  const [lessonLanguage, setLessonLanguage] = useState<'english' | 'german'>('english');

  // Explanation language (for explaining English content in German)
  const [explanationLanguage, setExplanationLanguage] = useState<'english' | 'german'>('english');

  // Editing state for lesson content
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingVocab, setEditingVocab] = useState<string | null>(null);

  // Additional prompt for customization
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Model selection state
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Voice preview state
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Multi-model selection for different tasks
  const [contentModel, setContentModel] = useState<string>('openrouter');
  const [designModel, setDesignModel] = useState<string>('gemini-2.0-flash');
  const [imageModel, setImageModel] = useState<string>('none');
  const [audioScriptModel, setAudioScriptModel] = useState<string>('gemini-2.0-flash');

  // Auto-generate audio setting
  const [autoGenerateAudio, setAutoGenerateAudio] = useState(true);

  // Get available voices based on selected language
  const availableVoices = lessonLanguage === 'german' ? GERMAN_VOICES : ENGLISH_VOICES;

  // Get custom voices from company settings
  const customVoices = (company as any)?.voiceConfig?.customVoices?.filter(
    (v: any) => v.language === lessonLanguage
  ) || [];

  // Combine default and custom voices
  const allVoices = [...availableVoices, ...customVoices];

  // Get scheduled lesson if provided
  const scheduledLesson = useQuery(
    api.lessons.getScheduledLesson,
    scheduledLessonId ? { lessonId: scheduledLessonId as Id<"scheduledLessons"> } : 'skip'
  );

  // Get lesson materials for the scheduled lesson
  const lessonMaterials = useQuery(
    api.lessons.getLessonMaterials,
    scheduledLessonId ? { scheduledLessonId: scheduledLessonId as Id<"scheduledLessons"> } : 'skip'
  );

  // Get company settings for API configuration
  const companySettings = useQuery(
    api.settings.getCompanySettings,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  const createVirtualLesson = useMutation(api.lessons.createVirtualLesson);
  const createLessonTest = useMutation(api.lessons.createLessonTest);

  // Fetch OpenRouter models on mount
  useEffect(() => {
    const fetchOpenRouterModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (response.ok) {
          const data = await response.json();
          const sortedModels = (data.data || []).sort((a: OpenRouterModel, b: OpenRouterModel) =>
            a.name.localeCompare(b.name)
          );
          setOpenRouterModels(sortedModels);
        }
      } catch (error) {
        console.error('Error fetching OpenRouter models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    fetchOpenRouterModels();
  }, []);

  // Set default model from settings when loaded
  useEffect(() => {
    if (companySettings?.apis?.openrouter?.model && !selectedModel) {
      setSelectedModel(companySettings.apis.openrouter.model);
    }
  }, [companySettings, selectedModel]);

  // Pre-fill from scheduled lesson
  useEffect(() => {
    if (scheduledLesson) {
      setTopic(scheduledLesson.topic);
      setLevel(scheduledLesson.level);
      if (scheduledLesson.transcript) {
        setTranscript(scheduledLesson.transcript);
      }
    }
  }, [scheduledLesson]);

  // Update voice selection when language changes
  useEffect(() => {
    // Check for company default voice first
    const voiceConfig = (company as any)?.voiceConfig;
    const defaultVoice = lessonLanguage === 'german'
      ? voiceConfig?.defaultGermanVoice
      : voiceConfig?.defaultEnglishVoice;

    if (defaultVoice) {
      setSelectedVoice(defaultVoice);
    } else {
      // Fall back to first voice in list
      const voices = lessonLanguage === 'german' ? GERMAN_VOICES : ENGLISH_VOICES;
      setSelectedVoice(voices[0].id);
    }
  }, [lessonLanguage, company]);

  // Set default language from company settings
  useEffect(() => {
    const defaultLang = (company as any)?.aiPromptTemplates?.defaultLanguage;
    if (defaultLang && (defaultLang === 'english' || defaultLang === 'german')) {
      setLessonLanguage(defaultLang);
    }
  }, [company]);

  // Helper function to get API key from multiple sources (localStorage fallback for unsaved settings)
  const getApiKeyFromSources = (
    flatKey: string,
    nestedPath: string[]
  ): string | null => {
    // 1. Try company.settings (flat format from database)
    const flatSettings = company?.settings as any;
    if (flatSettings?.[flatKey]) {
      return flatSettings[flatKey];
    }

    // 2. Try companySettings from getCompanySettings query (nested format)
    let nestedValue: any = companySettings;
    for (const key of nestedPath) {
      nestedValue = nestedValue?.[key];
      if (!nestedValue) break;
    }
    if (nestedValue) {
      return nestedValue;
    }

    // 3. Fallback to localStorage (for cases where settings haven't been saved to DB yet)
    try {
      const localSettings = localStorage.getItem('simmonds_settings');
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        let localValue: any = parsed;
        for (const key of nestedPath) {
          localValue = localValue?.[key];
          if (!localValue) break;
        }
        if (localValue) {
          return localValue;
        }
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage:', e);
    }

    return null;
  };

  const getOpenRouterApiKey = (): string | null => {
    return getApiKeyFromSources('openRouterApiKey', ['apis', 'openrouter', 'apiKey']);
  };

  const getGeminiApiKey = (): string | null => {
    return getApiKeyFromSources('geminiApiKey', ['apis', 'gemini', 'apiKey']);
  };

  const getOpenAIApiKey = (): string | null => {
    return getApiKeyFromSources('openaiApiKey', ['apis', 'openai', 'apiKey']);
  };

  const getElevenLabsApiKey = (): string | null => {
    return getApiKeyFromSources('elevenLabsApiKey', ['apis', 'elevenlabs', 'apiKey']);
  };

  const generateWithAI = async (prompt: string): Promise<string> => {
    // Use OpenRouter API with selected model
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please add it in Settings and click Save.');
    }

    // Use selected model, fallback to settings model, then to default
    const model = selectedModel || companySettings?.apis?.openrouter?.model || 'anthropic/claude-sonnet-4';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Simmonds Language Platform',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  };

  // Generate with Gemini API
  const generateWithGemini = async (prompt: string, modelOverride?: string): Promise<string> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add it in Settings and click Save.');
    }

    const model = modelOverride || companySettings?.apis?.gemini?.model || 'gemini-2.0-flash';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  // Generate image with Gemini Imagen
  const generateImageWithGemini = async (prompt: string, modelOverride?: string): Promise<string | null> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    const imageModelId = modelOverride || companySettings?.apis?.gemini?.imageModel || 'imagen-3.0-generate-002';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${imageModelId}:generateImages?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            number_of_images: 1,
            aspect_ratio: '16:9',
          }),
        }
      );

      if (!response.ok) {
        console.warn('Gemini image generation failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      const imageData = data.generated_images?.[0]?.image?.image_bytes;
      if (imageData) {
        return `data:image/png;base64,${imageData}`;
      }
      return null;
    } catch (error) {
      console.warn('Image generation error:', error);
      return null;
    }
  };

  // Generate image with OpenAI
  const generateImageWithOpenAI = async (prompt: string): Promise<string | null> => {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) return null;

    const imageModelId = companySettings?.apis?.openai?.imageModel || 'dall-e-3';

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageModelId,
          prompt: prompt,
          n: 1,
          size: '1792x1024',
          response_format: 'b64_json',
        }),
      });

      if (!response.ok) {
        console.warn('OpenAI image generation failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      const imageData = data.data?.[0]?.b64_json;
      if (imageData) {
        return `data:image/png;base64,${imageData}`;
      }
      return null;
    } catch (error) {
      console.warn('Image generation error:', error);
      return null;
    }
  };

  // Unified generate function that uses the selected model
  const generateContent = async (prompt: string, taskType: 'content' | 'design' | 'audio' = 'content'): Promise<string> => {
    let modelToUse: string;

    switch (taskType) {
      case 'design':
        modelToUse = designModel;
        break;
      case 'audio':
        modelToUse = audioScriptModel;
        break;
      default:
        modelToUse = contentModel === 'openrouter' ? 'openrouter' : contentModel;
    }

    // If using OpenRouter (for content model)
    if (modelToUse === 'openrouter' || (contentModel === 'openrouter' && taskType === 'content')) {
      return generateWithAI(prompt);
    }

    // Otherwise use Gemini with the specific model
    return generateWithGemini(prompt, modelToUse);
  };

  // Generate image based on selected image model
  const generateImage = async (prompt: string): Promise<string | null> => {
    if (imageModel === 'none') return null;

    // Check if it's an OpenAI model
    if (imageModel.startsWith('dall-e')) {
      return generateImageWithOpenAI(prompt);
    }

    // Otherwise use Gemini/Imagen
    return generateImageWithGemini(prompt, imageModel);
  };

  const generateLesson = async () => {
    if (!topic.trim()) {
      setErrors({ topic: 'Topic is required' });
      return;
    }

    setIsGenerating(true);
    setErrors({});

    try {
      // Step 1: Generate lesson structure
      setGenerationProgress('Analyzing content and creating lesson structure...');

      // Get company AI prompt templates
      const aiTemplates = (company as any)?.aiPromptTemplates;
      const systemPrompt = aiTemplates?.systemPrompt || '';
      const presentationFormat = aiTemplates?.presentationFormat || '';
      const homeworkFormat = aiTemplates?.homeworkFormat || '';

      // Build the language context
      const languageContext = lessonLanguage === 'german'
        ? 'You are creating a German language lesson.'
        : 'You are creating an English language lesson.';

      // Add explanation language context
      const explanationContext = explanationLanguage === 'german' && lessonLanguage === 'english'
        ? '\n\nIMPORTANT: Explain all English content in GERMAN. Definitions, instructions, and explanations should be in German to help German speakers learn English.'
        : '';

      const structurePrompt = `${systemPrompt ? systemPrompt + '\n\n' : ''}${languageContext} Level: ${level}.${explanationContext}

${transcript ? `Based on this transcript:\n${transcript}\n\n` : ''}Topic: ${topic}
${additionalPrompt ? `\nExtra instructions: ${additionalPrompt}\n` : ''}
${presentationFormat ? `\n${presentationFormat}\n` : ''}

Create a CONCISE slide-based lesson. Each section = 1 slide that fits on screen without scrolling.

JSON structure (respond ONLY with valid JSON):
{
  "title": "Short engaging title",
  "description": "One sentence description",
  "objectives": ["objective1", "objective2", "objective3"],
  "sections": [
    {
      "id": "welcome",
      "type": "introduction",
      "title": "Welcome",
      "content": "<h2>Title</h2><ul><li>Objective 1</li><li>Objective 2</li></ul><p>[IMAGE: welcoming image related to ${topic}]</p>",
      "order": 1
    },
    {
      "id": "vocab",
      "type": "vocabulary",
      "title": "Key Words",
      "content": "<div class='vocab-grid'><div class='vocab-card'><strong>word</strong> - definition<br/><em>example</em></div></div><p>[IMAGE: vocabulary illustration]</p>",
      "order": 2
    },
    {
      "id": "grammar",
      "type": "grammar",
      "title": "Grammar",
      "content": "<h3>Rule</h3><p>Simple explanation</p><table><tr><th>Pattern</th></tr><tr><td>Example</td></tr></table>",
      "order": 3
    },
    {
      "id": "practice",
      "type": "exercise",
      "title": "Practice",
      "content": "<h3>Try it!</h3><ol><li>Exercise 1</li><li>Exercise 2</li></ol><p>[IMAGE: practice context]</p>",
      "order": 4
    },
    {
      "id": "summary",
      "type": "summary",
      "title": "Summary",
      "content": "<h3>Key Points</h3><ul><li>Point 1</li><li>Point 2</li><li>Point 3</li></ul><p>[IMAGE: success/celebration]</p>",
      "order": 5
    }
  ],
  "vocabulary": [
    {
      "word": "example",
      "definition": "${explanationLanguage === 'german' ? 'German definition' : 'English definition'}",
      "example": "Example sentence",
      "pronunciation": "/pronunciation/",
      "partOfSpeech": "noun"
    }
  ],
  "grammarPoints": [
    {
      "title": "Grammar Rule",
      "explanation": "${explanationLanguage === 'german' ? 'German explanation' : 'English explanation'}",
      "examples": ["Example 1", "Example 2"],
      "exercises": [
        {
          "question": "Fill in: She ___ yesterday.",
          "options": ["go", "went"],
          "correctAnswer": "went",
          "explanation": "Past tense explanation"
        }
      ]
    }
  ],
  "testQuestions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "questionText": "Vocabulary question about a word from the lesson",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "explanation": "Why this is correct",
      "skill": "vocabulary",
      "points": 10
    },
    {
      "id": "q2",
      "type": "fill_in_blank",
      "questionText": "Complete the sentence: She ___ to school yesterday.",
      "correctAnswer": "went",
      "explanation": "Past tense of go",
      "skill": "grammar",
      "points": 10
    },
    {
      "id": "q3",
      "type": "true_false",
      "questionText": "Statement to evaluate as true or false",
      "options": ["True", "False"],
      "correctAnswer": "True",
      "explanation": "Why this is true/false",
      "skill": "comprehension",
      "points": 10
    },
    {
      "id": "q4",
      "type": "listening",
      "questionText": "Listen and answer: What does the speaker say?",
      "audioText": "Short sentence to be read aloud for the listening question",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "What was said in the audio",
      "skill": "listening",
      "points": 15
    }
  ]
}

STRICT REQUIREMENTS:
- 4-5 sections ONLY (like PowerPoint slides)
- 5-6 vocabulary items MAX
- 1-2 grammar points
- 5-6 test questions with VARIETY:
  * 1-2 multiple_choice (vocabulary)
  * 1-2 fill_in_blank (grammar)
  * 1 true_false (comprehension)
  * 1 listening (with audioText for TTS generation)
- BRIEF content per section (fits one screen)
- Include [IMAGE: description] placeholders
- ${explanationLanguage === 'german' ? 'All explanations in GERMAN' : 'All explanations in English'}
- Level: ${level} CEFR`;

      // Use content model for structure generation
      const structureResponse = await generateContent(structurePrompt, 'content');

      // Parse JSON from response
      let lessonData: GeneratedLesson;
      try {
        // Try to extract JSON from the response
        const jsonMatch = structureResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        lessonData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse lesson JSON:', structureResponse);
        throw new Error('Failed to parse generated lesson. Please try again.');
      }

      // Step 2: Generate visually stunning content for each section (using design model)
      setGenerationProgress('Creating visual slide content...');

      for (let i = 0; i < lessonData.sections.length; i++) {
        const section = lessonData.sections[i];
        setGenerationProgress(`Designing slide ${i + 1}/${lessonData.sections.length}: ${section.title}...`);

        const visualPrompt = `Create a SINGLE SLIDE HTML for a "${section.type}" slide. Must fit on ONE SCREEN without scrolling.

Content: ${section.content}

STRICT RULES:
- Maximum 200 words
- Use inline styles with colors: #003F37 (teal), #9F9D38 (lime), #B25627 (terracotta), #E3C6AB (cream)
- Large fonts: headings 28px+, body 18px+
- Generous spacing and padding
- Replace [IMAGE: description] with: <div style="background: linear-gradient(135deg, #E3C6AB 0%, #9F9D38 100%); height: 150px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #003F37; font-size: 14px;">📷 description</div>
- Use cards with shadows for vocabulary items
- Use clean tables with colored headers for grammar
- Add relevant emojis as visual cues
- NO scrolling - everything visible at once

Return ONLY the HTML, no explanation.`;

        try {
          const visualContent = await generateContent(visualPrompt, 'design');
          lessonData.sections[i].visualContent = visualContent;
        } catch (e) {
          console.warn(`Failed to generate visual content for section ${i}:`, e);
        }
      }

      // Step 3: Generate images for vocabulary if image model is enabled
      if (imageModel !== 'none') {
        setGenerationProgress('Generating vocabulary images...');
        for (let i = 0; i < Math.min(lessonData.vocabulary.length, 6); i++) {
          const vocab = lessonData.vocabulary[i];
          setGenerationProgress(`Generating image for: ${vocab.word}...`);

          const imagePrompt = `Educational illustration for language learning: "${vocab.word}" - ${vocab.definition}. Clean, simple, colorful illustration suitable for vocabulary learning. No text in image.`;

          try {
            const imageUrl = await generateImage(imagePrompt);
            if (imageUrl) {
              // Store image URL in vocabulary item (we'll need to extend the type)
              (lessonData.vocabulary[i] as any).imageUrl = imageUrl;
            }
          } catch (e) {
            console.warn(`Failed to generate image for ${vocab.word}:`, e);
          }
        }
      }

      // Step 4: Generate audio for listening questions if API key exists
      const elevenLabsKey = getElevenLabsApiKey();
      if (elevenLabsKey) {
        const listeningQuestions = lessonData.testQuestions.filter(q => q.type === 'listening' && q.audioText);
        if (listeningQuestions.length > 0) {
          setGenerationProgress('Generating audio for listening questions...');
          for (const question of listeningQuestions) {
            try {
              setGenerationProgress(`Generating audio: ${question.audioText?.substring(0, 30)}...`);
              const cleanText = question.audioText!.replace(/<[^>]*>/g, '').trim();

              const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
                {
                  method: 'POST',
                  headers: {
                    Accept: 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': elevenLabsKey,
                  },
                  body: JSON.stringify({
                    text: cleanText,
                    model_id: lessonLanguage === 'german' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
                    voice_settings: {
                      stability: 0.5,
                      similarity_boost: 0.75,
                    },
                  }),
                }
              );

              if (response.ok) {
                const audioBlob = await response.blob();
                question.audioUrl = URL.createObjectURL(audioBlob);
              }
            } catch (e) {
              console.warn('Failed to generate audio for listening question:', e);
            }
          }
        }
      }

      setGeneratedLesson(lessonData);
      setActiveStep(2);
      setGenerationProgress('');
    } catch (error) {
      console.error('Generation error:', error);
      setErrors({ generate: error instanceof Error ? error.message : 'Failed to generate lesson' });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAudioForText = async (text: string, id: string) => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured. Please add it in Settings and click Save.');
    }

    // Clean text for audio
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    setGeneratedAudios((prev) => ({ ...prev, [id]: audioUrl }));
    return audioUrl;
  };

  // Preview voice function
  const previewVoice = async (voiceId: string) => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      setErrors({ voice: 'ElevenLabs API key not configured. Add it in Settings and click Save.' });
      return;
    }

    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    setIsPreviewingVoice(true);
    setErrors({});

    try {
      // Find the voice name for the preview text
      const voice = [...ENGLISH_VOICES, ...GERMAN_VOICES, ...customVoices].find(v => v.id === voiceId);
      const voiceName = voice?.name || 'this voice';
      const isGerman = GERMAN_VOICES.some(v => v.id === voiceId) || customVoices.some((v: any) => v.id === voiceId && v.language === 'german');

      // Sample text based on language
      const sampleText = isGerman
        ? `Hallo, ich bin ${voiceName}. So werde ich in Ihren Lektionen klingen.`
        : `Hello, I'm ${voiceName}. This is how I'll sound in your lessons.`;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: sampleText,
            model_id: isGerman ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPreviewingVoice(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPreviewingVoice(false);
        setErrors({ voice: 'Failed to play audio preview' });
      };

      setPreviewAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('Voice preview error:', error);
      setErrors({ voice: error instanceof Error ? error.message : 'Failed to preview voice' });
      setIsPreviewingVoice(false);
    }
  };

  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setIsPreviewingVoice(false);
    }
  };

  const generateAllAudio = async () => {
    if (!generatedLesson) return;

    setIsGeneratingAudio(true);

    try {
      // Generate audio for vocabulary
      for (const vocab of generatedLesson.vocabulary) {
        setGenerationProgress(`Generating audio for: ${vocab.word}...`);
        const audioText = `${vocab.word}. ${vocab.definition}. For example: ${vocab.example}`;
        await generateAudioForText(audioText, `vocab-${vocab.word}`);
      }

      // Generate audio for introduction
      const intro = generatedLesson.sections.find((s) => s.type === 'introduction');
      if (intro) {
        setGenerationProgress('Generating introduction audio...');
        await generateAudioForText(intro.content, `section-${intro.id}`);
      }

      setGenerationProgress('');
    } catch (error) {
      console.error('Audio generation error:', error);
      setErrors({ audio: error instanceof Error ? error.message : 'Failed to generate audio' });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const saveLesson = async () => {
    if (!generatedLesson || !currentUser || !company) return;

    setIsGenerating(true);
    setGenerationProgress('Saving lesson...');

    try {
      // Auto-generate audio if enabled and API key exists
      const elevenLabsApiKey = getElevenLabsApiKey();
      if (autoGenerateAudio && elevenLabsApiKey && Object.keys(generatedAudios).length === 0) {
        setGenerationProgress('Generating audio for vocabulary...');

        // Generate audio for vocabulary (limit to 5 for speed)
        for (let i = 0; i < Math.min(generatedLesson.vocabulary.length, 5); i++) {
          const vocab = generatedLesson.vocabulary[i];
          setGenerationProgress(`Audio ${i + 1}/${Math.min(generatedLesson.vocabulary.length, 5)}: ${vocab.word}...`);
          const audioText = `${vocab.word}. ${vocab.definition}. For example: ${vocab.example}`;
          try {
            await generateAudioForText(audioText, `vocab-${vocab.word}`);
          } catch (e) {
            console.warn(`Skipping audio for ${vocab.word}:`, e);
          }
        }

        // Generate audio for introduction section
        const intro = generatedLesson.sections.find((s) => s.type === 'introduction');
        if (intro) {
          setGenerationProgress('Generating intro audio...');
          try {
            await generateAudioForText(intro.content, `section-${intro.id}`);
          } catch (e) {
            console.warn('Skipping intro audio:', e);
          }
        }
      }

      setGenerationProgress('Saving lesson...');

      // Create virtual lesson
      const lessonId = await createVirtualLesson({
        companyId: company._id as Id<"companies">,
        createdBy: currentUser._id as Id<"users">,
        scheduledLessonId: scheduledLessonId as Id<"scheduledLessons"> | undefined,
        title: generatedLesson.title,
        description: generatedLesson.description,
        level,
        topic,
        language: lessonLanguage,
        explanationLanguage,
        sections: generatedLesson.sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          content: s.visualContent || s.content,
          order: s.order,
        })),
        vocabulary: generatedLesson.vocabulary.map((v) => ({
          word: v.word,
          definition: v.definition,
          example: v.example,
          pronunciation: v.pronunciation,
          partOfSpeech: v.partOfSpeech,
        })),
        grammarPoints: generatedLesson.grammarPoints.map((g) => ({
          title: g.title,
          explanation: g.explanation,
          examples: g.examples,
          exercises: g.exercises,
        })),
        estimatedDuration: 15, // Shorter lessons now
        objectives: generatedLesson.objectives,
        tags: [topic, level],
        generatedWithModel: selectedModel || companySettings?.apis?.openrouter?.model || 'anthropic/claude-sonnet-4',
        sourceTranscript: transcript || undefined,
      });

      // Create test
      if (generatedLesson.testQuestions.length > 0) {
        setGenerationProgress('Creating lesson test...');
        await createLessonTest({
          companyId: company._id as Id<"companies">,
          virtualLessonId: lessonId,
          createdBy: currentUser._id as Id<"users">,
          title: `${generatedLesson.title} - Assessment`,
          description: 'End of lesson assessment',
          questions: generatedLesson.testQuestions.map((q) => ({
            id: q.id,
            type: q.type as any,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            points: q.points,
            skill: q.skill as any,
          })),
          passingScore: 70,
          shuffleQuestions: true,
          showCorrectAnswers: true,
          allowRetake: true,
          maxAttempts: 3,
        });
      }

      setActiveStep(3);
      onLessonCreated?.(lessonId);
    } catch (error) {
      console.error('Save error:', error);
      setErrors({ save: error instanceof Error ? error.message : 'Failed to save lesson' });
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  if (!currentUser) {
    return <div className="text-simmonds-stone">Please log in to create lessons.</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
      {/* Progress Steps */}
      <div className="bg-simmonds-cream/30 p-4 border-b border-simmonds-cream">
        <div className="flex items-center justify-center gap-4">
          {[
            { step: 1, label: 'Input' },
            { step: 2, label: 'Review & Enhance' },
            { step: 3, label: 'Complete' },
          ].map(({ step, label }) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  activeStep >= step
                    ? 'bg-simmonds-primary text-white'
                    : 'bg-simmonds-cream text-simmonds-stone'
                }`}
              >
                {activeStep > step ? '✓' : step}
              </div>
              <span
                className={`text-sm ${
                  activeStep >= step ? 'text-simmonds-charcoal' : 'text-simmonds-stone'
                }`}
              >
                {label}
              </span>
              {step < 3 && <div className="w-12 h-0.5 bg-simmonds-cream" />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Step 1: Input */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-simmonds-charcoal mb-2">
                Create Practice Session with AI
              </h2>
              <p className="text-simmonds-stone">
                Reinforce your learning with an interactive practice session featuring vocabulary, grammar, exercises, and assessment.
              </p>
            </div>

            {/* Scheduled Lesson Context Banner */}
            {scheduledLesson && (
              <div className="bg-gradient-to-r from-simmonds-primary/10 to-simmonds-olive/10 border border-simmonds-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-simmonds-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-lg">📅</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-simmonds-charcoal mb-1">
                      Creating from: {scheduledLesson.title}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-sm text-simmonds-stone">
                      <span className="flex items-center gap-1">
                        <span className="text-simmonds-primary">📆</span>
                        {new Date(scheduledLesson.scheduledDate).toLocaleDateString()}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary rounded text-xs font-medium">
                        {scheduledLesson.level}
                      </span>
                      {scheduledLesson.objectives && scheduledLesson.objectives.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-simmonds-olive">🎯</span>
                          {scheduledLesson.objectives.length} objectives
                        </span>
                      )}
                    </div>
                    {/* Materials from scheduled lesson */}
                    {lessonMaterials && lessonMaterials.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-simmonds-primary/10">
                        <p className="text-xs font-medium text-simmonds-charcoal mb-2">
                          📎 Attached Materials ({lessonMaterials.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {lessonMaterials.map((material) => (
                            <a
                              key={material._id}
                              href={material.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-simmonds-primary hover:bg-simmonds-primary/10 transition-colors"
                            >
                              <span>
                                {material.fileType?.startsWith('image/') ? '🖼️' :
                                 material.fileType?.includes('pdf') ? '📄' :
                                 material.fileType?.startsWith('video/') ? '🎬' :
                                 material.fileType?.startsWith('audio/') ? '🎵' : '📎'}
                              </span>
                              <span className="truncate max-w-[120px]">{material.fileName}</span>
                            </a>
                          ))}
                        </div>
                        <p className="text-xs text-simmonds-stone mt-2 italic">
                          Tip: Reference these materials in the transcript or additional instructions below.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {errors.generate && (
              <div className="p-4 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl">
                {errors.generate}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                  Topic / Theme *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                    errors.topic ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
                  }`}
                  placeholder="e.g., Present Perfect Tense, Business Vocabulary"
                />
                {errors.topic && (
                  <p className="text-sm text-simmonds-terracotta mt-1">{errors.topic}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                  Student Level
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="A1">A1 - Beginner</option>
                  <option value="A2">A2 - Elementary</option>
                  <option value="B1">B1 - Intermediate</option>
                  <option value="B2">B2 - Upper Intermediate</option>
                  <option value="C1">C1 - Advanced</option>
                  <option value="C2">C2 - Proficient</option>
                </select>
              </div>
            </div>

            {/* Language and Voice Selection */}
            <div className="bg-gradient-to-r from-blue-50 to-amber-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-medium text-simmonds-charcoal mb-3 flex items-center gap-2">
                <span>🎙️</span>
                Language & Voice Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                    Lesson Language
                  </label>
                  <select
                    value={lessonLanguage}
                    onChange={(e) => setLessonLanguage(e.target.value as 'english' | 'german')}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary bg-white"
                  >
                    <option value="english">🇬🇧 English</option>
                    <option value="german">🇩🇪 German (Deutsch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                    Explanations In
                  </label>
                  <select
                    value={explanationLanguage}
                    onChange={(e) => setExplanationLanguage(e.target.value as 'english' | 'german')}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary bg-white"
                  >
                    <option value="english">🇬🇧 English</option>
                    <option value="german">🇩🇪 German (Deutsch)</option>
                  </select>
                  <p className="text-xs text-simmonds-stone mt-1">
                    {lessonLanguage === 'english' && explanationLanguage === 'german'
                      ? 'English words explained in German'
                      : 'Same language explanations'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                    Audio Voice
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary bg-white"
                    >
                      <optgroup label={lessonLanguage === 'german' ? '🇩🇪 German Voices' : '🇬🇧 English Voices'}>
                        {availableVoices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} ({voice.accent})
                          </option>
                        ))}
                      </optgroup>
                      {customVoices.length > 0 && (
                        <optgroup label="⭐ Custom Voices">
                          {customVoices.map((voice: any) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name} (Custom)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => isPreviewingVoice ? stopPreview() : previewVoice(selectedVoice)}
                      disabled={isPreviewingVoice && !previewAudio}
                      className={`px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1 ${
                        isPreviewingVoice
                          ? 'bg-simmonds-terracotta text-white hover:bg-simmonds-terracotta/90'
                          : 'bg-simmonds-olive/10 text-simmonds-olive hover:bg-simmonds-olive/20'
                      }`}
                      title={isPreviewingVoice ? 'Stop preview' : 'Preview voice'}
                    >
                      {isPreviewingVoice ? '■' : '🔊'}
                    </button>
                  </div>
                  {errors.voice && (
                    <p className="text-xs text-simmonds-terracotta mt-1">{errors.voice}</p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Model Selection - 4 Models */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-4">
              <h3 className="font-medium text-simmonds-charcoal mb-4 flex items-center gap-2">
                <span>🤖</span>
                AI Model Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Lesson Content Model */}
                <div className="bg-white rounded-lg p-3 border border-simmonds-cream">
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-simmonds-primary text-white rounded-full flex items-center justify-center text-xs">1</span>
                    Lesson Content
                  </label>
                  <select
                    value={contentModel}
                    onChange={(e) => setContentModel(e.target.value)}
                    className="w-full px-3 py-2 border border-simmonds-cream rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <optgroup label="OpenRouter (Use selected model below)">
                      <option value="openrouter">OpenRouter ({selectedModel?.split('/').pop() || 'Select below'})</option>
                    </optgroup>
                    <optgroup label="Gemini 3 (Latest)">
                      <option value="gemini-3-pro-preview">Gemini 3 Pro (Most Advanced)</option>
                    </optgroup>
                    <optgroup label="Gemini 2.0">
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                      <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Experimental)</option>
                    </optgroup>
                    <optgroup label="Gemini 1.5">
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-simmonds-stone mt-1">Creates lesson structure, vocabulary & grammar</p>
                </div>

                {/* 2. Design/Visual Model */}
                <div className="bg-white rounded-lg p-3 border border-simmonds-cream">
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-simmonds-olive text-white rounded-full flex items-center justify-center text-xs">2</span>
                    Visual Design
                  </label>
                  <select
                    value={designModel}
                    onChange={(e) => setDesignModel(e.target.value)}
                    className="w-full px-3 py-2 border border-simmonds-cream rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <optgroup label="Gemini 3 (Latest)">
                      <option value="gemini-3-pro-preview">Gemini 3 Pro (Most Advanced)</option>
                    </optgroup>
                    <optgroup label="Gemini 2.0 (Recommended)">
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                      <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Experimental)</option>
                    </optgroup>
                    <optgroup label="Gemini 1.5">
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-simmonds-stone mt-1">Creates beautiful HTML layouts & styles</p>
                </div>

                {/* 3. Image Generation Model */}
                <div className="bg-white rounded-lg p-3 border border-simmonds-cream">
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-simmonds-terracotta text-white rounded-full flex items-center justify-center text-xs">3</span>
                    Image Generation
                  </label>
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className="w-full px-3 py-2 border border-simmonds-cream rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <option value="none">None (Text Only)</option>
                    <optgroup label="Gemini 3 Image (Latest)">
                      <option value="gemini-3-pro-image-preview" disabled={!companySettings?.apis?.gemini?.apiKey}>
                        Nano Banana 2 / Gemini 3 Pro Image {!companySettings?.apis?.gemini?.apiKey && '(API key required)'}
                      </option>
                    </optgroup>
                    <optgroup label="Imagen 3">
                      <option value="imagen-3.0-generate-002" disabled={!companySettings?.apis?.gemini?.apiKey}>
                        Imagen 3.0 (High Quality) {!companySettings?.apis?.gemini?.apiKey && '(API key required)'}
                      </option>
                      <option value="imagen-3.0-fast-generate-001" disabled={!companySettings?.apis?.gemini?.apiKey}>
                        Imagen 3.0 Fast {!companySettings?.apis?.gemini?.apiKey && '(API key required)'}
                      </option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="dall-e-3" disabled={!companySettings?.apis?.openai?.apiKey}>
                        DALL-E 3 {!companySettings?.apis?.openai?.apiKey && '(API key required)'}
                      </option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-simmonds-stone mt-1">Generates vocabulary illustrations</p>
                </div>

                {/* 4. Audio Script Model */}
                <div className="bg-white rounded-lg p-3 border border-simmonds-cream">
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">4</span>
                    Audio Scripts
                  </label>
                  <select
                    value={audioScriptModel}
                    onChange={(e) => setAudioScriptModel(e.target.value)}
                    className="w-full px-3 py-2 border border-simmonds-cream rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <optgroup label="Gemini 3 (Latest)">
                      <option value="gemini-3-pro-preview">Gemini 3 Pro (Most Advanced)</option>
                    </optgroup>
                    <optgroup label="Gemini 2.0 (Recommended)">
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                      <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Experimental)</option>
                    </optgroup>
                    <optgroup label="Gemini 1.5">
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-simmonds-stone mt-1">Creates scripts for text-to-speech audio</p>
                </div>
              </div>

              {/* OpenRouter Model Selection (only shown when contentModel is 'openrouter') */}
              {contentModel === 'openrouter' && (
                <div className="mt-4 pt-4 border-t border-purple-100">
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                    OpenRouter Model Selection
                  </label>
                  <input
                    type="text"
                    placeholder="Search OpenRouter models..."
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary text-sm mb-2"
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                  />
                  <select
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    size={5}
                  >
                    {isLoadingModels ? (
                      <option disabled>Loading models...</option>
                    ) : openRouterModels.length > 0 ? (
                      openRouterModels
                        .filter(model =>
                          modelSearchQuery === '' ||
                          model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                          model.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                        )
                        .map(model => {
                          const isFree = model.pricing?.prompt === '0' || model.id.includes(':free');
                          const contextK = Math.round(model.context_length / 1000);
                          return (
                            <option key={model.id} value={model.id}>
                              {isFree ? '🆓 ' : ''}{model.name} ({contextK}K context)
                            </option>
                          );
                        })
                    ) : (
                      <>
                        <option value="anthropic/claude-sonnet-4">Anthropic: Claude Sonnet 4</option>
                        <option value="anthropic/claude-3.5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                        <option value="openai/gpt-4-turbo">OpenAI: GPT-4 Turbo</option>
                        <option value="openai/gpt-4o">OpenAI: GPT-4o</option>
                        <option value="google/gemini-pro-1.5">Google: Gemini Pro 1.5</option>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-simmonds-stone mt-1">
                    {openRouterModels.length > 0
                      ? `${openRouterModels.filter(m =>
                          modelSearchQuery === '' ||
                          m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                          m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                        ).length} of ${openRouterModels.length} models shown`
                      : 'Loading available models...'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Lesson Transcript (Optional)
              </label>
              <p className="text-sm text-simmonds-stone mb-2">
                Paste a transcript from a real lesson to create a virtual version based on it.
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-40"
                placeholder="Paste your lesson transcript here..."
              />
            </div>

            {/* Advanced Options */}
            <div className="border border-simmonds-cream rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full px-4 py-3 bg-simmonds-cream/30 flex items-center justify-between hover:bg-simmonds-cream/50 transition-colors"
              >
                <span className="font-medium text-simmonds-charcoal flex items-center gap-2">
                  <span>⚙️</span>
                  Advanced Options
                </span>
                <span className="text-simmonds-stone transform transition-transform" style={{ transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>

              {showAdvancedOptions && (
                <div className="p-4 space-y-4 bg-white">
                  <div>
                    <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                      Additional Instructions (Optional)
                    </label>
                    <p className="text-xs text-simmonds-stone mb-2">
                      Add specific instructions for this lesson (e.g., focus areas, style preferences, specific vocabulary to include)
                    </p>
                    <textarea
                      value={additionalPrompt}
                      onChange={(e) => setAdditionalPrompt(e.target.value)}
                      className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
                      placeholder="e.g., Focus on business email writing, include formal and informal examples, add role-play exercises..."
                    />
                  </div>

                  {/* Auto Audio Generation */}
                  <div className="flex items-center justify-between p-3 bg-simmonds-olive/5 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-simmonds-charcoal">Auto-generate Audio</label>
                      <p className="text-xs text-simmonds-stone">Automatically generate audio for vocabulary and sections</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGenerateAudio}
                        onChange={(e) => setAutoGenerateAudio(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-simmonds-cream rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-simmonds-olive"></div>
                    </label>
                  </div>

                  {(company as any)?.aiPromptTemplates?.systemPrompt && (
                    <div className="p-3 bg-simmonds-lime/10 rounded-lg">
                      <p className="text-xs font-medium text-simmonds-olive mb-1">Company Default Prompt Active</p>
                      <p className="text-xs text-simmonds-stone line-clamp-2">
                        {(company as any).aiPromptTemplates.systemPrompt.substring(0, 150)}...
                      </p>
                    </div>
                  )}

                  {(company as any)?.aiPromptTemplates?.presentationFormat && (
                    <div className="p-3 bg-simmonds-primary/5 rounded-lg">
                      <p className="text-xs font-medium text-simmonds-primary mb-1">Presentation Format Configured</p>
                      <p className="text-xs text-simmonds-stone line-clamp-2">
                        {(company as any).aiPromptTemplates.presentationFormat.substring(0, 150)}...
                      </p>
                    </div>
                  )}

                  {(company as any)?.aiPromptTemplates?.homeworkFormat && (
                    <div className="p-3 bg-simmonds-terracotta/10 rounded-lg">
                      <p className="text-xs font-medium text-simmonds-terracotta mb-1">Homework Format Configured</p>
                      <p className="text-xs text-simmonds-stone line-clamp-2">
                        {(company as any).aiPromptTemplates.homeworkFormat.substring(0, 150)}...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={generateLesson}
                disabled={isGenerating}
                className="px-6 py-3 bg-gradient-to-r from-simmonds-primary to-simmonds-olive text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    {generationProgress || 'Generating...'}
                  </>
                ) : (
                  <>✨ Generate Lesson with AI</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Enhance */}
        {activeStep === 2 && generatedLesson && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={generatedLesson.title}
                    onChange={(e) => setGeneratedLesson({ ...generatedLesson, title: e.target.value })}
                    className="text-xl font-bold text-simmonds-charcoal w-full px-3 py-1 border border-simmonds-primary rounded-lg focus:outline-none"
                  />
                ) : (
                  <h2 className="text-xl font-bold text-simmonds-charcoal">{generatedLesson.title}</h2>
                )}
                {isEditing ? (
                  <input
                    type="text"
                    value={generatedLesson.description}
                    onChange={(e) => setGeneratedLesson({ ...generatedLesson, description: e.target.value })}
                    className="text-simmonds-stone w-full px-3 py-1 border border-simmonds-cream rounded-lg focus:outline-none mt-1"
                  />
                ) : (
                  <p className="text-simmonds-stone">{generatedLesson.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isEditing
                      ? 'bg-simmonds-lime text-white hover:bg-simmonds-lime/90'
                      : 'bg-simmonds-olive/10 text-simmonds-olive hover:bg-simmonds-olive/20'
                  }`}
                >
                  {isEditing ? '✓ Done Editing' : '✏️ Edit Lesson'}
                </button>
                <button
                  onClick={() => setActiveStep(1)}
                  className="text-simmonds-primary hover:underline"
                >
                  ← Regenerate
                </button>
              </div>
            </div>

            {/* Objectives */}
            <div className="bg-simmonds-lime/10 p-4 rounded-xl">
              <h3 className="font-semibold text-simmonds-charcoal mb-2">Learning Objectives</h3>
              <ul className="space-y-2 text-simmonds-stone">
                {generatedLesson.objectives.map((obj, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-simmonds-lime">•</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={obj}
                        onChange={(e) => {
                          const newObjectives = [...generatedLesson.objectives];
                          newObjectives[i] = e.target.value;
                          setGeneratedLesson({ ...generatedLesson, objectives: newObjectives });
                        }}
                        className="flex-1 px-2 py-1 border border-simmonds-cream rounded focus:outline-none focus:border-simmonds-primary"
                      />
                    ) : (
                      obj
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-simmonds-charcoal">Lesson Sections</h3>
                {isEditing && (
                  <span className="text-xs text-simmonds-stone">Click section title to edit</span>
                )}
              </div>
              <div className="space-y-3">
                {generatedLesson.sections.map((section, idx) => (
                  <div
                    key={section.id}
                    className={`border rounded-xl overflow-hidden ${
                      editingSection === section.id ? 'border-simmonds-primary' : 'border-simmonds-cream'
                    }`}
                  >
                    <div className="flex items-center gap-3 p-3 bg-simmonds-cream/30">
                      <span className="w-6 h-6 bg-simmonds-primary text-white rounded-full flex items-center justify-center text-sm">
                        {section.order}
                      </span>
                      {isEditing && editingSection === section.id ? (
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const newSections = [...generatedLesson.sections];
                            newSections[idx] = { ...section, title: e.target.value };
                            setGeneratedLesson({ ...generatedLesson, sections: newSections });
                          }}
                          className="font-medium text-simmonds-charcoal flex-1 px-2 py-1 border border-simmonds-primary rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`font-medium text-simmonds-charcoal flex-1 ${isEditing ? 'cursor-pointer hover:text-simmonds-primary' : ''}`}
                          onClick={() => isEditing && setEditingSection(section.id)}
                        >
                          {section.title}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary rounded text-xs">
                        {section.type}
                      </span>
                      {isEditing && (
                        <button
                          onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
                          className="text-xs text-simmonds-olive hover:text-simmonds-olive-dark"
                        >
                          {editingSection === section.id ? 'Close' : 'Edit'}
                        </button>
                      )}
                    </div>
                    {editingSection === section.id ? (
                      <textarea
                        value={section.content}
                        onChange={(e) => {
                          const newSections = [...generatedLesson.sections];
                          newSections[idx] = { ...section, content: e.target.value, visualContent: undefined };
                          setGeneratedLesson({ ...generatedLesson, sections: newSections });
                        }}
                        className="w-full p-4 min-h-[200px] font-mono text-sm border-t border-simmonds-cream focus:outline-none"
                        placeholder="Enter HTML content..."
                      />
                    ) : (
                      <div
                        className="p-4 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: section.visualContent || section.content }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vocabulary Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-simmonds-charcoal">
                  Vocabulary ({generatedLesson.vocabulary.length} words)
                </h3>
                {isEditing && (
                  <button
                    onClick={() => setGeneratedLesson({
                      ...generatedLesson,
                      vocabulary: [...generatedLesson.vocabulary, {
                        word: 'new word',
                        definition: 'definition',
                        example: 'example sentence',
                        pronunciation: '',
                        partOfSpeech: 'noun'
                      }]
                    })}
                    className="text-xs px-3 py-1 bg-simmonds-olive/10 text-simmonds-olive rounded-lg hover:bg-simmonds-olive/20"
                  >
                    + Add Word
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {generatedLesson.vocabulary.map((vocab, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border rounded-xl bg-gradient-to-br from-white to-simmonds-cream/30 ${
                      editingVocab === vocab.word ? 'border-simmonds-primary' : 'border-simmonds-cream'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {isEditing && editingVocab === vocab.word ? (
                          <input
                            type="text"
                            value={vocab.word}
                            onChange={(e) => {
                              const newVocab = [...generatedLesson.vocabulary];
                              newVocab[idx] = { ...vocab, word: e.target.value };
                              setGeneratedLesson({ ...generatedLesson, vocabulary: newVocab });
                            }}
                            className="font-bold text-simmonds-primary px-2 py-0.5 border border-simmonds-primary rounded w-32 focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`font-bold text-simmonds-primary ${isEditing ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={() => isEditing && setEditingVocab(vocab.word)}
                          >
                            {vocab.word}
                          </span>
                        )}
                        {vocab.partOfSpeech && (
                          <span className="text-xs text-simmonds-stone">({vocab.partOfSpeech})</span>
                        )}
                        {generatedAudios[`vocab-${vocab.word}`] && (
                          <button
                            onClick={() => new Audio(generatedAudios[`vocab-${vocab.word}`]).play()}
                            className="text-simmonds-olive hover:text-simmonds-olive-dark"
                          >
                            🔊
                          </button>
                        )}
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => {
                            const newVocab = generatedLesson.vocabulary.filter((_, i) => i !== idx);
                            setGeneratedLesson({ ...generatedLesson, vocabulary: newVocab });
                          }}
                          className="text-xs text-simmonds-terracotta hover:text-simmonds-terracotta/80"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {isEditing && editingVocab === vocab.word ? (
                      <div className="space-y-2 mt-2">
                        <input
                          type="text"
                          value={vocab.definition}
                          onChange={(e) => {
                            const newVocab = [...generatedLesson.vocabulary];
                            newVocab[idx] = { ...vocab, definition: e.target.value };
                            setGeneratedLesson({ ...generatedLesson, vocabulary: newVocab });
                          }}
                          className="w-full px-2 py-1 text-sm border border-simmonds-cream rounded focus:outline-none"
                          placeholder="Definition"
                        />
                        <input
                          type="text"
                          value={vocab.example}
                          onChange={(e) => {
                            const newVocab = [...generatedLesson.vocabulary];
                            newVocab[idx] = { ...vocab, example: e.target.value };
                            setGeneratedLesson({ ...generatedLesson, vocabulary: newVocab });
                          }}
                          className="w-full px-2 py-1 text-sm border border-simmonds-cream rounded focus:outline-none"
                          placeholder="Example sentence"
                        />
                        <button
                          onClick={() => setEditingVocab(null)}
                          className="text-xs text-simmonds-olive"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-simmonds-charcoal">{vocab.definition}</p>
                        <p className="text-sm text-simmonds-stone italic mt-1">"{vocab.example}"</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Grammar Preview */}
            <div>
              <h3 className="font-semibold text-simmonds-charcoal mb-3">
                Grammar Points ({generatedLesson.grammarPoints.length})
              </h3>
              <div className="space-y-3">
                {generatedLesson.grammarPoints.map((grammar, i) => (
                  <div key={i} className="p-4 border border-simmonds-cream rounded-xl">
                    <h4 className="font-semibold text-simmonds-olive mb-2">{grammar.title}</h4>
                    <p className="text-sm text-simmonds-charcoal mb-2">{grammar.explanation}</p>
                    <div className="flex flex-wrap gap-2">
                      {grammar.examples.map((ex, j) => (
                        <span
                          key={j}
                          className="px-3 py-1 bg-simmonds-cream/50 rounded-lg text-sm"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Preview */}
            <div>
              <h3 className="font-semibold text-simmonds-charcoal mb-3">
                Assessment ({generatedLesson.testQuestions.length} questions)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-simmonds-primary/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-simmonds-primary">
                    {generatedLesson.testQuestions.filter((q) => q.type === 'multiple_choice').length}
                  </p>
                  <p className="text-xs text-simmonds-stone">Multiple Choice</p>
                </div>
                <div className="p-3 bg-simmonds-olive/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-simmonds-olive">
                    {generatedLesson.testQuestions.filter((q) => q.type === 'fill_in_blank').length}
                  </p>
                  <p className="text-xs text-simmonds-stone">Fill in Blank</p>
                </div>
                <div className="p-3 bg-simmonds-lime/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-simmonds-lime">
                    {generatedLesson.testQuestions.filter((q) => q.type === 'true_false').length}
                  </p>
                  <p className="text-xs text-simmonds-stone">True/False</p>
                </div>
                <div className="p-3 bg-simmonds-terracotta/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-simmonds-terracotta">
                    {generatedLesson.testQuestions.filter((q) => q.type === 'listening').length}
                  </p>
                  <p className="text-xs text-simmonds-stone">🎧 Listening</p>
                </div>
              </div>
              <div className="space-y-2">
                {generatedLesson.testQuestions.map((q, idx) => (
                  <div key={q.id} className="flex items-center gap-3 p-2 bg-simmonds-cream/30 rounded-lg text-sm">
                    <span className="w-6 h-6 bg-simmonds-primary text-white rounded-full flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      q.type === 'multiple_choice' ? 'bg-simmonds-primary/20 text-simmonds-primary' :
                      q.type === 'fill_in_blank' ? 'bg-simmonds-olive/20 text-simmonds-olive' :
                      q.type === 'true_false' ? 'bg-simmonds-lime/20 text-simmonds-lime' :
                      'bg-simmonds-terracotta/20 text-simmonds-terracotta'
                    }`}>
                      {q.type === 'listening' ? '🎧' : ''} {q.type.replace('_', ' ')}
                    </span>
                    <span className="flex-1 text-simmonds-charcoal truncate">{q.questionText}</span>
                    <span className="text-xs text-simmonds-stone">{q.points} pts</span>
                    {q.audioUrl && <span className="text-simmonds-olive">🔊</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Generation */}
            <div className="border border-simmonds-cream rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-simmonds-charcoal">Audio Generation (Optional)</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  lessonLanguage === 'german'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {lessonLanguage === 'german' ? '🇩🇪 German Voices' : '🇬🇧 English Voices'}
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm text-simmonds-stone mb-1">Voice</label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl"
                  >
                    {/* Standard voices for the selected language */}
                    <optgroup label={lessonLanguage === 'german' ? 'German Voices' : 'English Voices'}>
                      {allVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name} ({voice.accent})
                        </option>
                      ))}
                    </optgroup>
                    {/* Custom company voices if any */}
                    {customVoices.length > 0 && (
                      <optgroup label="Custom Voices">
                        {customVoices.map((voice: any) => (
                          <option key={voice.id} value={voice.id}>
                            ⭐ {voice.name} (Custom)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <button
                  onClick={generateAllAudio}
                  disabled={isGeneratingAudio || !getElevenLabsApiKey()}
                  className="px-4 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light disabled:opacity-50"
                >
                  {isGeneratingAudio ? generationProgress || 'Generating...' : '🔊 Generate Audio'}
                </button>
              </div>
              {!getElevenLabsApiKey() && (
                <p className="text-sm text-simmonds-terracotta">
                  ElevenLabs API key required. Configure it in Settings and click Save.
                </p>
              )}
              {Object.keys(generatedAudios).length > 0 && (
                <p className="text-sm text-simmonds-lime-dark">
                  ✓ {Object.keys(generatedAudios).length} audio files generated
                </p>
              )}
            </div>

            {errors.save && (
              <div className="p-4 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl">
                {errors.save}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                onClick={saveLesson}
                disabled={isGenerating}
                className="px-6 py-3 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    {generationProgress || 'Saving...'}
                  </>
                ) : (
                  <>💾 Save Lesson</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {activeStep === 3 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-simmonds-lime/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-simmonds-charcoal mb-2">Lesson Created!</h2>
            <p className="text-simmonds-stone mb-6">
              Your virtual lesson has been created with vocabulary, grammar exercises, and an
              assessment test.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setActiveStep(1);
                  setGeneratedLesson(null);
                  setTopic('');
                  setTranscript('');
                }}
                className="px-6 py-3 bg-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
              >
                Create Another Lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualLessonBuilder;
