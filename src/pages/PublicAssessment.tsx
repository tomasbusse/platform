import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface AssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  level: string;
  skill: string;
  type?: string;
  // Multimedia support
  imageUrl?: string;
  imageAlt?: string;
  audioUrl?: string;
  audioTranscript?: string;
  videoUrl?: string;
  videoTranscript?: string;
  readingPassage?: string;
  // Additional question types
  sentenceWithGap?: string;
  sentenceWithError?: string;
  wordToTransform?: string;
  explanation?: string;
  points?: number;
}

interface SkillScores {
  grammar: number;
  vocabulary: number;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
}

type AssessmentStep = 'loading' | 'welcome' | 'test' | 'submitting' | 'results' | 'error' | 'expired';

interface PublicAssessmentProps {
  token: string;
}

// Audio Player Component for listening questions
const AudioPlayer: React.FC<{ audioUrl: string; onEnded?: () => void }> = ({ audioUrl, onEnded }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
        if (!isPlaying) setPlayCount(prev => prev + 1);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (onEnded) onEnded();
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-simmonds-cream-light rounded-xl p-4 mb-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="w-12 h-12 bg-simmonds-primary rounded-full flex items-center justify-center text-white hover:bg-simmonds-primary-dark transition-colors"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-simmonds-primary transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-simmonds-stone mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="text-sm text-simmonds-stone">
          Played: {playCount}x
        </div>
      </div>
      <p className="text-xs text-simmonds-stone mt-2 text-center">
        Listen carefully. You can replay the audio if needed.
      </p>
    </div>
  );
};

// Video Player Component for video dialogue questions
const VideoPlayer: React.FC<{ videoUrl: string }> = ({ videoUrl }) => {
  return (
    <div className="rounded-xl overflow-hidden mb-4 bg-black">
      <video
        src={videoUrl}
        controls
        className="w-full max-h-64 object-contain"
        controlsList="nodownload"
      >
        Your browser does not support the video tag.
      </video>
      <p className="text-xs text-simmonds-stone mt-2 text-center">
        Watch the video and answer the question below.
      </p>
    </div>
  );
};

// Image Display Component
const ImageDisplay: React.FC<{ imageUrl: string; imageAlt?: string }> = ({ imageUrl, imageAlt }) => {
  return (
    <div className="rounded-xl overflow-hidden mb-4 border border-simmonds-cream">
      <img
        src={imageUrl}
        alt={imageAlt || "Question image"}
        className="w-full max-h-64 object-contain bg-white"
        loading="lazy"
      />
    </div>
  );
};

// Reading Passage Component
const ReadingPassage: React.FC<{ passage: string }> = ({ passage }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-simmonds-cream-light rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-simmonds-charcoal flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Reading Passage
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-simmonds-primary hover:underline"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {isExpanded && (
        <div className="prose prose-sm max-w-none text-simmonds-charcoal leading-relaxed">
          {passage.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-2">{paragraph}</p>
          ))}
        </div>
      )}
    </div>
  );
};

