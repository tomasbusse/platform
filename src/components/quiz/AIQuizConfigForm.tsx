import React, { useState } from 'react';
import QuestionTypeSelector, { QuestionType } from './QuestionTypeSelector';
import VoiceSelector from './VoiceSelector';

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
}

interface AIQuizConfigFormProps {
  onSubmit: (config: QuizGenerationConfig) => void;
  isLoading?: boolean;
  elevenLabsApiKey?: string;
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
};

const AIQuizConfigForm: React.FC<AIQuizConfigFormProps> = ({
  onSubmit,
  isLoading = false,
  elevenLabsApiKey = '',
}) => {
  const [config, setConfig] = useState<QuizGenerationConfig>(defaultConfig);
  const [errors, setErrors] = useState<Partial<Record<keyof QuizGenerationConfig, string>>>({});

  const hasListeningType = config.questionTypes.includes('listening');

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof QuizGenerationConfig, string>> = {};

    if (!config.title.trim()) {
      newErrors.title = 'Quiz title is required';
    }

    if (!config.topic.trim()) {
      newErrors.topic = 'Topic is required';
    }

    if (config.numberOfQuestions < 5 || config.numberOfQuestions > 50) {
      newErrors.numberOfQuestions = 'Number of questions must be between 5 and 50';
    }

    if (config.questionTypes.length === 0) {
      newErrors.questionTypes = 'At least one question type must be selected';
    }

    if (hasListeningType) {
      if (config.audioWordLimit < 20 || config.audioWordLimit > 150) {
        newErrors.audioWordLimit = 'Audio word limit must be between 20 and 150';
      }
      if (!elevenLabsApiKey) {
        newErrors.selectedVoiceId = 'ElevenLabs API key required for listening questions';
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
              Topic / Theme *
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

          {/* Number of Questions */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Number of Questions
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="5"
                max="50"
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
