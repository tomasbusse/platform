import React, { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import AIQuizConfigForm, { QuizGenerationConfig } from './AIQuizConfigForm';
import QuizReviewPanel from './QuizReviewPanel';
import { GeneratedQuestion } from './QuestionEditor';
import { User, Company } from '../../types';

type Step = 'config' | 'generating' | 'audio' | 'review' | 'saving' | 'done';

interface AIQuizGeneratorProps {
  currentUser: User | null;
  company: Company | null;
  onQuizCreated?: (quizId: string) => void;
  onCancel?: () => void;
}

const AIQuizGenerator: React.FC<AIQuizGeneratorProps> = ({
  currentUser,
  company,
  onQuizCreated,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>('config');
  const [config, setConfig] = useState<QuizGenerationConfig | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [savedQuizId, setSavedQuizId] = useState<string | null>(null);

  // Convex actions and mutations
  const generateQuestions = useAction(api.ai.generateQuizQuestions.generateQuestionsWithClaude);
  const regenerateQuestion = useAction(api.ai.generateQuizQuestions.regenerateSingleQuestion);
  const generateAudio = useAction(api.ai.generateQuizAudio.generateAudioFromScript);
  const createQuiz = useMutation(api.quizzes.createQuiz);
  const addQuestionToBank = useMutation(api.quizzes.addQuestionToBank);
  const addQuestionsToQuiz = useMutation(api.quizzes.addQuestionsToQuiz);
  const updateCompanyApiSettings = useMutation(api.companies.updateCompanyApiSettings);

  // Get API keys from company settings
  const companySettings = company?.settings as {
    openRouterApiKey?: string;
    elevenLabsApiKey?: string;
  } | undefined;

  const openRouterApiKey = companySettings?.openRouterApiKey || '';
  const elevenLabsApiKey = companySettings?.elevenLabsApiKey || '';

  // Debug: Log company and settings to console
  console.log('AIQuizGenerator - company:', company);
  console.log('AIQuizGenerator - company.settings:', company?.settings);
  console.log('AIQuizGenerator - openRouterApiKey present:', !!openRouterApiKey);

  // STEP 1: User submits config form
  const handleConfigSubmit = async (formData: QuizGenerationConfig) => {
    setConfig(formData);
    setError(null);

    // Use API key from form if provided, otherwise from company settings
    const apiKeyToUse = formData.openRouterApiKey || openRouterApiKey;
    const elevenLabsKeyToUse = formData.elevenLabsApiKeyOverride || elevenLabsApiKey;

    // Check for API key before proceeding
    if (!apiKeyToUse) {
      setError('OpenRouter API key is required. Please enter your API key in the form below, or configure it in Company Settings.');
      return;
    }

    setStep('generating');

    try {
      // STEP 2: Generate questions with Claude
      console.log('Generating questions with Claude...');

      const result = await generateQuestions({
        apiKey: apiKeyToUse,
        language: formData.language,
        targetLevel: formData.targetLevel,
        topic: formData.topic,
        numberOfQuestions: formData.numberOfQuestions,
        questionTypes: formData.questionTypes,
        audioWordLimit: formData.audioWordLimit,
        documentContent: formData.documentContent,
        modelId: formData.selectedModelId, // Pass selected model ID
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate questions');
      }

      let generatedQuestions = result.questions as GeneratedQuestion[];

      // STEP 3: Generate audio for listening questions
      const listeningQuestions = generatedQuestions.filter(
        (q) => q.type === 'listening' && q.audioScript
      );

      console.log('Listening questions found:', listeningQuestions.length);
      console.log('ElevenLabs key present:', !!elevenLabsKeyToUse, 'length:', elevenLabsKeyToUse?.length || 0);

      if (listeningQuestions.length > 0 && elevenLabsKeyToUse) {
        setStep('audio');
        setAudioProgress({ current: 0, total: listeningQuestions.length });

        for (let i = 0; i < generatedQuestions.length; i++) {
          const q = generatedQuestions[i];

          if (q.type === 'listening' && q.audioScript) {
            console.log(`Generating audio ${i + 1}...`, {
              scriptLength: q.audioScript.length,
              voiceId: formData.selectedVoiceId,
            });

            const audioResult = await generateAudio({
              apiKey: elevenLabsKeyToUse,
              script: q.audioScript,
              voiceId: formData.selectedVoiceId,
            });

            console.log(`Audio result for question ${i + 1}:`, {
              success: audioResult.success,
              hasUrl: !!audioResult.audioUrl,
              error: audioResult.error || null,
            });

            if (audioResult.success && audioResult.audioUrl) {
              // Add audio URL to question
              generatedQuestions[i] = {
                ...q,
                audioUrl: audioResult.audioUrl,
                audioStorageId: audioResult.storageId || undefined,
              };
            } else if (!audioResult.success) {
              console.error(`Audio generation failed for question ${i + 1}:`, audioResult.error);
            }

            setAudioProgress((prev) => ({ ...prev, current: prev.current + 1 }));
          }
        }
      }

      // STEP 4: Show review
      setQuestions(generatedQuestions);
      setStep('review');
    } catch (err) {
      console.error('Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('config');
    }
  };

  // Regenerate a single question
  const handleRegenerateQuestion = async (index: number): Promise<GeneratedQuestion | null> => {
    if (!config) return null;

    const currentQuestion = questions[index];

    try {
      const result = await regenerateQuestion({
        apiKey: openRouterApiKey,
        language: config.language,
        targetLevel: config.targetLevel,
        topic: config.topic,
        questionType: currentQuestion.type,
        audioWordLimit: config.audioWordLimit,
        modelId: config.selectedModelId, // Pass selected model ID
      });

      if (!result.success || !result.question) {
        throw new Error(result.error || 'Failed to regenerate question');
      }

      let newQuestion = result.question as GeneratedQuestion;

      // If it's a listening question and we have audio settings, generate audio
      if (newQuestion.type === 'listening' && newQuestion.audioScript && elevenLabsApiKey) {
        const audioResult = await generateAudio({
          apiKey: elevenLabsApiKey,
          script: newQuestion.audioScript,
          voiceId: config.selectedVoiceId,
        });

        if (audioResult.success && audioResult.audioUrl) {
          newQuestion = {
            ...newQuestion,
            audioUrl: audioResult.audioUrl,
            audioStorageId: audioResult.storageId || undefined,
          };
        }
      }

      return newQuestion;
    } catch (err) {
      console.error('Regeneration failed:', err);
      return null;
    }
  };

  // Regenerate audio for a question
  const handleRegenerateAudio = async (
    script: string
  ): Promise<{ audioUrl: string; storageId: string } | null> => {
    if (!config || !elevenLabsApiKey) return null;

    try {
      const audioResult = await generateAudio({
        apiKey: elevenLabsApiKey,
        script,
        voiceId: config.selectedVoiceId,
      });

      if (audioResult.success && audioResult.audioUrl && audioResult.storageId) {
        return {
          audioUrl: audioResult.audioUrl,
          storageId: audioResult.storageId,
        };
      }
      return null;
    } catch (err) {
      console.error('Audio regeneration failed:', err);
      return null;
    }
  };

  // STEP 5: User saves the quiz
  const handleSave = async (editedQuestions: GeneratedQuestion[]) => {
    if (!currentUser || !company || !config) {
      setError('Missing user or company information');
      return;
    }

    setStep('saving');

    try {
      // First create the quiz
      const quizId = await createQuiz({
        companyId: company._id as Id<'companies'>,
        createdBy: currentUser._id as Id<'users'>,
        title: config.title,
        description: `AI-generated quiz about ${config.topic}`,
        instructions: `This quiz tests your ${config.language} skills at ${config.targetLevel} level on the topic of "${config.topic}".`,
        level: config.targetLevel,
        testPurpose: 'practice',
        skillFocus: 'mixed',
        duration: config.timeLimitMinutes || 30,
        passingScore: 60,
        settings: {
          shuffleQuestions: true,
          shuffleOptions: true,
          showCorrectAnswers: true,
          showExplanations: true,
          allowRetake: true,
          maxAttempts: 3,
          requirePassingScore: false,
          showTimer: true,
          showProgressBar: true,
          allowSkip: true,
          allowReview: true,
          autoSubmitOnTimeout: true,
        },
        tags: ['ai-generated', config.topic, config.targetLevel],
        isCambridgeAligned: false,
      });

      // Add questions to the question bank and collect their IDs
      const questionIds: Id<'questionBank'>[] = [];

      for (const question of editedQuestions) {
        const questionData = convertToQuestionBankFormat(question);

        const questionId = await addQuestionToBank({
          companyId: company._id as Id<'companies'>,
          createdBy: currentUser._id as Id<'users'>,
          questionType: mapQuestionType(question.type),
          skill: determineSkill(question.type),
          level: config.targetLevel,
          difficulty: 'medium',
          questionText: getQuestionText(question),
          questionData: questionData,
          points: 1,
          tags: ['ai-generated', config.topic],
          isCambridgeAligned: false,
        });

        questionIds.push(questionId);
      }

      // Link questions to the quiz
      if (questionIds.length > 0) {
        await addQuestionsToQuiz({
          quizId: quizId as Id<'quizzes'>,
          questionIds: questionIds,
        });
      }

      setSavedQuizId(quizId);
      setStep('done');
      onQuizCreated?.(quizId);
    } catch (err) {
      console.error('Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save quiz');
      setStep('review');
    }
  };

  const getStepStatus = (
    currentStep: Step,
    checkStep: string
  ): 'complete' | 'current' | 'upcoming' => {
    const order = ['config', 'generating', 'audio', 'review', 'done'];
    const currentIndex = order.indexOf(currentStep);
    const checkIndex = order.indexOf(checkStep);

    if (checkIndex < currentIndex) return 'complete';
    if (checkIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const handleReset = () => {
    setStep('config');
    setConfig(null);
    setQuestions([]);
    setError(null);
    setSavedQuizId(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm">
          {[
            { key: 'config', label: 'Configure' },
            { key: 'generating', label: 'Generate' },
            { key: 'audio', label: 'Audio' },
            { key: 'review', label: 'Review' },
            { key: 'done', label: 'Done' },
          ].map((s, i, arr) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors
                  ${getStepStatus(step, s.key) === 'complete' ? 'bg-simmonds-lime text-white' : ''}
                  ${getStepStatus(step, s.key) === 'current' ? 'bg-simmonds-primary text-white' : ''}
                  ${getStepStatus(step, s.key) === 'upcoming' ? 'bg-simmonds-cream text-simmonds-stone' : ''}
                `}
              >
                {getStepStatus(step, s.key) === 'complete' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className="hidden sm:inline ml-2 text-simmonds-charcoal">{s.label}</span>
              {i < arr.length - 1 && (
                <div className="w-8 sm:w-16 h-0.5 mx-2 bg-simmonds-cream">
                  {getStepStatus(step, s.key) === 'complete' && (
                    <div className="h-full bg-simmonds-lime" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-simmonds-terracotta/10 border border-simmonds-terracotta/30 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-simmonds-terracotta mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-medium text-simmonds-terracotta">Generation Failed</p>
            <p className="text-simmonds-terracotta/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === 'config' && (
        <div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="mb-4 text-sm text-simmonds-stone hover:text-simmonds-charcoal flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Manual Creation
            </button>
          )}
          <AIQuizConfigForm
            onSubmit={handleConfigSubmit}
            isLoading={step === 'generating'}
            elevenLabsApiKey={elevenLabsApiKey}
            openRouterApiKey={openRouterApiKey}
            onSaveApiKeys={company ? async (openRouterKey, elevenLabsKey) => {
              await updateCompanyApiSettings({
                companyId: company._id as Id<'companies'>,
                openRouterApiKey: openRouterKey || undefined,
                elevenLabsApiKey: elevenLabsKey || undefined,
              });
            } : undefined}
          />
        </div>
      )}

      {step === 'generating' && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-simmonds-primary/10 rounded-full mb-4">
            <svg className="w-8 h-8 text-simmonds-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-simmonds-charcoal mb-2">
            Generating Questions
          </h3>
          <p className="text-simmonds-stone">
            Claude AI is creating your quiz questions...
          </p>
        </div>
      )}

      {step === 'audio' && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-simmonds-olive/10 rounded-full mb-4">
            <svg className="w-8 h-8 text-simmonds-olive animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-simmonds-charcoal mb-2">
            Creating Audio
          </h3>
          <p className="text-simmonds-stone mb-6">
            ElevenLabs is generating listening audio...
          </p>

          {/* Audio Progress */}
          <div className="max-w-xs mx-auto">
            <div className="h-2 bg-simmonds-cream rounded-full overflow-hidden">
              <div
                className="h-full bg-simmonds-olive rounded-full transition-all duration-300"
                style={{
                  width: `${audioProgress.total > 0 ? (audioProgress.current / audioProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-sm text-simmonds-stone mt-2">
              {audioProgress.current} of {audioProgress.total} audio files
            </p>
          </div>
        </div>
      )}

      {step === 'review' && config && (
        <QuizReviewPanel
          questions={questions}
          config={config}
          onSave={handleSave}
          onBack={() => setStep('config')}
          onRegenerateQuestion={handleRegenerateQuestion}
          onRegenerateAudio={elevenLabsApiKey ? handleRegenerateAudio : undefined}
        />
      )}

      {step === 'saving' && (
        <div className="text-center py-20">
          <svg className="w-8 h-8 text-simmonds-primary animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-simmonds-stone">Saving your quiz...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-simmonds-lime/10 rounded-full mb-4">
            <svg className="w-8 h-8 text-simmonds-lime" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-simmonds-charcoal mb-2">
            Quiz Created Successfully!
          </h3>
          <p className="text-simmonds-stone mb-6">
            Your AI-generated quiz is ready to use.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-simmonds-cream text-simmonds-charcoal rounded-lg hover:bg-simmonds-stone/20"
            >
              Create Another
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary-light"
              >
                Back to Quizzes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
function getQuestionText(q: GeneratedQuestion): string {
  return (
    q.question ||
    q.statement ||
    q.instruction ||
    q.sentence ||
    q.prompt ||
    q.audioScript?.substring(0, 100) ||
    'Question'
  );
}

function mapQuestionType(
  type: string
): 'multiple_choice' | 'multiple_select' | 'fill_in_blank' | 'true_false' | 'matching' | 'ordering' | 'short_answer' | 'listening' | 'speaking_response' | 'image_description' | 'video_comprehension' | 'cloze_test' {
  const mapping: Record<string, string> = {
    'multiple-choice': 'multiple_choice',
    'multiple-select': 'multiple_select',
    'fill-blank': 'fill_in_blank',
    'true-false': 'true_false',
    'matching': 'matching',
    'ordering': 'ordering',
    'short-answer': 'short_answer',
    'listening': 'listening',
    'speaking': 'speaking_response',
    'image-based': 'image_description',
    'video-based': 'video_comprehension',
    'cloze': 'cloze_test',
  };
  return (mapping[type] || 'multiple_choice') as ReturnType<typeof mapQuestionType>;
}

function determineSkill(
  type: string
): 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing' | 'speaking' {
  const skillMapping: Record<string, string> = {
    'multiple-choice': 'grammar',
    'multiple-select': 'grammar',
    'fill-blank': 'grammar',
    'true-false': 'grammar',
    'matching': 'vocabulary',
    'ordering': 'grammar',
    'short-answer': 'writing',
    'listening': 'listening',
    'speaking': 'speaking',
    'image-based': 'vocabulary',
    'video-based': 'listening',
    'cloze': 'reading',
  };
  return (skillMapping[type] || 'grammar') as ReturnType<typeof determineSkill>;
}

function convertToQuestionBankFormat(q: GeneratedQuestion): {
  options?: string[];
  correctAnswer: unknown;
  explanation?: string;
  audioUrl?: string;
  readingPassage?: string;
} {
  return {
    options: q.options,
    correctAnswer: q.correctAnswer ?? q.correctAnswers,
    explanation: q.explanation,
    audioUrl: q.audioUrl,
    readingPassage: q.passage,
  };
}

export default AIQuizGenerator;
