import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface VirtualLessonViewerProps {
  currentUser: User | null;
  company: Company | null;
  lessonId: string;
  onComplete?: () => void;
  onStartTest?: () => void;
}

interface VocabularyCard {
  word: string;
  definition: string;
  example: string;
  pronunciation?: string;
  partOfSpeech?: string;
  isFlipped: boolean;
  isMastered: boolean;
}

const VirtualLessonViewer: React.FC<VirtualLessonViewerProps> = ({
  currentUser,
  company,
  lessonId,
  onComplete,
  onStartTest,
}) => {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [vocabularyCards, setVocabularyCards] = useState<VocabularyCard[]>([]);
  const [currentVocabIndex, setCurrentVocabIndex] = useState(0);
  const [showVocabMode, setShowVocabMode] = useState(false);
  const [grammarExerciseAnswers, setGrammarExerciseAnswers] = useState<Record<string, string>>({});
  const [showGrammarResults, setShowGrammarResults] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch lesson
  const lesson = useQuery(
    api.lessons.getVirtualLesson,
    { lessonId: lessonId as Id<"virtualLessons"> }
  );

  // Fetch progress
  const progress = useQuery(
    api.lessons.getLessonProgressForUser,
    currentUser && lessonId
      ? {
          userId: currentUser._id as Id<"users">,
          virtualLessonId: lessonId as Id<"virtualLessons">,
        }
      : 'skip'
  );

  // Fetch test
  const test = useQuery(
    api.lessons.getTestByVirtualLesson,
    lessonId ? { virtualLessonId: lessonId as Id<"virtualLessons"> } : 'skip'
  );

  const startProgress = useMutation(api.lessons.startLessonProgress);
  const updateProgress = useMutation(api.lessons.updateLessonProgress);
  const completeProgress = useMutation(api.lessons.completeLessonProgress);

  // Initialize vocabulary cards
  useEffect(() => {
    if (lesson?.vocabulary) {
      setVocabularyCards(
        lesson.vocabulary.map((v) => ({
          ...v,
          isFlipped: false,
          isMastered: progress?.masteredVocabulary?.includes(v.word) || false,
        }))
      );
    }
  }, [lesson, progress]);

  // Start or resume progress
  useEffect(() => {
    const initProgress = async () => {
      if (currentUser && company && lessonId && !progress) {
        await startProgress({
          userId: currentUser._id as Id<"users">,
          virtualLessonId: lessonId as Id<"virtualLessons">,
          companyId: company._id as Id<"companies">,
        });
      }
    };
    initProgress();
  }, [currentUser, company, lessonId, progress]);

  // Track time spent
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Save time periodically
  useEffect(() => {
    const saveTime = async () => {
      if (progress?._id && timeSpent > 0 && timeSpent % 30 === 0) {
        await updateProgress({
          progressId: progress._id,
          timeSpent: 30,
        });
      }
    };
    saveTime();
  }, [timeSpent, progress]);

  // Resume from last section
  useEffect(() => {
    if (progress?.currentSectionId && lesson?.sections) {
      const index = lesson.sections.findIndex((s) => s.id === progress.currentSectionId);
      if (index >= 0) setCurrentSectionIndex(index);
    }
  }, [progress, lesson]);

  const currentSection = lesson?.sections?.[currentSectionIndex];

  const handleSectionChange = async (index: number) => {
    if (!lesson || !progress) return;

    const section = lesson.sections[index];
    setCurrentSectionIndex(index);

    // Mark previous section as completed
    if (index > currentSectionIndex) {
      const prevSection = lesson.sections[currentSectionIndex];
      await updateProgress({
        progressId: progress._id,
        completedSectionId: prevSection.id,
        currentSectionId: section.id,
      });
    } else {
      await updateProgress({
        progressId: progress._id,
        currentSectionId: section.id,
      });
    }
  };

  const handleVocabFlip = (index: number) => {
    setVocabularyCards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, isFlipped: !card.isFlipped } : card))
    );
  };

  const handleVocabMastered = async (word: string, mastered: boolean) => {
    if (!progress) return;

    setVocabularyCards((prev) =>
      prev.map((card) => (card.word === word ? { ...card, isMastered: mastered } : card))
    );

    if (mastered) {
      await updateProgress({
        progressId: progress._id,
        masteredWord: word,
      });
    } else {
      await updateProgress({
        progressId: progress._id,
        reviewWord: word,
      });
    }
  };

  const handleGrammarAnswer = (exerciseKey: string, answer: string) => {
    setGrammarExerciseAnswers((prev) => ({ ...prev, [exerciseKey]: answer }));
  };

  const checkGrammarAnswer = (exerciseKey: string, correctAnswer: string) => {
    const isCorrect = grammarExerciseAnswers[exerciseKey]?.toLowerCase() === correctAnswer.toLowerCase();
    setShowGrammarResults((prev) => ({ ...prev, [exerciseKey]: true }));
    return isCorrect;
  };

  const handleCompleteLesson = async () => {
    if (!progress) return;

    // Mark all sections as completed
    if (lesson?.sections) {
      for (const section of lesson.sections) {
        if (!progress.completedSections.includes(section.id)) {
          await updateProgress({
            progressId: progress._id,
            completedSectionId: section.id,
          });
        }
      }
    }

    // Save notes
    if (notes) {
      await updateProgress({
        progressId: progress._id,
        studentNotes: notes,
      });
    }

    await completeProgress({ progressId: progress._id });
    onComplete?.();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!lesson) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin text-simmonds-primary text-4xl">⚙️</div>
      </div>
    );
  }

  const completedSections = progress?.completedSections || [];
  const progressPercentage = lesson.sections.length > 0
    ? Math.round((completedSections.length / lesson.sections.length) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-simmonds-primary to-simmonds-olive text-white p-6 rounded-t-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">{lesson.title}</h1>
            <p className="text-white/80">{lesson.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">{lesson.level}</span>
              <span className="text-sm">⏱️ {lesson.estimatedDuration} min</span>
              <span className="text-sm">📚 {lesson.sections.length} sections</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">Time spent</div>
            <div className="text-2xl font-mono">{formatTime(timeSpent)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex bg-white border-x border-simmonds-cream">
        {/* Sidebar */}
        <div className="w-64 border-r border-simmonds-cream p-4">
          <h3 className="font-semibold text-simmonds-charcoal mb-3">Sections</h3>
          <nav className="space-y-1">
            {lesson.sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => handleSectionChange(index)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  currentSectionIndex === index
                    ? 'bg-simmonds-primary text-white'
                    : completedSections.includes(section.id)
                    ? 'bg-simmonds-lime/10 text-simmonds-lime-dark'
                    : 'hover:bg-simmonds-cream/50 text-simmonds-charcoal'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    completedSections.includes(section.id)
                      ? 'bg-simmonds-lime text-white'
                      : 'bg-simmonds-cream text-simmonds-stone'
                  }`}
                >
                  {completedSections.includes(section.id) ? '✓' : index + 1}
                </span>
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </nav>

          {/* Quick access buttons */}
          <div className="mt-6 space-y-2">
            <button
              onClick={() => setShowVocabMode(true)}
              className="w-full px-3 py-2 bg-simmonds-olive/10 text-simmonds-olive rounded-lg text-sm font-medium hover:bg-simmonds-olive/20 flex items-center gap-2"
            >
              📖 Practice Vocabulary
            </button>
            {test && (
              <button
                onClick={onStartTest}
                className="w-full px-3 py-2 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-lg text-sm font-medium hover:bg-simmonds-terracotta/20 flex items-center gap-2"
              >
                📝 Take Assessment
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {showVocabMode ? (
            // Vocabulary Flashcard Mode
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-simmonds-charcoal">Vocabulary Practice</h2>
                <button
                  onClick={() => setShowVocabMode(false)}
                  className="text-simmonds-primary hover:underline"
                >
                  ← Back to Lesson
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 mb-4">
                <span className="text-simmonds-stone">
                  Card {currentVocabIndex + 1} of {vocabularyCards.length}
                </span>
                <span className="text-simmonds-lime-dark">
                  ✓ {vocabularyCards.filter((c) => c.isMastered).length} mastered
                </span>
              </div>

              {vocabularyCards[currentVocabIndex] && (
                <div
                  className="relative h-64 cursor-pointer perspective-1000"
                  onClick={() => handleVocabFlip(currentVocabIndex)}
                >
                  <div
                    className={`absolute inset-0 transition-transform duration-500 transform-style-3d ${
                      vocabularyCards[currentVocabIndex].isFlipped ? 'rotate-y-180' : ''
                    }`}
                  >
                    {/* Front */}
                    <div
                      className={`absolute inset-0 backface-hidden bg-gradient-to-br from-simmonds-primary to-simmonds-olive text-white rounded-2xl p-8 flex flex-col items-center justify-center ${
                        vocabularyCards[currentVocabIndex].isFlipped ? 'invisible' : ''
                      }`}
                    >
                      <span className="text-4xl font-bold mb-2">
                        {vocabularyCards[currentVocabIndex].word}
                      </span>
                      {vocabularyCards[currentVocabIndex].pronunciation && (
                        <span className="text-white/70">
                          {vocabularyCards[currentVocabIndex].pronunciation}
                        </span>
                      )}
                      <span className="text-sm text-white/50 mt-4">Click to flip</span>
                    </div>

                    {/* Back */}
                    <div
                      className={`absolute inset-0 backface-hidden rotate-y-180 bg-white border-2 border-simmonds-primary rounded-2xl p-8 ${
                        !vocabularyCards[currentVocabIndex].isFlipped ? 'invisible' : ''
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-sm text-simmonds-stone">
                          {vocabularyCards[currentVocabIndex].partOfSpeech}
                        </span>
                        <p className="text-xl text-simmonds-charcoal mt-2">
                          {vocabularyCards[currentVocabIndex].definition}
                        </p>
                        <p className="text-simmonds-stone italic mt-4">
                          "{vocabularyCards[currentVocabIndex].example}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentVocabIndex(Math.max(0, currentVocabIndex - 1))}
                  disabled={currentVocabIndex === 0}
                  className="px-4 py-2 bg-simmonds-cream text-simmonds-charcoal rounded-xl disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() =>
                    handleVocabMastered(
                      vocabularyCards[currentVocabIndex].word,
                      false
                    )
                  }
                  className="px-4 py-2 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl"
                >
                  Need Review
                </button>
                <button
                  onClick={() =>
                    handleVocabMastered(
                      vocabularyCards[currentVocabIndex].word,
                      true
                    )
                  }
                  className="px-4 py-2 bg-simmonds-lime/20 text-simmonds-lime-dark rounded-xl"
                >
                  ✓ Mastered
                </button>
                <button
                  onClick={() =>
                    setCurrentVocabIndex(Math.min(vocabularyCards.length - 1, currentVocabIndex + 1))
                  }
                  disabled={currentVocabIndex === vocabularyCards.length - 1}
                  className="px-4 py-2 bg-simmonds-cream text-simmonds-charcoal rounded-xl disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : currentSection ? (
            // Section Content
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-lg text-sm font-medium capitalize">
                  {currentSection.type}
                </span>
                <h2 className="text-xl font-bold text-simmonds-charcoal">{currentSection.title}</h2>
              </div>

              {/* Section Content */}
              <div
                className="prose prose-lg max-w-none lesson-content"
                dangerouslySetInnerHTML={{ __html: currentSection.visualContent || currentSection.content }}
              />

              {/* Grammar Exercises if grammar section */}
              {currentSection.type === 'grammar' && lesson.grammarPoints && (
                <div className="space-y-6 mt-8 border-t border-simmonds-cream pt-6">
                  <h3 className="font-semibold text-simmonds-charcoal">Practice Exercises</h3>
                  {lesson.grammarPoints.map((grammar, gIndex) =>
                    grammar.exercises?.map((exercise, eIndex) => {
                      const key = `${gIndex}-${eIndex}`;
                      const userAnswer = grammarExerciseAnswers[key];
                      const showResult = showGrammarResults[key];
                      const isCorrect = userAnswer?.toLowerCase() === exercise.correctAnswer.toLowerCase();

                      return (
                        <div
                          key={key}
                          className={`p-4 border rounded-xl ${
                            showResult
                              ? isCorrect
                                ? 'border-simmonds-lime bg-simmonds-lime/5'
                                : 'border-simmonds-terracotta bg-simmonds-terracotta/5'
                              : 'border-simmonds-cream'
                          }`}
                        >
                          <p className="text-simmonds-charcoal mb-3">{exercise.question}</p>
                          {exercise.options ? (
                            <div className="flex flex-wrap gap-2">
                              {exercise.options.map((option) => (
                                <button
                                  key={option}
                                  onClick={() => handleGrammarAnswer(key, option)}
                                  disabled={showResult}
                                  className={`px-4 py-2 rounded-lg border transition-colors ${
                                    userAnswer === option
                                      ? showResult
                                        ? isCorrect
                                          ? 'bg-simmonds-lime text-white border-simmonds-lime'
                                          : 'bg-simmonds-terracotta text-white border-simmonds-terracotta'
                                        : 'bg-simmonds-primary text-white border-simmonds-primary'
                                      : showResult && option === exercise.correctAnswer
                                      ? 'bg-simmonds-lime/20 border-simmonds-lime'
                                      : 'border-simmonds-cream hover:border-simmonds-primary'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={userAnswer || ''}
                              onChange={(e) => handleGrammarAnswer(key, e.target.value)}
                              disabled={showResult}
                              className="px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                              placeholder="Type your answer..."
                            />
                          )}
                          {!showResult && userAnswer && (
                            <button
                              onClick={() => checkGrammarAnswer(key, exercise.correctAnswer)}
                              className="mt-3 px-4 py-2 bg-simmonds-primary text-white rounded-xl text-sm"
                            >
                              Check Answer
                            </button>
                          )}
                          {showResult && exercise.explanation && (
                            <p className="mt-3 text-sm text-simmonds-stone">
                              💡 {exercise.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-simmonds-cream">
                <button
                  onClick={() => handleSectionChange(currentSectionIndex - 1)}
                  disabled={currentSectionIndex === 0}
                  className="px-4 py-2 bg-simmonds-cream text-simmonds-charcoal rounded-xl disabled:opacity-50"
                >
                  ← Previous Section
                </button>
                {currentSectionIndex < lesson.sections.length - 1 ? (
                  <button
                    onClick={() => handleSectionChange(currentSectionIndex + 1)}
                    className="px-4 py-2 bg-simmonds-primary text-white rounded-xl"
                  >
                    Next Section →
                  </button>
                ) : (
                  <button
                    onClick={handleCompleteLesson}
                    className="px-6 py-2 bg-simmonds-lime text-white rounded-xl font-medium"
                  >
                    ✓ Complete Lesson
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-simmonds-cream/30 p-6 rounded-b-2xl border-x border-b border-simmonds-cream">
        <h3 className="font-semibold text-simmonds-charcoal mb-2">Your Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24 resize-none"
          placeholder="Take notes while you study..."
        />
      </div>

      {/* Custom styles for flashcard animation */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }

        .lesson-content h1, .lesson-content h2, .lesson-content h3 {
          color: #003F37;
          margin-top: 1.5rem;
        }
        .lesson-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .lesson-content th, .lesson-content td {
          padding: 0.75rem;
          border: 1px solid #E3C6AB;
        }
        .lesson-content th {
          background: #003F37;
          color: white;
        }
        .lesson-content ul, .lesson-content ol {
          margin-left: 1.5rem;
        }
        .lesson-content strong {
          color: #003F37;
        }
        .lesson-content em {
          color: #9F9D38;
        }
      `}</style>
    </div>
  );
};

export default VirtualLessonViewer;
