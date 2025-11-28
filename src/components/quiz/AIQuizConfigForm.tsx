import React, { useState, useEffect } from 'react';
import QuestionTypeSelector, { QuestionType } from './QuestionTypeSelector';
import VoiceSelector from './VoiceSelector';

// LocalStorage keys for persisting API keys
const STORAGE_KEY_OPENROUTER = 'simmonds_openrouter_api_key';
const STORAGE_KEY_ELEVENLABS = 'simmonds_elevenlabs_api_key';

// Simple text extraction from PDF (client-side, basic)
async function extractTextFromPDF(file: File): Promise<string> {
  // For a simple approach, we'll read the binary and extract visible text
  // This is a basic implementation - complex PDFs may need server-side processing
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Convert to string and try to extract readable text between stream markers
  let text = '';
  let textChunks: string[] = [];

  // Simple approach: look for text between BT and ET markers (PDF text objects)
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const pdfString = decoder.decode(bytes);

  // Extract text from PDF streams (simplified)
  const textMatches = pdfString.match(/\(([^)]+)\)/g);
  if (textMatches) {
    textChunks = textMatches.map(m => m.slice(1, -1));
    text = textChunks.join(' ');
  }

  // Clean up the text
  text = text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If we couldn't extract much, provide a helpful message
  if (text.length < 50) {
    throw new Error('Could not extract text from PDF. Please try a text file or copy-paste the content.');
  }

  return text;
}

// Simple text extraction from DOCX (client-side)
async function extractTextFromDocx(file: File): Promise<string> {
  // DOCX files are ZIP archives containing XML
  // We'll use the browser's built-in compression API if available

  try {
    // Try to use JSZip-like approach with native APIs
    const arrayBuffer = await file.arrayBuffer();

    // DOCX is a ZIP file - try to find document.xml content
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(arrayBuffer);

    // Look for text content in the XML
    // Simple regex to extract text from XML tags
    const textContent = content
      .replace(/<[^>]+>/g, ' ') // Remove XML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Filter to only readable ASCII/Unicode text
    const readableText = textContent
      .split('')
      .filter(char => {
        const code = char.charCodeAt(0);
        return (code >= 32 && code <= 126) || code >= 160 || char === '\n';
      })
      .join('');

    if (readableText.length < 50) {
      throw new Error('Could not extract text from DOCX');
    }

    return readableText;
  } catch {
    throw new Error('Could not extract text from DOCX. Please try a text file or copy-paste the content.');
  }
}

export interface QuizGenerationConfig {
  title: string;
  language: 'english' | 'german';
  targetLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topic: string;
  numberOfQuestions: number;
  questionTypes: QuestionType[];
  audioWordLimit: number;
  selectedVoiceId: string;
  selectedVoiceName: string;
  replaysAllowed: number;
  timeLimitMinutes?: number;
  // Document-based generation
  documentContent?: string;
  documentName?: string;
  // AI Model selection
  selectedModelId?: string;
  selectedModelName?: string;
  // API Keys (for manual override/testing)
  openRouterApiKey?: string;
  elevenLabsApiKeyOverride?: string;
}

// Available AI model for quiz generation (kept for backwards compatibility)
export interface AvailableAIModel {
  id: string;
  name: string;
  provider: string;
  isDefault?: boolean;
}

interface AIQuizConfigFormProps {
  onSubmit: (config: QuizGenerationConfig) => void;
  isLoading?: boolean;
  elevenLabsApiKey?: string;
  openRouterApiKey?: string;
  companyId?: string;
  onSaveApiKeys?: (openRouterKey: string, elevenLabsKey: string) => Promise<void>;
  availableModels?: AvailableAIModel[]; // Optional - dropdown now has built-in models
}

const defaultConfig: QuizGenerationConfig = {
  title: '',
  language: 'english',
  targetLevel: 'B1',
  topic: '',
  numberOfQuestions: 10,
  questionTypes: ['multiple-choice', 'fill-blank', 'true-false'],
  audioWordLimit: 50,
  selectedVoiceId: '21m00Tcm4TlvDq8ikWAM', // Emma
  selectedVoiceName: 'Emma',
  replaysAllowed: 3,
  timeLimitMinutes: 30,
  selectedModelId: 'anthropic/claude-opus-4', // Default model
  selectedModelName: 'Claude Opus 4.5',
};