const PublicAssessment: React.FC<PublicAssessmentProps> = ({ token }) => {
  const [step, setStep] = useState<AssessmentStep>('loading');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{
    score: number;
    level: string;
    skillScores: SkillScores;
    groupName?: string;
    groupDetails?: {
      name: string;
      level: string;
      scheduleInfo?: string;
      teacherName?: string;
      teacherEmail?: string;
    } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Query invitation data
  const invitation = useQuery(api.assessmentInvitations.getInvitationByToken, { token });

  // Mutations
  const startAssessment = useMutation(api.assessmentInvitations.startAssessment);
  const submitAssessment = useMutation(api.assessmentInvitations.submitAssessment);

  // Handle invitation status
  useEffect(() => {
    if (invitation === undefined) {
      setStep('loading');
      return;
    }

    if (invitation === null) {
      setError('Invalid assessment link. Please contact your administrator.');
      setStep('error');
      return;
    }

    if (invitation.status === 'expired' || (invitation.expiresAt && invitation.expiresAt < Date.now())) {
      setStep('expired');
      return;
    }

    if (invitation.status === 'completed') {
      // Already completed - show results
      setResults({
        score: invitation.score || 0,
        level: invitation.recommendedLevel || 'A1',
        skillScores: {
          grammar: 0,
          vocabulary: 0,
          reading: 0,
          listening: 0,
          writing: 0,
          speaking: 0,
        },
        groupName: undefined,
      });
      setStep('results');
      return;
    }

    if (invitation.status === 'started') {
      // Resume the test
      handleStartTest();
      return;
    }

    // Status is 'pending' - show welcome
    setStep('welcome');
  }, [invitation]);

  // Timer effect
  useEffect(() => {
    if (step !== 'test' || timeRemaining === null) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeRemaining]);

  const handleStartTest = async () => {
    try {
      setStep('loading');
      const result = await startAssessment({ token });

      if (result.questions) {
        setQuestions(result.questions);
        setTimeRemaining(45 * 60); // 45 minutes
        setStep('test');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assessment');
      setStep('error');
    }
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setStep('submitting');

      // Convert answers to the format expected by the API
      const formattedAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption,
      }));

      const result = await submitAssessment({
        token,
        answers: formattedAnswers,
      });

      setResults({
        score: result.score,
        level: result.recommendedLevel,
        skillScores: result.skillScores,
        groupName: result.assignedGroup,
        groupDetails: result.assignedGroupDetails,
      });
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit assessment');
      setStep('error');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressColor = (score: number): string => {
    if (score >= 80) return 'bg-simmonds-lime';
    if (score >= 60) return 'bg-simmonds-olive';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-simmonds-terracotta';
  };

  const getLevelDescription = (level: string): string => {
    const descriptions: Record<string, string> = {
      'A1': 'Beginner - You can understand and use familiar everyday expressions and very basic phrases.',
      'A2': 'Elementary - You can communicate in simple and routine tasks requiring a direct exchange of information.',
      'B1': 'Intermediate - You can deal with most situations likely to arise while travelling.',
      'B2': 'Upper Intermediate - You can interact with a degree of fluency that makes regular interaction possible.',
      'C1': 'Advanced - You can express yourself fluently and spontaneously without much obvious searching for expressions.',
      'C2': 'Proficiency - You can understand with ease virtually everything heard or read.',
    };
    return descriptions[level] || '';
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-simmonds-primary border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg text-simmonds-charcoal">Loading your assessment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-simmonds-charcoal mb-4">Oops! Something went wrong</h1>
          <p className="text-simmonds-stone mb-6">{error}</p>
          <a
            href="mailto:support@simmonds.online"
            className="inline-block px-6 py-3 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-dark transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  // Expired state
  if (step === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-simmonds-charcoal mb-4">Assessment Link Expired</h1>
          <p className="text-simmonds-stone mb-6">
            This assessment link has expired. Please contact your administrator to request a new one.
          </p>
          <a
            href="mailto:support@simmonds.online"
            className="inline-block px-6 py-3 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-dark transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  // Welcome screen
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-simmonds-primary px-8 py-6">
            <h1 className="text-2xl font-bold text-white">Simmonds Language Services</h1>
            <p className="text-simmonds-lime mt-1">English Proficiency Assessment</p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="mb-6">
              <p className="text-lg text-simmonds-charcoal mb-2">
                Welcome, <span className="font-semibold">{invitation?.name}</span>!
              </p>
              <p className="text-simmonds-stone">
                You have been invited to complete an English proficiency assessment. This will help us place you in the right learning group.
              </p>
            </div>

            {/* Test Info */}
            <div className="bg-simmonds-cream-light rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-simmonds-charcoal mb-4">Assessment Details</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-simmonds-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-simmonds-charcoal">20 questions covering grammar, vocabulary, and reading</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-simmonds-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-simmonds-charcoal">Time limit: 45 minutes</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-simmonds-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-simmonds-charcoal">CEFR levels A1 to C2</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-simmonds-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-simmonds-charcoal">Instant results and group assignment</span>
                </li>
              </ul>
            </div>

            {/* Instructions */}
            <div className="mb-8">
              <h3 className="font-semibold text-simmonds-charcoal mb-2">Instructions</h3>
              <ul className="text-simmonds-stone text-sm space-y-1">
                <li>Choose the best answer for each question</li>
                <li>You can navigate between questions before submitting</li>
                <li>Your progress is automatically saved</li>
                <li>Submit when you&apos;re ready or when time expires</li>
              </ul>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartTest}
              className="w-full py-4 bg-simmonds-primary text-white rounded-xl font-semibold text-lg hover:bg-simmonds-primary-dark transition-colors shadow-lg hover:shadow-xl"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Test in progress
  if (step === 'test' && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;
    const progress = (answeredCount / questions.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-simmonds-charcoal">English Assessment</h1>
                <p className="text-sm text-simmonds-stone">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              {timeRemaining !== null && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-simmonds-cream text-simmonds-charcoal'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-2 bg-simmonds-cream rounded-full overflow-hidden">
                <div
                  className="h-full bg-simmonds-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-simmonds-stone mt-1">
                {answeredCount} of {questions.length} questions answered
              </p>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Level badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-full text-sm font-medium">
                Level: {currentQuestion.level}
              </span>
              <span className="px-3 py-1 bg-simmonds-olive/10 text-simmonds-olive rounded-full text-sm font-medium capitalize">
                {currentQuestion.skill}
              </span>
              {currentQuestion.type && (
                <span className="px-3 py-1 bg-simmonds-cream text-simmonds-stone rounded-full text-sm font-medium capitalize">
                  {currentQuestion.type.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {/* Multimedia Content - Show before question */}
            {currentQuestion.imageUrl && (
              <ImageDisplay imageUrl={currentQuestion.imageUrl} imageAlt={currentQuestion.imageAlt} />
            )}

            {currentQuestion.audioUrl && (
              <AudioPlayer audioUrl={currentQuestion.audioUrl} />
            )}

            {currentQuestion.videoUrl && (
              <VideoPlayer videoUrl={currentQuestion.videoUrl} />
            )}

            {currentQuestion.readingPassage && (
              <ReadingPassage passage={currentQuestion.readingPassage} />
            )}

            {/* Word Formation - Show the word to transform */}
            {currentQuestion.wordToTransform && (
              <div className="bg-simmonds-primary/10 rounded-xl p-4 mb-4 text-center">
                <p className="text-sm text-simmonds-stone mb-1">Use this word:</p>
                <p className="text-2xl font-bold text-simmonds-primary">{currentQuestion.wordToTransform}</p>
              </div>
            )}

            {/* Sentence with Gap - For completion exercises */}
            {currentQuestion.sentenceWithGap && (
              <div className="bg-simmonds-cream-light rounded-xl p-4 mb-4">
                <p className="text-lg text-simmonds-charcoal leading-relaxed">
                  {currentQuestion.sentenceWithGap.split('_____').map((part, index, array) => (
                    <React.Fragment key={index}>
                      {part}
                      {index < array.length - 1 && (
                        <span className="inline-block mx-1 px-4 py-1 bg-white border-2 border-simmonds-primary border-dashed rounded text-simmonds-primary">
                          ?
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
              </div>
            )}

            {/* Error Correction - Show sentence with error */}
            {currentQuestion.sentenceWithError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-600 mb-2 font-medium">Find and correct the error:</p>
                <p className="text-lg text-simmonds-charcoal italic">
                  &ldquo;{currentQuestion.sentenceWithError}&rdquo;
                </p>
              </div>
            )}

            {/* Question */}
            <h2 className="text-xl font-semibold text-simmonds-charcoal mb-6">
              {currentQuestion.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(currentQuestion.id, index)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    answers[currentQuestion.id] === index
                      ? 'border-simmonds-primary bg-simmonds-primary/10'
                      : 'border-simmonds-cream hover:border-simmonds-primary/50 hover:bg-simmonds-cream-light'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQuestion.id] === index
                        ? 'border-simmonds-primary bg-simmonds-primary'
                        : 'border-simmonds-stone'
                    }`}>
                      {answers[currentQuestion.id] === index && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-simmonds-charcoal">{option}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-simmonds-cream">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-4 py-2 text-simmonds-charcoal hover:text-simmonds-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center gap-2">
                {/* Question dots */}
                <div className="hidden md:flex items-center gap-1">
                  {questions.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentQuestionIndex
                          ? 'bg-simmonds-primary scale-125'
                          : answers[questions[index].id] !== undefined
                          ? 'bg-simmonds-lime'
                          : 'bg-simmonds-cream'
                      }`}
                      title={`Question ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={answeredCount < questions.length}
                  className="flex items-center gap-2 px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Assessment
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2 text-simmonds-charcoal hover:text-simmonds-primary"
                >
                  Next
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Quick submit button when all answered */}
          {answeredCount === questions.length && currentQuestionIndex !== questions.length - 1 && (
            <div className="mt-6 text-center">
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-simmonds-lime text-simmonds-charcoal rounded-xl font-semibold hover:bg-simmonds-lime-dark transition-colors"
              >
                All questions answered - Submit now
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Submitting state
  if (step === 'submitting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-simmonds-primary border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg text-simmonds-charcoal">Calculating your results...</p>
          <p className="text-sm text-simmonds-stone mt-2">This will only take a moment</p>
        </div>
      </div>
    );
  }

  // Results screen
  if (step === 'results' && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-simmonds-lime rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="w-10 h-10 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Assessment Complete!</h1>
            <p className="text-simmonds-stone">Here are your results</p>
          </div>

          {/* Main Results Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
            <div className="bg-simmonds-primary px-8 py-6 text-center">
              <p className="text-simmonds-lime text-sm uppercase tracking-wider mb-2">Your English Level</p>
              <h2 className="text-5xl font-bold text-white mb-2">{results.level}</h2>
              <p className="text-white/80">{getLevelDescription(results.level)}</p>
            </div>

            <div className="p-8">
              {/* Score */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-simmonds-stone">Overall Score</span>
                  <span className="text-2xl font-bold text-simmonds-charcoal">{results.score}%</span>
                </div>
                <div className="h-4 bg-simmonds-cream rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(results.score)} transition-all duration-1000`}
                    style={{ width: `${results.score}%` }}
                  />
                </div>
              </div>

              {/* Skill Breakdown */}
              {results.skillScores && (
                <div className="mb-8">
                  <h3 className="font-semibold text-simmonds-charcoal mb-4">Skill Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(results.skillScores).map(([skill, score]) => (
                      <div key={skill} className="bg-simmonds-cream-light rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-simmonds-stone capitalize">{skill}</span>
                          <span className="font-semibold text-simmonds-charcoal">{score}%</span>
                        </div>
                        <div className="h-2 bg-white rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Group Assignment */}
              {results.groupName && (
                <div className="bg-simmonds-primary/10 rounded-xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-simmonds-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-simmonds-charcoal mb-1">Your Class Assignment</h3>
                      <p className="text-simmonds-stone mb-3">
                        Based on your results, you have been assigned to:
                      </p>
                      <p className="text-xl font-bold text-simmonds-primary mb-4">{results.groupName}</p>

                      {/* Group Details */}
                      {results.groupDetails && (
                        <div className="space-y-2 border-t border-simmonds-primary/20 pt-4">
                          {/* Teacher */}
                          {results.groupDetails.teacherName && (
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="text-simmonds-stone">Teacher:</span>
                              <span className="font-medium text-simmonds-charcoal">{results.groupDetails.teacherName}</span>
                            </div>
                          )}

                          {/* Level */}
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-simmonds-stone">CEFR Level:</span>
                            <span className="font-medium text-simmonds-charcoal">{results.groupDetails.level}</span>
                          </div>

                          {/* Schedule */}
                          {results.groupDetails.scheduleInfo && (
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-simmonds-stone">Schedule:</span>
                              <span className="font-medium text-simmonds-charcoal">{results.groupDetails.scheduleInfo}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="border-t border-simmonds-cream pt-6">
                <h3 className="font-semibold text-simmonds-charcoal mb-4">What&apos;s Next?</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-simmonds-lime rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-simmonds-primary">1</span>
                    </div>
                    <span className="text-simmonds-charcoal">Check your email for login credentials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-simmonds-lime rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-simmonds-primary">2</span>
                    </div>
                    <span className="text-simmonds-charcoal">Log in to access your learning dashboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-simmonds-lime rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-simmonds-primary">3</span>
                    </div>
                    <span className="text-simmonds-charcoal">Start your personalized learning journey</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-simmonds-stone text-sm">
            <p>Powered by Simmonds Language Services</p>
            <p className="mt-1">Questions? Contact us at support@simmonds.online</p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-simmonds-primary border-t-transparent"></div>
    </div>
  );
};

export default PublicAssessment;
