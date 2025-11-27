import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface LessonPresentationProps {
  currentUser: User | null;
  company: Company | null;
  lessonId: string;
  onClose?: () => void;
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
  audioUrl?: string;
}

interface SectionAudio {
  sectionId: string;
  audioUrl: string;
  isGenerating: boolean;
}

const LessonPresentation: React.FC<LessonPresentationProps> = ({
  currentUser,
  company,
  lessonId,
  onClose,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio state
  const [sectionAudios, setSectionAudios] = useState<Record<string, SectionAudio>>({});
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [audioGenerationProgress, setAudioGenerationProgress] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key === 'ArrowRight' && !showVocabMode && lesson?.sections) {
        if (currentSectionIndex < lesson.sections.length - 1) {
          handleSectionChange(currentSectionIndex + 1);
        }
      }
      if (e.key === 'ArrowLeft' && !showVocabMode) {
        if (currentSectionIndex > 0) {
          handleSectionChange(currentSectionIndex - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentSectionIndex, showVocabMode, lesson]);

  const currentSection = lesson?.sections?.[currentSectionIndex];

  const handleSectionChange = async (index: number) => {
    if (!lesson || !progress) return;

    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(null);
    }

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

  // Audio generation for a single section
  const generateSectionAudio = async (sectionId: string, content: string) => {
    const apiKey = (company?.settings as any)?.elevenLabsApiKey;
    if (!apiKey) return;

    const voiceConfig = (company as any)?.voiceConfig;
    const lessonLanguage = lesson?.language || 'english';
    const voiceId = lessonLanguage === 'german'
      ? voiceConfig?.defaultGermanVoice || 'onwK4e9ZLuTAKqWW03F9'
      : voiceConfig?.defaultEnglishVoice || '21m00Tcm4TlvDq8ikWAM';

    setSectionAudios(prev => ({
      ...prev,
      [sectionId]: { sectionId, audioUrl: '', isGenerating: true }
    }));

    try {
      // Clean HTML and prepare text
      const cleanText = content
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // ElevenLabs limit

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
            text: cleanText,
            model_id: lessonLanguage === 'german' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
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

      setSectionAudios(prev => ({
        ...prev,
        [sectionId]: { sectionId, audioUrl, isGenerating: false }
      }));

      return audioUrl;
    } catch (error) {
      console.error('Audio generation error:', error);
      setSectionAudios(prev => ({
        ...prev,
        [sectionId]: { sectionId, audioUrl: '', isGenerating: false }
      }));
      return null;
    }
  };

  // Generate audio for all sections
  const generateAllSectionAudio = async () => {
    if (!lesson?.sections || isGeneratingAllAudio) return;

    const apiKey = (company?.settings as any)?.elevenLabsApiKey;
    if (!apiKey) {
      alert('ElevenLabs API key not configured. Please add it in Settings.');
      return;
    }

    setIsGeneratingAllAudio(true);

    for (let i = 0; i < lesson.sections.length; i++) {
      const section = lesson.sections[i];
      setAudioGenerationProgress(`Generating audio for section ${i + 1}/${lesson.sections.length}: ${section.title}`);
      await generateSectionAudio(section.id, section.visualContent || section.content);
    }

    // Generate vocabulary audio
    if (lesson.vocabulary) {
      for (let i = 0; i < lesson.vocabulary.length; i++) {
        const vocab = lesson.vocabulary[i];
        setAudioGenerationProgress(`Generating vocabulary audio ${i + 1}/${lesson.vocabulary.length}: ${vocab.word}`);
        const audioText = `${vocab.word}. ${vocab.definition}. For example: ${vocab.example}`;
        await generateSectionAudio(`vocab-${vocab.word}`, audioText);
      }
    }

    setAudioGenerationProgress('');
    setIsGeneratingAllAudio(false);
  };

  // Play section audio
  const playAudio = (sectionId: string) => {
    const audio = sectionAudios[sectionId];
    if (!audio?.audioUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(audio.audioUrl);
    newAudio.onended = () => setIsPlayingAudio(null);
    newAudio.onerror = () => setIsPlayingAudio(null);
    audioRef.current = newAudio;
    newAudio.play();
    setIsPlayingAudio(sectionId);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingAudio(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  if (!lesson) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-12">
          <div className="animate-spin text-simmonds-primary text-4xl">⚙️</div>
          <p className="mt-4 text-simmonds-stone">Loading lesson...</p>
        </div>
      </div>
    );
  }

  const completedSections = progress?.completedSections || [];
  const progressPercentage = lesson.sections.length > 0
    ? Math.round((completedSections.length / lesson.sections.length) * 100)
    : 0;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-white z-50 flex flex-col ${isFullscreen ? 'fullscreen' : ''}`}
    >
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-simmonds-primary to-simmonds-olive text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Close lesson"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">{lesson.title}</h1>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{lesson.level}</span>
              <span>⏱️ {lesson.estimatedDuration} min</span>
              <span>📚 {lesson.sections.length} sections</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Audio Generation Button */}
          <button
            onClick={generateAllSectionAudio}
            disabled={isGeneratingAllAudio}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            title="Generate audio for all sections"
          >
            {isGeneratingAllAudio ? (
              <>
                <span className="animate-spin">⚙️</span>
                <span className="hidden sm:inline text-sm">{audioGenerationProgress || 'Generating...'}</span>
              </>
            ) : (
              <>
                <span>🔊</span>
                <span className="hidden sm:inline text-sm">Generate Audio</span>
              </>
            )}
          </button>

          {/* Time spent */}
          <div className="text-right">
            <div className="text-xs opacity-70">Time spent</div>
            <div className="text-lg font-mono">{formatTime(timeSpent)}</div>
          </div>

          {/* Progress */}
          <div className="w-32">
            <div className="flex items-center justify-between text-xs mb-1">
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

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div
          className={`bg-simmonds-cream/30 border-r border-simmonds-cream transition-all duration-300 flex flex-col ${
            sidebarCollapsed ? 'w-16' : 'w-72'
          }`}
        >
          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 hover:bg-simmonds-cream/50 border-b border-simmonds-cream flex items-center justify-center"
          >
            <svg
              className={`w-5 h-5 text-simmonds-stone transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Sections List */}
          <nav className="flex-1 overflow-y-auto p-2">
            {!sidebarCollapsed && (
              <h3 className="font-semibold text-simmonds-charcoal px-3 py-2 text-sm uppercase tracking-wide">
                Sections
              </h3>
            )}
            <div className="space-y-1">
              {lesson.sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(index)}
                  className={`w-full text-left rounded-lg transition-all flex items-center gap-2 ${
                    sidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2'
                  } ${
                    currentSectionIndex === index
                      ? 'bg-simmonds-primary text-white shadow-md'
                      : completedSections.includes(section.id)
                      ? 'bg-simmonds-lime/20 text-simmonds-lime-dark hover:bg-simmonds-lime/30'
                      : 'hover:bg-simmonds-cream text-simmonds-charcoal'
                  }`}
                  title={sidebarCollapsed ? section.title : undefined}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      completedSections.includes(section.id)
                        ? 'bg-simmonds-lime text-white'
                        : currentSectionIndex === index
                        ? 'bg-white/30'
                        : 'bg-simmonds-cream text-simmonds-stone'
                    }`}
                  >
                    {completedSections.includes(section.id) ? '✓' : index + 1}
                  </span>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{section.title}</span>
                      <span className={`text-xs ${
                        currentSectionIndex === index ? 'text-white/70' : 'text-simmonds-stone'
                      }`}>
                        {section.type}
                      </span>
                    </div>
                  )}
                  {!sidebarCollapsed && sectionAudios[section.id]?.audioUrl && (
                    <span className="text-xs">🔊</span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* Quick Actions */}
          {!sidebarCollapsed && (
            <div className="p-3 border-t border-simmonds-cream space-y-2">
              <button
                onClick={() => setShowVocabMode(true)}
                className="w-full px-3 py-2 bg-simmonds-olive/10 text-simmonds-olive rounded-lg text-sm font-medium hover:bg-simmonds-olive/20 flex items-center gap-2 justify-center"
              >
                📖 Practice Vocabulary
                <span className="text-xs bg-simmonds-olive/20 px-2 py-0.5 rounded-full">
                  {vocabularyCards.filter(v => v.isMastered).length}/{vocabularyCards.length}
                </span>
              </button>
              {test && (
                <button
                  onClick={onStartTest}
                  className="w-full px-3 py-2 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-lg text-sm font-medium hover:bg-simmonds-terracotta/20 flex items-center gap-2 justify-center"
                >
                  📝 Take Assessment
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content - Fixed size PowerPoint style */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 overflow-hidden">
          {showVocabMode ? (
            // Vocabulary Flashcard Mode
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-4xl h-[calc(100vh-200px)] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-simmonds-charcoal">Vocabulary Practice</h2>
                <button
                  onClick={() => setShowVocabMode(false)}
                  className="text-simmonds-primary hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Lesson
                </button>
              </div>

              <div className="flex items-center justify-center gap-6 mb-6">
                <span className="text-simmonds-stone">
                  Card {currentVocabIndex + 1} of {vocabularyCards.length}
                </span>
                <span className="text-simmonds-lime-dark font-medium">
                  ✓ {vocabularyCards.filter((c) => c.isMastered).length} mastered
                </span>
              </div>

              {vocabularyCards[currentVocabIndex] && (
                <div
                  className="relative h-72 cursor-pointer perspective-1000 mb-6"
                  onClick={() => handleVocabFlip(currentVocabIndex)}
                >
                  <div
                    className={`absolute inset-0 transition-transform duration-500 transform-style-3d ${
                      vocabularyCards[currentVocabIndex].isFlipped ? 'rotate-y-180' : ''
                    }`}
                  >
                    {/* Front */}
                    <div
                      className={`absolute inset-0 backface-hidden bg-gradient-to-br from-simmonds-primary to-simmonds-olive text-white rounded-2xl p-8 flex flex-col items-center justify-center shadow-xl ${
                        vocabularyCards[currentVocabIndex].isFlipped ? 'invisible' : ''
                      }`}
                    >
                      <span className="text-5xl font-bold mb-3">
                        {vocabularyCards[currentVocabIndex].word}
                      </span>
                      {vocabularyCards[currentVocabIndex].pronunciation && (
                        <span className="text-white/70 text-lg">
                          {vocabularyCards[currentVocabIndex].pronunciation}
                        </span>
                      )}
                      {sectionAudios[`vocab-${vocabularyCards[currentVocabIndex].word}`]?.audioUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio(`vocab-${vocabularyCards[currentVocabIndex].word}`);
                          }}
                          className="mt-4 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        >
                          🔊
                        </button>
                      )}
                      <span className="text-sm text-white/50 mt-6">Click to flip</span>
                    </div>

                    {/* Back */}
                    <div
                      className={`absolute inset-0 backface-hidden rotate-y-180 bg-white border-2 border-simmonds-primary rounded-2xl p-8 shadow-xl ${
                        !vocabularyCards[currentVocabIndex].isFlipped ? 'invisible' : ''
                      }`}
                    >
                      <div className="text-center h-full flex flex-col justify-center">
                        <span className="text-sm text-simmonds-stone uppercase tracking-wide">
                          {vocabularyCards[currentVocabIndex].partOfSpeech}
                        </span>
                        <p className="text-2xl text-simmonds-charcoal mt-3 font-medium">
                          {vocabularyCards[currentVocabIndex].definition}
                        </p>
                        <p className="text-simmonds-stone italic mt-6 text-lg">
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
                  className="px-5 py-3 bg-simmonds-cream text-simmonds-charcoal rounded-xl disabled:opacity-50 hover:bg-simmonds-cream/80 transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={() =>
                    handleVocabMastered(vocabularyCards[currentVocabIndex].word, false)
                  }
                  className="px-5 py-3 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl hover:bg-simmonds-terracotta/20 transition-colors"
                >
                  Need Review
                </button>
                <button
                  onClick={() =>
                    handleVocabMastered(vocabularyCards[currentVocabIndex].word, true)
                  }
                  className="px-5 py-3 bg-simmonds-lime/20 text-simmonds-lime-dark rounded-xl hover:bg-simmonds-lime/30 transition-colors"
                >
                  ✓ Mastered
                </button>
                <button
                  onClick={() =>
                    setCurrentVocabIndex(Math.min(vocabularyCards.length - 1, currentVocabIndex + 1))
                  }
                  disabled={currentVocabIndex === vocabularyCards.length - 1}
                  className="px-5 py-3 bg-simmonds-cream text-simmonds-charcoal rounded-xl disabled:opacity-50 hover:bg-simmonds-cream/80 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : currentSection ? (
            // Section Content - PowerPoint Style Slide
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl aspect-[16/9] flex flex-col overflow-hidden">
              {/* Slide Header */}
              <div className="bg-gradient-to-r from-simmonds-primary to-simmonds-olive px-8 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-medium capitalize">
                    {currentSection.type}
                  </span>
                  <h2 className="text-xl font-bold text-white">{currentSection.title}</h2>
                </div>

                {/* Audio controls */}
                <div className="flex items-center gap-2">
                  {sectionAudios[currentSection.id]?.isGenerating ? (
                    <span className="text-sm text-white/70 animate-pulse">Generating...</span>
                  ) : sectionAudios[currentSection.id]?.audioUrl ? (
                    <button
                      onClick={() => isPlayingAudio === currentSection.id ? stopAudio() : playAudio(currentSection.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                        isPlayingAudio === currentSection.id
                          ? 'bg-simmonds-terracotta text-white'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {isPlayingAudio === currentSection.id ? '■ Stop' : '▶ Listen'}
                    </button>
                  ) : (
                    <button
                      onClick={() => generateSectionAudio(currentSection.id, currentSection.visualContent || currentSection.content)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm"
                    >
                      🔊 Audio
                    </button>
                  )}
                </div>
              </div>

              {/* Slide Content - Fixed height, no scroll */}
              <div
                className="flex-1 p-8 overflow-hidden lesson-slide-content"
                dangerouslySetInnerHTML={{ __html: currentSection.visualContent || currentSection.content }}
              />

              {/* Slide Footer with Navigation */}
              <div className="bg-simmonds-cream/30 px-8 py-3 flex items-center justify-between shrink-0 border-t border-simmonds-cream/50">
                <button
                  onClick={() => handleSectionChange(currentSectionIndex - 1)}
                  disabled={currentSectionIndex === 0}
                  className="px-4 py-2 bg-white text-simmonds-charcoal rounded-lg disabled:opacity-30 hover:bg-simmonds-cream transition-colors flex items-center gap-2 text-sm shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                {/* Slide indicator */}
                <div className="flex items-center gap-2">
                  {lesson.sections.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSectionChange(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        idx === currentSectionIndex
                          ? 'bg-simmonds-primary w-6'
                          : completedSections.includes(lesson.sections[idx].id)
                          ? 'bg-simmonds-lime'
                          : 'bg-simmonds-cream hover:bg-simmonds-primary/30'
                      }`}
                    />
                  ))}
                </div>

                {currentSectionIndex < lesson.sections.length - 1 ? (
                  <button
                    onClick={() => handleSectionChange(currentSectionIndex + 1)}
                    className="px-4 py-2 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90 transition-colors flex items-center gap-2 text-sm shadow-sm"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleCompleteLesson}
                    className="px-4 py-2 bg-simmonds-lime text-white rounded-lg font-medium hover:bg-simmonds-lime/90 transition-colors flex items-center gap-2 text-sm shadow-sm"
                  >
                    Complete ✓
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Notes Panel (collapsible) */}
        <div className="w-80 bg-simmonds-cream/20 border-l border-simmonds-cream p-4 hidden lg:block">
          <h3 className="font-semibold text-simmonds-charcoal mb-3 flex items-center gap-2">
            <span>📝</span>
            Your Notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-48 resize-none text-sm"
            placeholder="Take notes while you study..."
          />

          {/* Lesson Objectives */}
          {lesson.objectives && lesson.objectives.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-simmonds-charcoal mb-3 flex items-center gap-2">
                <span>🎯</span>
                Learning Objectives
              </h3>
              <ul className="space-y-2">
                {lesson.objectives.map((obj, i) => (
                  <li key={i} className="text-sm text-simmonds-stone flex items-start gap-2">
                    <span className="text-simmonds-lime shrink-0">•</span>
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Keyboard shortcuts */}
          <div className="mt-6 pt-6 border-t border-simmonds-cream">
            <h4 className="text-xs font-medium text-simmonds-stone uppercase tracking-wide mb-2">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1 text-xs text-simmonds-stone">
              <div className="flex justify-between">
                <span>Next section</span>
                <kbd className="px-2 py-0.5 bg-simmonds-cream rounded">→</kbd>
              </div>
              <div className="flex justify-between">
                <span>Previous section</span>
                <kbd className="px-2 py-0.5 bg-simmonds-cream rounded">←</kbd>
              </div>
              <div className="flex justify-between">
                <span>Exit fullscreen</span>
                <kbd className="px-2 py-0.5 bg-simmonds-cream rounded">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }

        /* PowerPoint-style slide content */
        .lesson-slide-content {
          display: flex;
          flex-direction: column;
          font-size: 1.1rem;
          line-height: 1.6;
        }
        .lesson-slide-content h1, .lesson-slide-content h2 {
          color: #003F37;
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .lesson-slide-content h3 {
          color: #003F37;
          font-size: 1.35rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }
        .lesson-slide-content p {
          margin-bottom: 0.75rem;
        }
        .lesson-slide-content ul, .lesson-slide-content ol {
          margin-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .lesson-slide-content li {
          margin-bottom: 0.5rem;
        }
        .lesson-slide-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75rem 0;
          font-size: 1rem;
        }
        .lesson-slide-content th, .lesson-slide-content td {
          padding: 0.5rem 0.75rem;
          border: 1px solid #E3C6AB;
          text-align: left;
        }
        .lesson-slide-content th {
          background: linear-gradient(135deg, #003F37 0%, #4F5338 100%);
          color: white;
          font-weight: 600;
        }
        .lesson-slide-content strong {
          color: #003F37;
          font-weight: 600;
        }
        .lesson-slide-content em {
          color: #9F9D38;
          font-style: italic;
        }

        /* Image placeholder styling */
        .lesson-slide-content [style*="background: linear-gradient"] {
          margin: 0.75rem 0;
        }

        /* Vocabulary card styling */
        .vocab-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }
        .vocab-card {
          background: linear-gradient(135deg, #fff 0%, #E3C6AB22 100%);
          border: 1px solid #E3C6AB;
          border-radius: 0.75rem;
          padding: 0.75rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Legacy lesson-content support */
        .lesson-content h1, .lesson-content h2, .lesson-content h3 {
          color: #003F37;
          margin-top: 1rem;
        }
        .lesson-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75rem 0;
        }
        .lesson-content th, .lesson-content td {
          padding: 0.5rem;
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
        .lesson-content img {
          max-width: 100%;
          border-radius: 0.75rem;
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
};

export default LessonPresentation;
