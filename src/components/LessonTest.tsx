import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface LessonTestProps {
  currentUser: User | null;
  company: Company | null;
  lessonId: string;
  onComplete?: (results: TestResults) => void;
  onBack?: () => void;
}

interface TestResults {
  totalScore: number;
  percentageScore: number;
  passed: boolean;
  skillBreakdown: {
    vocabulary: number;
    grammar: number;
    reading: number;
    listening: number;
    comprehension: number;
  };
}

interface Question {
  id: string;
  type: 'multiple_choice' | 'fill_in_blank' | 'true_false' | 'matching' | 'ordering' | 'listening';
  questionText: string;
  options?: string[];
  correctAnswer: any;
  explanation?: string;
  points: number;
  skill: 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'comprehension';
  audioUrl?: string;
  imageUrl?: string;
}

const LessonTest: React.FC<LessonTestProps> = ({
  currentUser,
  company,
  lessonId,
  onComplete,
  onBack,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch test
  const test = useQuery(
    api.lessons.getTestByVirtualLesson,
    { virtualLessonId: lessonId as Id<"virtualLessons"> }
  );

  // Fetch existing sessions
  const existingSessions = useQuery(
    api.lessons.getUserTestSessions,
    currentUser
      ? {
          userId: currentUser._id as Id<"users">,
          virtualLessonId: lessonId as Id<"virtualLessons">,
        }
      : 'skip'
  );

  const startSession = useMutation(api.lessons.startTestSession);
  const submitAnswer = useMutation(api.lessons.submitTestAnswer);
  const completeSession = useMutation(api.lessons.completeTestSession);

  // Shuffle questions on load
  useEffect(() => {
    if (test?.questions) {
      const questions = test.shuffleQuestions
        ? [...test.questions].sort(() => Math.random() - 0.5)
        : [...test.questions];
      setShuffledQuestions(questions);
    }
  }, [test]);

  // Initialize timer
  useEffect(() => {
    if (test?.timeLimit && sessionId) {
      setTimeLeft(test.timeLimit * 60);
    }
  }, [test, sessionId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startTest = async () => {
    if (!currentUser || !company || !test) return;

    try {
      const newSessionId = await startSession({
        testId: test._id,
        virtualLessonId: lessonId as Id<"virtualLessons">,
        userId: currentUser._id as Id<"users">,
        companyId: company._id as Id<"companies">,
      });
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Failed to start test:', error);
      alert(error instanceof Error ? error.message : 'Failed to start test');
    }
  };

  const handleAnswer = async (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));

    if (sessionId) {
      await submitAnswer({
        sessionId: sessionId as Id<"lessonTestSessions">,
        questionId,
        answer,
      });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      stopAudio();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      stopAudio();
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    audioRef.current = new Audio(url);
    audioRef.current.onended = () => setAudioPlaying(false);
    audioRef.current.play();
    setAudioPlaying(true);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioPlaying(false);
  };

  const handleSubmitTest = async () => {
    if (!sessionId || isSubmitting) return;

    setIsSubmitting(true);
    stopAudio();

    try {
      const results = await completeSession({
        sessionId: sessionId as Id<"lessonTestSessions">,
      });

      setTestResults(results);
      setShowResults(true);
      onComplete?.(results);
    } catch (error) {
      console.error('Failed to submit test:', error);
      alert('Failed to submit test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple_choice': return '🔘';
      case 'fill_in_blank': return '✏️';
      case 'true_false': return '✓✗';
      case 'listening': return '🎧';
      case 'matching': return '🔗';
      case 'ordering': return '📋';
      default: return '❓';
    }
  };

  if (!test) {
    return (
      <div className="flex items-center justify-center p-12 bg-gradient-to-br from-slate-100 to-slate-200 min-h-[600px]">
        <div className="animate-spin text-simmonds-primary text-4xl">⚙️</div>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const completedSessions = existingSessions?.filter((s) => s.status === 'completed') || [];
  const canRetake = test.allowRetake && completedSessions.length < test.maxAttempts;

  // Pre-test screen - PowerPoint style
  if (!sessionId && !showResults) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 min-h-[600px]">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl aspect-[16/9] flex flex-col overflow-hidden">
          {/* Slide Header */}
          <div className="bg-gradient-to-r from-simmonds-terracotta to-simmonds-primary px-8 py-6 shrink-0">
            <h1 className="text-2xl font-bold text-white">{test.title}</h1>
            {test.description && <p className="text-white/80 mt-1">{test.description}</p>}
          </div>

          {/* Slide Content */}
          <div className="flex-1 p-8 flex">
            {/* Left side - Test info */}
            <div className="flex-1 pr-8">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-simmonds-cream/50 to-white rounded-xl border border-simmonds-cream">
                  <p className="text-xs text-simmonds-stone uppercase tracking-wide">Questions</p>
                  <p className="text-3xl font-bold text-simmonds-charcoal">{test.totalQuestions}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-simmonds-cream/50 to-white rounded-xl border border-simmonds-cream">
                  <p className="text-xs text-simmonds-stone uppercase tracking-wide">Total Points</p>
                  <p className="text-3xl font-bold text-simmonds-charcoal">{test.totalPoints}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-simmonds-lime/10 to-white rounded-xl border border-simmonds-lime/30">
                  <p className="text-xs text-simmonds-stone uppercase tracking-wide">Pass Score</p>
                  <p className="text-3xl font-bold text-simmonds-lime">{test.passingScore}%</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-simmonds-cream/50 to-white rounded-xl border border-simmonds-cream">
                  <p className="text-xs text-simmonds-stone uppercase tracking-wide">Time Limit</p>
                  <p className="text-3xl font-bold text-simmonds-charcoal">
                    {test.timeLimit ? `${test.timeLimit}m` : '∞'}
                  </p>
                </div>
              </div>

              {/* Previous attempts */}
              {completedSessions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-simmonds-charcoal mb-2">Previous Attempts</p>
                  <div className="flex gap-2">
                    {completedSessions.map((session, index) => (
                      <div
                        key={session._id}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          session.passed
                            ? 'bg-simmonds-lime/20 text-simmonds-lime'
                            : 'bg-simmonds-terracotta/20 text-simmonds-terracotta'
                        }`}
                      >
                        #{index + 1}: {Math.round(session.percentageScore)}%
                      </div>
                    ))}
                  </div>
                  {!canRetake && (
                    <p className="text-xs text-simmonds-terracotta mt-2">
                      Maximum attempts ({test.maxAttempts}) reached
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right side - Rules */}
            <div className="w-72 pl-8 border-l border-simmonds-cream">
              <h3 className="font-semibold text-simmonds-charcoal mb-3 flex items-center gap-2">
                <span>📋</span> Test Rules
              </h3>
              <ul className="space-y-2 text-sm text-simmonds-stone">
                <li className="flex items-start gap-2">
                  <span className="text-simmonds-lime shrink-0">✓</span>
                  <span>Navigate between questions freely</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-simmonds-lime shrink-0">✓</span>
                  <span>Change answers before submitting</span>
                </li>
                {test.timeLimit && (
                  <li className="flex items-start gap-2">
                    <span className="text-simmonds-terracotta shrink-0">⏱️</span>
                    <span>Auto-submit when time runs out</span>
                  </li>
                )}
                {test.showCorrectAnswers && (
                  <li className="flex items-start gap-2">
                    <span className="text-simmonds-olive shrink-0">📝</span>
                    <span>Answers shown after completion</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Slide Footer */}
          <div className="bg-simmonds-cream/30 px-8 py-4 flex items-center justify-between shrink-0 border-t border-simmonds-cream/50">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-simmonds-charcoal hover:bg-white rounded-lg transition-colors text-sm"
              >
                ← Back to Lesson
              </button>
            )}
            <button
              onClick={startTest}
              disabled={!canRetake && completedSessions.length > 0}
              className="px-6 py-2.5 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90 disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              {completedSessions.length > 0 ? '🔄 Retake Test' : '▶ Start Test'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Results screen - PowerPoint style
  if (showResults && testResults) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 min-h-[600px]">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl aspect-[16/9] flex flex-col overflow-hidden">
          {/* Slide Header */}
          <div className={`px-8 py-6 shrink-0 ${
            testResults.passed
              ? 'bg-gradient-to-r from-simmonds-lime to-simmonds-olive'
              : 'bg-gradient-to-r from-simmonds-terracotta to-simmonds-primary'
          }`}>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{testResults.passed ? '🎉' : '📚'}</span>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {testResults.passed ? 'Congratulations!' : 'Keep Learning!'}
                </h1>
                <p className="text-white/80">
                  {testResults.passed
                    ? 'You passed the assessment!'
                    : "You didn't pass this time, but you can try again!"}
                </p>
              </div>
            </div>
          </div>

          {/* Slide Content */}
          <div className="flex-1 p-8 flex overflow-hidden">
            {/* Left - Score */}
            <div className="flex-1 pr-8 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#E3C6AB"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke={testResults.passed ? '#9F9D38' : '#B25627'}
                    strokeWidth="12"
                    strokeDasharray={`${(testResults.percentageScore / 100) * 440} 440`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-4xl font-bold text-simmonds-charcoal">
                      {Math.round(testResults.percentageScore)}
                    </span>
                    <span className="text-xl text-simmonds-stone">%</span>
                  </div>
                </div>
              </div>
              <p className="text-simmonds-stone mt-4">
                {testResults.totalScore} of {test.totalPoints} points
              </p>
            </div>

            {/* Right - Skill Breakdown */}
            <div className="w-80 pl-8 border-l border-simmonds-cream overflow-auto">
              <h3 className="font-semibold text-simmonds-charcoal mb-4">Performance by Skill</h3>
              <div className="space-y-3">
                {Object.entries(testResults.skillBreakdown).map(([skill, score]) => {
                  if (score === 0 && !test.questions.some((q) => q.skill === skill)) return null;
                  return (
                    <div key={skill}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="capitalize text-simmonds-charcoal">{skill}</span>
                        <span className={`font-medium ${
                          score >= 70 ? 'text-simmonds-lime' : score >= 50 ? 'text-simmonds-olive' : 'text-simmonds-terracotta'
                        }`}>{Math.round(score)}%</span>
                      </div>
                      <div className="h-2 bg-simmonds-cream rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            score >= 70 ? 'bg-simmonds-lime' : score >= 50 ? 'bg-simmonds-olive' : 'bg-simmonds-terracotta'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Slide Footer */}
          <div className="bg-simmonds-cream/30 px-8 py-4 flex items-center justify-between shrink-0 border-t border-simmonds-cream/50">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-simmonds-charcoal hover:bg-white rounded-lg transition-colors text-sm"
              >
                ← Back to Lesson
              </button>
            )}
            <div className="flex gap-3">
              {test.showCorrectAnswers && (
                <button
                  onClick={() => {/* Could implement review modal */}}
                  className="px-4 py-2 bg-white text-simmonds-charcoal rounded-lg hover:bg-simmonds-cream transition-colors text-sm shadow-sm"
                >
                  📋 Review Answers
                </button>
              )}
              {canRetake && !testResults.passed && (
                <button
                  onClick={() => {
                    setShowResults(false);
                    setSessionId(null);
                    setAnswers({});
                    setCurrentQuestionIndex(0);
                  }}
                  className="px-4 py-2 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90 shadow-sm"
                >
                  🔄 Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Test in progress - PowerPoint style
  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 min-h-[600px]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl aspect-[16/9] flex flex-col overflow-hidden">
        {/* Slide Header */}
        <div className="bg-gradient-to-r from-simmonds-primary to-simmonds-olive px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-white/60 text-sm">
              Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
            </span>
            {currentQuestion && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-white/20 text-white rounded text-xs capitalize">
                  {getQuestionTypeIcon(currentQuestion.type)} {currentQuestion.type.replace('_', ' ')}
                </span>
                <span className="px-2 py-1 bg-white/20 text-white rounded text-xs capitalize">
                  {currentQuestion.skill}
                </span>
                <span className="px-2 py-1 bg-simmonds-lime/80 text-white rounded text-xs font-medium">
                  {currentQuestion.points} pts
                </span>
              </div>
            )}
          </div>

          {timeLeft !== null && (
            <div className={`px-4 py-2 rounded-lg font-mono text-white ${
              timeLeft < 60 ? 'bg-simmonds-terracotta animate-pulse' : 'bg-white/20'
            }`}>
              ⏱️ {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/20">
          <div
            className="h-full bg-simmonds-lime transition-all"
            style={{ width: `${(answeredCount / shuffledQuestions.length) * 100}%` }}
          />
        </div>

        {/* Question Content */}
        {currentQuestion && (
          <div className="flex-1 p-8 flex flex-col overflow-hidden">
            {/* Audio Player for listening questions */}
            {currentQuestion.audioUrl && (
              <div className="mb-6 p-4 bg-gradient-to-r from-simmonds-olive/10 to-simmonds-lime/10 rounded-xl border border-simmonds-olive/20">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => audioPlaying ? stopAudio() : playAudio(currentQuestion.audioUrl!)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      audioPlaying
                        ? 'bg-simmonds-terracotta text-white'
                        : 'bg-simmonds-olive text-white hover:bg-simmonds-olive/80'
                    }`}
                  >
                    {audioPlaying ? (
                      <span className="text-2xl">■</span>
                    ) : (
                      <span className="text-2xl">▶</span>
                    )}
                  </button>
                  <div>
                    <p className="font-medium text-simmonds-charcoal">🎧 Listen to the audio</p>
                    <p className="text-sm text-simmonds-stone">
                      {audioPlaying ? 'Playing... Click to stop' : 'Click play to listen, then answer below'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Image for visual questions */}
            {currentQuestion.imageUrl && (
              <div className="mb-6 flex justify-center">
                <img
                  src={currentQuestion.imageUrl}
                  alt="Question visual"
                  className="max-h-32 rounded-xl shadow-sm"
                />
              </div>
            )}

            {/* Question Text */}
            <div className="mb-6">
              <p className="text-xl text-simmonds-charcoal leading-relaxed">
                {currentQuestion.questionText}
              </p>
            </div>

            {/* Answer Options */}
            <div className="flex-1 overflow-auto">
              {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                <div className="grid grid-cols-2 gap-4">
                  {currentQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswer(currentQuestion.id, option)}
                      className={`p-4 text-left rounded-xl border-2 transition-all flex items-center gap-3 ${
                        answers[currentQuestion.id] === option
                          ? 'border-simmonds-primary bg-simmonds-primary/5 shadow-md'
                          : 'border-simmonds-cream hover:border-simmonds-primary/50 hover:shadow-sm'
                      }`}
                    >
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        answers[currentQuestion.id] === option
                          ? 'bg-simmonds-primary text-white'
                          : 'bg-simmonds-cream text-simmonds-charcoal'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-simmonds-charcoal flex-1">{option}</span>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'true_false' && (
                <div className="flex gap-6 justify-center">
                  {['True', 'False'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(currentQuestion.id, option)}
                      className={`w-40 h-40 rounded-2xl border-3 font-bold text-2xl transition-all ${
                        answers[currentQuestion.id] === option
                          ? option === 'True'
                            ? 'border-simmonds-lime bg-simmonds-lime/10 text-simmonds-lime'
                            : 'border-simmonds-terracotta bg-simmonds-terracotta/10 text-simmonds-terracotta'
                          : 'border-simmonds-cream hover:border-simmonds-primary/50 text-simmonds-charcoal'
                      }`}
                    >
                      {option === 'True' ? '✓' : '✗'}<br />
                      <span className="text-lg">{option}</span>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'fill_in_blank' && (
                <div className="max-w-xl mx-auto">
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    className="w-full px-6 py-4 border-2 border-simmonds-cream rounded-xl focus:outline-none focus:border-simmonds-primary text-xl text-center"
                    placeholder="Type your answer..."
                    autoFocus
                  />
                </div>
              )}

              {currentQuestion.type === 'listening' && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswer(currentQuestion.id, option)}
                      className={`w-full p-4 text-left rounded-xl border-2 transition-all flex items-center gap-3 ${
                        answers[currentQuestion.id] === option
                          ? 'border-simmonds-primary bg-simmonds-primary/5 shadow-md'
                          : 'border-simmonds-cream hover:border-simmonds-primary/50'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                        answers[currentQuestion.id] === option
                          ? 'bg-simmonds-primary text-white'
                          : 'bg-simmonds-cream text-simmonds-charcoal'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-simmonds-charcoal">{option}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Slide Footer with Navigation */}
        <div className="bg-simmonds-cream/30 px-8 py-3 flex items-center justify-between shrink-0 border-t border-simmonds-cream/50">
          <button
            onClick={handlePrevQuestion}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 bg-white text-simmonds-charcoal rounded-lg disabled:opacity-30 hover:bg-simmonds-cream transition-colors flex items-center gap-2 text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Question dots */}
          <div className="flex items-center gap-1.5">
            {shuffledQuestions.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentQuestionIndex(index);
                  stopAudio();
                }}
                className={`w-3 h-3 rounded-full transition-all ${
                  currentQuestionIndex === index
                    ? 'bg-simmonds-primary w-6'
                    : answers[shuffledQuestions[index].id]
                    ? 'bg-simmonds-lime'
                    : 'bg-simmonds-cream hover:bg-simmonds-primary/30'
                }`}
              />
            ))}
          </div>

          {currentQuestionIndex < shuffledQuestions.length - 1 ? (
            <button
              onClick={handleNextQuestion}
              className="px-4 py-2 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90 transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmitTest}
              disabled={isSubmitting}
              className="px-4 py-2 bg-simmonds-lime text-white rounded-lg font-medium hover:bg-simmonds-lime/90 transition-colors flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Test ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonTest;