const AIQuizConfigForm: React.FC<AIQuizConfigFormProps> = ({
  onSubmit,
  isLoading = false,
  elevenLabsApiKey = '',
  openRouterApiKey = '',
  onSaveApiKeys,
}) => {
  const [config, setConfig] = useState<QuizGenerationConfig>(defaultConfig);
  const [errors, setErrors] = useState<Partial<Record<keyof QuizGenerationConfig, string>>>({});
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [keysSaved, setKeysSaved] = useState(false);

  // Load API keys from props (company settings) or localStorage on mount
  useEffect(() => {
    // First check props (from company settings in database)
    if (openRouterApiKey || elevenLabsApiKey) {
      setConfig(prev => ({
        ...prev,
        openRouterApiKey: openRouterApiKey || prev.openRouterApiKey,
        elevenLabsApiKeyOverride: elevenLabsApiKey || prev.elevenLabsApiKeyOverride,
      }));
    } else {
      // Fallback to localStorage
      const savedOpenRouterKey = localStorage.getItem(STORAGE_KEY_OPENROUTER);
      const savedElevenLabsKey = localStorage.getItem(STORAGE_KEY_ELEVENLABS);

      if (savedOpenRouterKey || savedElevenLabsKey) {
        setConfig(prev => ({
          ...prev,
          openRouterApiKey: savedOpenRouterKey || prev.openRouterApiKey,
          elevenLabsApiKeyOverride: savedElevenLabsKey || prev.elevenLabsApiKeyOverride,
        }));
      }
    }
  }, [openRouterApiKey, elevenLabsApiKey]);

  // Save API keys to database (via callback) and localStorage
  const handleApiKeyChange = (key: 'openRouterApiKey' | 'elevenLabsApiKeyOverride', value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setKeysSaved(false); // Reset saved status when keys change

    // Save to localStorage as backup
    if (key === 'openRouterApiKey') {
      if (value) {
        localStorage.setItem(STORAGE_KEY_OPENROUTER, value);
      } else {
        localStorage.removeItem(STORAGE_KEY_OPENROUTER);
      }
    } else if (key === 'elevenLabsApiKeyOverride') {
      if (value) {
        localStorage.setItem(STORAGE_KEY_ELEVENLABS, value);
      } else {
        localStorage.removeItem(STORAGE_KEY_ELEVENLABS);
      }
    }
  };

  // Save API keys to database
  const handleSaveApiKeys = async () => {
    if (!onSaveApiKeys) return;

    setIsSavingKeys(true);
    try {
      await onSaveApiKeys(
        config.openRouterApiKey || '',
        config.elevenLabsApiKeyOverride || ''
      );
      setKeysSaved(true);
    } catch (error) {
      console.error('Failed to save API keys:', error);
    } finally {
      setIsSavingKeys(false);
    }
  };

  const hasListeningType = config.questionTypes.includes('listening');
  const hasDocument = !!config.documentContent;

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof QuizGenerationConfig, string>> = {};

    if (!config.title.trim()) {
      newErrors.title = 'Quiz title is required';
    }

    if (!config.topic.trim() && !config.documentContent) {
      newErrors.topic = 'Topic is required (or upload a document)';
    }

    if (config.numberOfQuestions < 5 || config.numberOfQuestions > 100) {
      newErrors.numberOfQuestions = 'Number of questions must be between 5 and 100';
    }

    if (config.questionTypes.length === 0) {
      newErrors.questionTypes = 'At least one question type must be selected';
    }

    if (hasListeningType) {
      if (config.audioWordLimit < 20 || config.audioWordLimit > 150) {
        newErrors.audioWordLimit = 'Audio word limit must be between 20 and 150';
      }
      // Check both the prop and the form field for ElevenLabs API key
      if (!elevenLabsApiKey && !config.elevenLabsApiKeyOverride) {
        newErrors.elevenLabsApiKeyOverride = 'ElevenLabs API key required for listening questions';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(config);
    }
  };

  const updateConfig = <K extends keyof QuizGenerationConfig>(
    key: K,
    value: QuizGenerationConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Clear error when field is updated
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const allowedExtensions = ['.txt', '.pdf', '.docx', '.doc'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setErrors((prev) => ({ ...prev, documentContent: 'Please upload a .txt, .pdf, or .docx file' }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, documentContent: 'File size must be less than 5MB' }));
      return;
    }

    setIsProcessingDocument(true);
    setErrors((prev) => ({ ...prev, documentContent: undefined }));

    try {
      let content = '';

      if (file.type === 'text/plain' || fileExtension === '.txt') {
        // Read text file directly
        content = await file.text();
      } else if (file.type === 'application/pdf' || fileExtension === '.pdf') {
        // For PDF, we'll extract text client-side using a simple approach
        // Note: For complex PDFs, server-side processing would be better
        content = await extractTextFromPDF(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileExtension === '.docx'
      ) {
        // For DOCX, extract text
        content = await extractTextFromDocx(file);
      }

      if (!content.trim()) {
        setErrors((prev) => ({ ...prev, documentContent: 'Could not extract text from the document' }));
        return;
      }

      // Limit content length (keep first ~10000 characters for API limits)
      const maxChars = 10000;
      if (content.length > maxChars) {
        content = content.substring(0, maxChars) + '\n\n[Document truncated for processing...]';
      }

      setConfig((prev) => ({
        ...prev,
        documentContent: content,
        documentName: file.name,
        // Auto-set topic if empty
        topic: prev.topic || `Content from: ${file.name}`,
      }));
    } catch (error) {
      console.error('Error processing document:', error);
      setErrors((prev) => ({ ...prev, documentContent: 'Error processing document. Please try a different file.' }));
    } finally {
      setIsProcessingDocument(false);
    }
  };

  const clearDocument = () => {
    setConfig((prev) => ({
      ...prev,
      documentContent: undefined,
      documentName: undefined,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Quiz Generator
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quiz Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Quiz Title *
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => updateConfig('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                errors.title ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
              }`}
              placeholder="e.g., Business English Basics"
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-simmonds-terracotta">{errors.title}</p>
            )}
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Language
            </label>
            <select
              value={config.language}
              onChange={(e) => updateConfig('language', e.target.value as 'english' | 'german')}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              disabled={isLoading}
            >
              <option value="english">English</option>
              <option value="german">German</option>
            </select>
          </div>

          {/* Target Level */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Target Level (CEFR)
            </label>
            <select
              value={config.targetLevel}
              onChange={(e) =>
                updateConfig('targetLevel', e.target.value as QuizGenerationConfig['targetLevel'])
              }
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              disabled={isLoading}
            >
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Proficient</option>
            </select>
          </div>

          {/* Topic */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Topic / Theme {!hasDocument && '*'}
            </label>
            <input
              type="text"
              value={config.topic}
              onChange={(e) => updateConfig('topic', e.target.value)}
              className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                errors.topic ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
              }`}
              placeholder="e.g., Business meetings, Travel vocabulary, Present perfect tense"
              disabled={isLoading}
            />
            {errors.topic && (
              <p className="mt-1 text-sm text-simmonds-terracotta">{errors.topic}</p>
            )}
          </div>

          {/* AI Model Dropdown */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              AI Model
            </label>
            <select
              value={config.selectedModelId || 'anthropic/claude-opus-4'}
              onChange={(e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                updateConfig('selectedModelId', e.target.value);
                updateConfig('selectedModelName', selectedOption.text);
              }}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              disabled={isLoading}
            >
              <option value="anthropic/claude-opus-4">Claude Opus 4.5</option>
              <option value="google/gemini-2.0-flash-001">Gemini 3 Pro</option>
              <option value="anthropic/claude-3-haiku">Claude 3 Haiku (Fast)</option>
            </select>
          </div>

          {/* Document Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Upload Document (Optional)
            </label>
            <p className="text-xs text-simmonds-stone mb-2">
              Upload a document to generate questions from its content. Supports .txt, .pdf, .docx
            </p>

            {!hasDocument ? (
              <div className="relative">
                <input
                  type="file"
                  accept=".txt,.pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isLoading || isProcessingDocument}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  className={`
                    border-2 border-dashed rounded-xl p-6 text-center transition-colors
                    ${isProcessingDocument ? 'border-simmonds-primary bg-simmonds-primary/5' : 'border-simmonds-cream hover:border-simmonds-stone/30'}
                  `}
                >
                  {isProcessingDocument ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 text-simmonds-primary animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-simmonds-primary font-medium">Processing document...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-simmonds-stone mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-simmonds-charcoal font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-simmonds-stone mt-1">PDF, DOCX, or TXT (max 5MB)</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-simmonds-olive/10 border border-simmonds-olive/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-simmonds-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-simmonds-charcoal">{config.documentName}</p>
                    <p className="text-xs text-simmonds-stone">
                      {config.documentContent?.length.toLocaleString()} characters extracted
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearDocument}
                  disabled={isLoading}
                  className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg transition-colors"
                  title="Remove document"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {errors.documentContent && (
              <p className="mt-1 text-sm text-simmonds-terracotta">{errors.documentContent}</p>
            )}
          </div>

          {/* Number of Questions */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Number of Questions
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="5"
                max="100"
                value={config.numberOfQuestions}
                onChange={(e) => updateConfig('numberOfQuestions', parseInt(e.target.value))}
                className="flex-1 h-2 bg-simmonds-cream rounded-lg appearance-none cursor-pointer"
                disabled={isLoading}
              />
              <span className="w-12 text-center font-medium text-simmonds-charcoal">
                {config.numberOfQuestions}
              </span>
            </div>
            {errors.numberOfQuestions && (
              <p className="mt-1 text-sm text-simmonds-terracotta">{errors.numberOfQuestions}</p>
            )}
          </div>

          {/* Time Limit */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Time Limit (minutes)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.timeLimitMinutes || ''}
                onChange={(e) =>
                  updateConfig(
                    'timeLimitMinutes',
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className="w-24 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                placeholder="30"
                min="5"
                max="180"
                disabled={isLoading}
              />
              <label className="flex items-center gap-2 text-sm text-simmonds-stone">
                <input
                  type="checkbox"
                  checked={config.timeLimitMinutes === undefined}
                  onChange={(e) =>
                    updateConfig('timeLimitMinutes', e.target.checked ? undefined : 30)
                  }
                  className="rounded border-simmonds-cream text-simmonds-primary focus:ring-simmonds-primary"
                  disabled={isLoading}
                />
                No limit
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Question Types Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <QuestionTypeSelector
          selectedTypes={config.questionTypes}
          onChange={(types) => updateConfig('questionTypes', types)}
          disabled={isLoading}
        />
        {errors.questionTypes && (
          <p className="mt-2 text-sm text-simmonds-terracotta">{errors.questionTypes}</p>
        )}
      </div>

      {/* Audio Settings (shown when listening is selected) */}
      {hasListeningType && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            Audio Settings
          </h3>

          <div className="space-y-4">
            {/* Max Words per Audio */}
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Max Words per Audio Script
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="10"
                  value={config.audioWordLimit}
                  onChange={(e) => updateConfig('audioWordLimit', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-simmonds-cream rounded-lg appearance-none cursor-pointer"
                  disabled={isLoading}
                />
                <span className="w-16 text-center font-medium text-simmonds-charcoal">
                  {config.audioWordLimit} words
                </span>
              </div>
              {errors.audioWordLimit && (
                <p className="mt-1 text-sm text-simmonds-terracotta">{errors.audioWordLimit}</p>
              )}
            </div>

            {/* Voice Selection */}
            <VoiceSelector
              language={config.language}
              selectedVoiceId={config.selectedVoiceId}
              onSelect={(voiceId, voiceName) => {
                updateConfig('selectedVoiceId', voiceId);
                updateConfig('selectedVoiceName', voiceName);
              }}
              apiKey={elevenLabsApiKey}
            />
            {errors.selectedVoiceId && (
              <p className="mt-1 text-sm text-simmonds-terracotta">{errors.selectedVoiceId}</p>
            )}

            {/* Replays Allowed */}
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Audio Replays Allowed
              </label>
              <select
                value={config.replaysAllowed}
                onChange={(e) => updateConfig('replaysAllowed', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                disabled={isLoading}
              >
                <option value={0}>No replays</option>
                <option value={1}>1 replay</option>
                <option value={2}>2 replays</option>
                <option value={3}>3 replays</option>
                <option value={5}>5 replays</option>
                <option value={10}>Unlimited (10)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Configuration (for testing/override) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          API Keys (Testing)
        </h3>
        <p className="text-xs text-simmonds-stone mb-4">
          Enter API keys here for testing. In production, these should be configured in Company Settings.
        </p>

        <div className="grid grid-cols-1 gap-4">
          {/* OpenRouter API Key */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              OpenRouter API Key *
            </label>
            <input
              type="password"
              value={config.openRouterApiKey || ''}
              onChange={(e) => handleApiKeyChange('openRouterApiKey', e.target.value)}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary font-mono text-sm"
              placeholder="sk-or-v1-..."
              disabled={isLoading}
            />
            <p className="text-xs text-simmonds-stone mt-1">
              Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-simmonds-primary hover:underline">openrouter.ai</a>
              {config.openRouterApiKey && <span className="ml-2 text-simmonds-lime">(saved locally)</span>}
            </p>
          </div>

          {/* ElevenLabs API Key (only shown if listening questions selected) */}
          {hasListeningType && (
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                ElevenLabs API Key (for audio) *
              </label>
              <input
                type="password"
                value={config.elevenLabsApiKeyOverride || ''}
                onChange={(e) => handleApiKeyChange('elevenLabsApiKeyOverride', e.target.value)}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary font-mono text-sm ${
                  errors.elevenLabsApiKeyOverride ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
                }`}
                placeholder="sk_..."
                disabled={isLoading}
              />
              {errors.elevenLabsApiKeyOverride && (
                <p className="text-xs text-simmonds-terracotta mt-1">{errors.elevenLabsApiKeyOverride}</p>
              )}
              <p className="text-xs text-simmonds-stone mt-1">
                Get your API key from <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-simmonds-primary hover:underline">elevenlabs.io</a>
                {config.elevenLabsApiKeyOverride && <span className="ml-2 text-simmonds-lime">(saved locally)</span>}
              </p>
            </div>
          )}

          {/* Save API Keys Button */}
          {onSaveApiKeys && (config.openRouterApiKey || config.elevenLabsApiKeyOverride) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveApiKeys}
                disabled={isSavingKeys || keysSaved}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all
                  ${keysSaved
                    ? 'bg-simmonds-lime/20 text-simmonds-lime cursor-default'
                    : isSavingKeys
                    ? 'bg-simmonds-cream text-simmonds-stone cursor-wait'
                    : 'bg-simmonds-primary/10 text-simmonds-primary hover:bg-simmonds-primary/20'
                  }
                `}
              >
                {isSavingKeys ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : keysSaved ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Saved to Company Settings
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save API Keys to Database
                  </>
                )}
              </button>
              <p className="text-xs text-simmonds-stone mt-1">
                Save keys permanently so they persist across sessions and devices
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className={`
            px-6 py-3 rounded-xl font-medium text-white
            flex items-center gap-2 transition-all duration-200
            ${isLoading
              ? 'bg-simmonds-stone/50 cursor-not-allowed'
              : 'bg-gradient-to-r from-simmonds-primary to-simmonds-primary-dark hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
            }
          `}
        >
          {isLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Quiz with AI
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default AIQuizConfigForm;
