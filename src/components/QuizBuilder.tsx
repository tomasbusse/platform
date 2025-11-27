import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface QuizBuilderProps {
  currentUser: User | null;
  company: Company | null;
  onQuizCreated?: (quizId: string) => void;
}

// Extended question types
type QuestionType =
  | 'multiple_choice' | 'multiple_select' | 'fill_in_blank' | 'true_false'
  | 'short_answer' | 'long_answer' | 'sentence_completion' | 'error_correction'
  | 'word_formation' | 'sentence_reorder' | 'matching' | 'ordering' | 'categorization'
  | 'reading_comprehension' | 'cloze_test' | 'listening' | 'audio_transcription'
  | 'audio_multiple_choice' | 'dictation' | 'image_description' | 'image_labeling'
  | 'image_sequence' | 'video_comprehension' | 'speaking_response' | 'pronunciation'
  | 'read_aloud' | 'drag_and_drop' | 'hotspot' | 'conversation_completion';

type Skill = 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing' | 'speaking' | 'pronunciation';
type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type Difficulty = 'easy' | 'medium' | 'hard';
// Updated test purpose types
type TestPurpose = 'placement' | 'follow_up' | 'level_assessment' | 'practice' | 'diagnostic' | 'certification';
type SkillFocus = 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing' | 'speaking' | 'mixed';

interface QuestionData {
  id: string;
  questionType: QuestionType;
  skill: Skill;
  level: Level;
  difficulty: Difficulty;
  questionText: string;
  options?: string[];
  correctAnswer: string | boolean | string[];
  explanation?: string;
  // Audio support
  audio?: {
    url?: string;
    transcript?: string;
    duration?: number;
    maxPlays?: number;
  };
  audioUrl?: string; // Legacy
  // Image support
  image?: {
    url?: string;
    alt?: string;
  };
  imageUrl?: string; // Legacy
  // Reading/passage support
  readingPassage?: string;
  // For fill-in-blank / cloze
  textWithBlanks?: string;
  // For matching
  matchingPairs?: Array<{ left: string; right: string }>;
  // For ordering
  itemsToOrder?: string[];
  correctOrder?: number[];
  hints?: string[];
  points: number;
  timeLimit?: number;
  tags: string[];
  isCambridgeAligned: boolean;
}

interface QuizFormData {
  title: string;
  description: string;
  instructions: string;
  level: Level;
  testPurpose: TestPurpose;
  skillFocus: SkillFocus;
  duration: number;
  passingScore: number;
  isCambridgeAligned: boolean;
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showCorrectAnswers: boolean;
    showExplanations: boolean;
    allowRetake: boolean;
    maxAttempts: number;
    requirePassingScore: boolean;
    showTimer: boolean;
    showProgressBar: boolean;
    allowSkip: boolean;
    allowReview: boolean;
    autoSubmitOnTimeout: boolean;
  };
  tags: string[];
}

const defaultQuizSettings = {
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
};

const QuizBuilder: React.FC<QuizBuilderProps> = ({ currentUser, company, onQuizCreated }) => {
  const [step, setStep] = useState<'details' | 'questions' | 'preview'>('details');
  const [quizForm, setQuizForm] = useState<QuizFormData>({
    title: '',
    description: '',
    instructions: '',
    level: 'A1',
    testPurpose: 'practice',
    skillFocus: 'mixed',
    duration: 30,
    passingScore: 60,
    isCambridgeAligned: false,
    settings: defaultQuizSettings,
    tags: [],
  });
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [showAIModal, setShowAIModal] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Convex mutations
  const createQuiz = useMutation(api.quizzes.createQuiz);
  const addQuestionToBank = useMutation(api.quizzes.addQuestionToBank);

  // Get existing questions from question bank
  const existingQuestions = useQuery(
    api.quizzes.getQuestionsByFilters,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  const generateQuestionId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const createNewQuestion = (): QuestionData => ({
    id: generateQuestionId(),
    questionType: 'multiple_choice',
    skill: 'grammar',
    level: quizForm.level,
    difficulty: 'medium',
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    points: 1,
    timeLimit: 60,
    tags: [],
    isCambridgeAligned: quizForm.isCambridgeAligned,
  });

  const handleAddQuestion = () => {
    setEditingQuestion(createNewQuestion());
    setShowQuestionModal(true);
  };

  const handleEditQuestion = (question: QuestionData) => {
    setEditingQuestion({ ...question });
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;

    const existingIndex = questions.findIndex(q => q.id === editingQuestion.id);
    if (existingIndex >= 0) {
      const updatedQuestions = [...questions];
      updatedQuestions[existingIndex] = editingQuestion;
      setQuestions(updatedQuestions);
    } else {
      setQuestions([...questions, editingQuestion]);
    }
    setShowQuestionModal(false);
    setEditingQuestion(null);
  };

  const handleDuplicateQuestion = (question: QuestionData) => {
    const duplicated = {
      ...question,
      id: generateQuestionId(),
    };
    setQuestions([...questions, duplicated]);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const handleGenerateAI = async () => {
    if (!company || !currentUser) return;

    setIsGeneratingAI(true);
    try {
      // Get company settings for API key
      const settings = company.settings;
      const openRouterApiKey = settings?.openRouterApiKey;

      if (!openRouterApiKey) {
        alert('Please configure your OpenRouter API key in Settings to use AI generation.');
        setIsGeneratingAI(false);
        return;
      }

      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Simmonds Language Platform',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: `You are an expert English language teacher creating assessment questions aligned with CEFR standards.
              Generate questions that are appropriate for the specified level and skill area.
              Always respond with valid JSON array containing question objects.`
            },
            {
              role: 'user',
              content: `Generate ${aiQuestionCount} ${quizForm.level} level English questions for ${quizForm.skillFocus} skill.
              Test purpose: ${quizForm.testPurpose.replace('_', ' ')}
              ${aiPrompt ? `Additional context: ${aiPrompt}` : ''}

              Return a JSON array with this exact structure:
              [
                {
                  "questionType": "multiple_choice" | "fill_in_blank" | "true_false" | "sentence_completion" | "error_correction" | "matching",
                  "skill": "${quizForm.skillFocus === 'mixed' ? 'grammar' : quizForm.skillFocus}",
                  "questionText": "The question text",
                  "options": ["option1", "option2", "option3", "option4"], // for multiple_choice
                  "correctAnswer": "the correct answer",
                  "explanation": "Why this is correct",
                  "difficulty": "easy" | "medium" | "hard",
                  "points": 1
                }
              ]

              Make questions that test ${quizForm.level} level competency.
              For ${quizForm.level}:
              - A1: Basic phrases, simple present tense, common vocabulary
              - A2: Simple past, future with going to, everyday topics
              - B1: All tenses, conditionals, abstract topics
              - B2: Complex grammar, idiomatic expressions, nuanced vocabulary
              - C1: Advanced structures, subtle distinctions, academic language
              - C2: Near-native proficiency, literary and formal language
              - mixed: Include questions from multiple levels (A1-C2) to assess overall proficiency`
            }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in response');
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not find JSON array in response');
      }

      const generatedQuestions = JSON.parse(jsonMatch[0]);

      // Convert to our format
      const newQuestions: QuestionData[] = generatedQuestions.map((q: any) => ({
        id: generateQuestionId(),
        questionType: q.questionType || 'multiple_choice',
        skill: q.skill || quizForm.skillFocus,
        level: q.level || quizForm.level,
        difficulty: q.difficulty || 'medium',
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        matchingPairs: q.matchingPairs,
        points: q.points || 1,
        timeLimit: 60,
        tags: ['ai-generated'],
        isCambridgeAligned: quizForm.isCambridgeAligned,
      }));

      setQuestions([...questions, ...newQuestions]);
      setShowAIModal(false);
      setAiPrompt('');
      alert(`Successfully generated ${newQuestions.length} questions!`);
    } catch (error) {
      console.error('AI generation error:', error);
      alert(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAddTag = () => {
    if (newTag && !quizForm.tags.includes(newTag)) {
      setQuizForm({ ...quizForm, tags: [...quizForm.tags, newTag] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setQuizForm({ ...quizForm, tags: quizForm.tags.filter(t => t !== tag) });
  };

  const handleSaveQuiz = async () => {
    if (!currentUser || !company) {
      alert('Please log in to save quizzes');
      return;
    }

    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    setIsSaving(true);
    try {
      // First, save all questions to the question bank
      const savedQuestionIds: Id<"questionBank">[] = [];

      for (const question of questions) {
        const questionId = await addQuestionToBank({
          companyId: company._id as Id<"companies">,
          createdBy: currentUser._id as Id<"users">,
          questionType: question.questionType,
          skill: question.skill,
          level: question.level,
          difficulty: question.difficulty,
          questionText: question.questionText,
          questionData: {
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            audioUrl: question.audioUrl,
            readingPassage: question.readingPassage,
            hints: question.hints,
          },
          points: question.points,
          timeLimit: question.timeLimit,
          tags: question.tags,
          isCambridgeAligned: question.isCambridgeAligned,
          cambridgeReference: undefined,
        });
        savedQuestionIds.push(questionId);
      }

      // Then create the quiz
      const quizId = await createQuiz({
        companyId: company._id as Id<"companies">,
        createdBy: currentUser._id as Id<"users">,
        title: quizForm.title,
        description: quizForm.description,
        instructions: quizForm.instructions,
        level: quizForm.level,
        testPurpose: quizForm.testPurpose,
        skillFocus: quizForm.skillFocus,
        duration: quizForm.duration,
        passingScore: quizForm.passingScore,
        settings: quizForm.settings,
        tags: quizForm.tags,
        isCambridgeAligned: quizForm.isCambridgeAligned,
        cambridgeLevel: quizForm.isCambridgeAligned ? quizForm.level : undefined,
      });

      alert('Quiz saved successfully!');
      onQuizCreated?.(quizId);

      // Reset form
      setQuizForm({
        title: '',
        description: '',
        instructions: '',
        level: 'A1',
        testPurpose: 'practice',
        skillFocus: 'mixed',
        duration: 30,
        passingScore: 60,
        isCambridgeAligned: false,
        settings: defaultQuizSettings,
        tags: [],
      });
      setQuestions([]);
      setStep('details');
    } catch (error) {
      console.error('Error saving quiz:', error);
      alert(`Failed to save quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getTotalPoints = () => questions.reduce((sum, q) => sum + q.points, 0);

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Quiz Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Quiz Title *</label>
            <input
              type="text"
              value={quizForm.title}
              onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              placeholder="e.g., B1 Grammar Assessment"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Description</label>
            <textarea
              value={quizForm.description}
              onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary h-24"
              placeholder="Describe the test objectives and content..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Instructions (shown before test)</label>
            <textarea
              value={quizForm.instructions}
              onChange={(e) => setQuizForm({ ...quizForm, instructions: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary h-20"
              placeholder="e.g., Read each question carefully. You have 45 minutes to complete this test..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">CEFR Level *</label>
            <select
              value={quizForm.level}
              onChange={(e) => setQuizForm({ ...quizForm, level: e.target.value as Level })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
            >
              <option value="mixed">Mixed Levels (for placement tests)</option>
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Proficient</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Test Purpose *</label>
            <select
              value={quizForm.testPurpose}
              onChange={(e) => setQuizForm({ ...quizForm, testPurpose: e.target.value as TestPurpose })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
            >
              <option value="placement">Placement Test - Initial assessment</option>
              <option value="follow_up">Follow-up Test - Progress check after lessons</option>
              <option value="level_assessment">Level Assessment - Check readiness for next level</option>
              <option value="practice">Practice Test - General practice</option>
              <option value="diagnostic">Diagnostic Test - Identify skill gaps</option>
              <option value="certification">Certification Test - Formal level certification</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Skill Focus *</label>
            <select
              value={quizForm.skillFocus}
              onChange={(e) => setQuizForm({ ...quizForm, skillFocus: e.target.value as SkillFocus })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
            >
              <option value="mixed">Mixed Skills</option>
              <option value="grammar">Grammar</option>
              <option value="vocabulary">Vocabulary</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing</option>
              <option value="speaking">Speaking</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={quizForm.duration}
              onChange={(e) => setQuizForm({ ...quizForm, duration: parseInt(e.target.value) || 30 })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              min="5"
              max="180"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Passing Score (%)</label>
            <input
              type="number"
              value={quizForm.passingScore}
              onChange={(e) => setQuizForm({ ...quizForm, passingScore: parseInt(e.target.value) || 60 })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              min="0"
              max="100"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="cambridgeAligned"
              checked={quizForm.isCambridgeAligned}
              onChange={(e) => setQuizForm({ ...quizForm, isCambridgeAligned: e.target.checked })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <label htmlFor="cambridgeAligned" className="ml-2 text-sm text-simmonds-charcoal">
              Cambridge English Aligned
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {quizForm.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-full text-sm flex items-center gap-1"
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-simmonds-terracotta">
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                placeholder="Add a tag..."
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-simmonds-cream text-simmonds-charcoal rounded-xl hover:bg-simmonds-cream-light"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Quiz Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={quizForm.settings.shuffleQuestions}
              onChange={(e) => setQuizForm({
                ...quizForm,
                settings: { ...quizForm.settings, shuffleQuestions: e.target.checked }
              })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <span className="ml-2 text-sm text-simmonds-charcoal">Shuffle Questions</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={quizForm.settings.shuffleOptions}
              onChange={(e) => setQuizForm({
                ...quizForm,
                settings: { ...quizForm.settings, shuffleOptions: e.target.checked }
              })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <span className="ml-2 text-sm text-simmonds-charcoal">Shuffle Answer Options</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={quizForm.settings.showCorrectAnswers}
              onChange={(e) => setQuizForm({
                ...quizForm,
                settings: { ...quizForm.settings, showCorrectAnswers: e.target.checked }
              })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <span className="ml-2 text-sm text-simmonds-charcoal">Show Correct Answers After</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={quizForm.settings.showExplanations}
              onChange={(e) => setQuizForm({
                ...quizForm,
                settings: { ...quizForm.settings, showExplanations: e.target.checked }
              })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <span className="ml-2 text-sm text-simmonds-charcoal">Show Explanations</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={quizForm.settings.allowRetake}
              onChange={(e) => setQuizForm({
                ...quizForm,
                settings: { ...quizForm.settings, allowRetake: e.target.checked }
              })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <span className="ml-2 text-sm text-simmonds-charcoal">Allow Retakes</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={quizForm.settings.showTimer}
              onChange={(e) => setQuizForm({
                ...quizForm,
                settings: { ...quizForm.settings, showTimer: e.target.checked }
              })}
              className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
            />
            <span className="ml-2 text-sm text-simmonds-charcoal">Show Timer</span>
          </label>

          {quizForm.settings.allowRetake && (
            <div>
              <label className="block text-sm text-simmonds-charcoal mb-1">Max Attempts</label>
              <input
                type="number"
                value={quizForm.settings.maxAttempts}
                onChange={(e) => setQuizForm({
                  ...quizForm,
                  settings: { ...quizForm.settings, maxAttempts: parseInt(e.target.value) || 1 }
                })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                min="1"
                max="10"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setStep('questions')}
          disabled={!quizForm.title}
          className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Add Questions
        </button>
      </div>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Questions</h3>
            <p className="text-sm text-simmonds-stone">
              {questions.length} question{questions.length !== 1 ? 's' : ''} | {getTotalPoints()} total points
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="px-4 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light flex items-center gap-2"
            >
              <span>AI Generate</span>
            </button>
            <button
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light"
            >
              + Add Question
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-simmonds-cream rounded-xl">
            <p className="text-simmonds-stone mb-4">No questions added yet</p>
            <button
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-simmonds-primary/10 text-simmonds-primary rounded-xl font-medium hover:bg-simmonds-primary/20"
            >
              Add Your First Question
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="border border-simmonds-cream rounded-xl p-4 hover:border-simmonds-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary rounded text-xs font-medium">
                        Q{index + 1}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-cream text-simmonds-stone rounded text-xs">
                        {question.questionType.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-olive/10 text-simmonds-olive rounded text-xs">
                        {question.skill}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-lime/10 text-simmonds-lime-dark rounded text-xs">
                        {question.points} pt{question.points !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-simmonds-charcoal">{question.questionText || 'No question text'}</p>
                    {question.options && question.options.length > 0 && (
                      <div className="mt-2 text-sm text-simmonds-stone">
                        Options: {question.options.filter(o => o).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-simmonds-stone hover:text-simmonds-charcoal disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-1 text-simmonds-stone hover:text-simmonds-charcoal disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleEditQuestion(question)}
                      className="p-1 text-simmonds-primary hover:text-simmonds-primary-dark"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicateQuestion(question)}
                      className="p-1 text-simmonds-olive hover:text-simmonds-olive-dark"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="p-1 text-simmonds-terracotta hover:text-simmonds-terracotta-dark"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep('details')}
          className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
        >
          Back to Details
        </button>
        <button
          onClick={() => setStep('preview')}
          disabled={questions.length === 0}
          className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Preview Quiz
        </button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Quiz Preview</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-simmonds-primary/10 rounded-xl">
            <p className="text-sm text-simmonds-stone">Total Questions</p>
            <p className="text-2xl font-bold text-simmonds-primary">{questions.length}</p>
          </div>
          <div className="p-4 bg-simmonds-olive/10 rounded-xl">
            <p className="text-sm text-simmonds-stone">Total Points</p>
            <p className="text-2xl font-bold text-simmonds-olive">{getTotalPoints()}</p>
          </div>
          <div className="p-4 bg-simmonds-lime/10 rounded-xl">
            <p className="text-sm text-simmonds-stone">Duration</p>
            <p className="text-2xl font-bold text-simmonds-lime-dark">{quizForm.duration} min</p>
          </div>
          <div className="p-4 bg-simmonds-cream rounded-xl">
            <p className="text-sm text-simmonds-stone">Passing Score</p>
            <p className="text-2xl font-bold text-simmonds-charcoal">{quizForm.passingScore}%</p>
          </div>
        </div>

        <div className="border-t border-simmonds-cream pt-4">
          <h4 className="font-semibold text-simmonds-charcoal mb-2">{quizForm.title}</h4>
          <p className="text-simmonds-stone mb-4">{quizForm.description || 'No description provided'}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-full text-sm">
              {quizForm.level}
            </span>
            <span className="px-3 py-1 bg-simmonds-olive/10 text-simmonds-olive rounded-full text-sm">
              {quizForm.testPurpose.replace('_', ' ')}
            </span>
            <span className="px-3 py-1 bg-simmonds-lime/10 text-simmonds-lime-dark rounded-full text-sm">
              {quizForm.skillFocus}
            </span>
            {quizForm.isCambridgeAligned && (
              <span className="px-3 py-1 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-full text-sm">
                Cambridge Aligned
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-simmonds-cream pt-4">
          <h4 className="font-semibold text-simmonds-charcoal mb-2">Question Summary</h4>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center justify-between text-sm">
                <span className="text-simmonds-charcoal">
                  {i + 1}. {q.questionText.substring(0, 50)}{q.questionText.length > 50 ? '...' : ''}
                </span>
                <span className="text-simmonds-stone">{q.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setStep('questions')}
          className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
        >
          Back to Questions
        </button>
        <button
          onClick={handleSaveQuiz}
          disabled={isSaving}
          className="px-6 py-2 bg-simmonds-lime text-white rounded-xl font-medium hover:bg-simmonds-lime-dark disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Quiz'}
        </button>
      </div>
    </div>
  );

  const renderQuestionModal = () => {
    if (!showQuestionModal || !editingQuestion) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-simmonds-cream">
            <h3 className="text-lg font-semibold text-simmonds-charcoal">
              {questions.find(q => q.id === editingQuestion.id) ? 'Edit Question' : 'Add Question'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Question Type</label>
                <select
                  value={editingQuestion.questionType}
                  onChange={(e) => setEditingQuestion({
                    ...editingQuestion,
                    questionType: e.target.value as QuestionType,
                    options: e.target.value === 'multiple_choice' ? ['', '', '', ''] :
                             e.target.value === 'true_false' ? ['True', 'False'] : [],
                  })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="fill_in_blank">Fill in the Blank</option>
                  <option value="true_false">True/False</option>
                  <option value="listening">Listening</option>
                  <option value="reading_comprehension">Reading Comprehension</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Skill</label>
                <select
                  value={editingQuestion.skill}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, skill: e.target.value as Skill })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="grammar">Grammar</option>
                  <option value="vocabulary">Vocabulary</option>
                  <option value="reading">Reading</option>
                  <option value="listening">Listening</option>
                  <option value="writing">Writing</option>
                  <option value="speaking">Speaking</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Difficulty</label>
                <select
                  value={editingQuestion.difficulty}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as Difficulty })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Points</label>
                <input
                  type="number"
                  value={editingQuestion.points}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, points: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  min="1"
                  max="10"
                />
              </div>
            </div>

            {editingQuestion.questionType === 'reading_comprehension' && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Reading Passage</label>
                <textarea
                  value={editingQuestion.readingPassage || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, readingPassage: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-32"
                  placeholder="Enter the reading passage..."
                />
              </div>
            )}

            {editingQuestion.questionType === 'listening' && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Audio URL</label>
                <input
                  type="url"
                  value={editingQuestion.audioUrl || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, audioUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  placeholder="https://..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Question Text *</label>
              <textarea
                value={editingQuestion.questionText}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
                placeholder="Enter your question..."
              />
            </div>

            {(editingQuestion.questionType === 'multiple_choice' || editingQuestion.questionType === 'listening' || editingQuestion.questionType === 'reading_comprehension') && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Answer Options</label>
                {(editingQuestion.options || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={editingQuestion.correctAnswer === option && option !== ''}
                      onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: option })}
                      className="w-4 h-4 text-simmonds-primary"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...(editingQuestion.options || [])];
                        newOptions[index] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOptions });
                      }}
                      className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                      placeholder={`Option ${index + 1}`}
                    />
                    {(editingQuestion.options || []).length > 2 && (
                      <button
                        onClick={() => {
                          const newOptions = (editingQuestion.options || []).filter((_, i) => i !== index);
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                {(editingQuestion.options || []).length < 6 && (
                  <button
                    onClick={() => setEditingQuestion({
                      ...editingQuestion,
                      options: [...(editingQuestion.options || []), '']
                    })}
                    className="text-sm text-simmonds-primary hover:underline"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            )}

            {editingQuestion.questionType === 'true_false' && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Correct Answer</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tfAnswer"
                      checked={editingQuestion.correctAnswer === 'True'}
                      onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: 'True' })}
                      className="w-4 h-4 text-simmonds-primary"
                    />
                    <span className="ml-2">True</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tfAnswer"
                      checked={editingQuestion.correctAnswer === 'False'}
                      onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: 'False' })}
                      className="w-4 h-4 text-simmonds-primary"
                    />
                    <span className="ml-2">False</span>
                  </label>
                </div>
              </div>
            )}

            {editingQuestion.questionType === 'fill_in_blank' && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Correct Answer *</label>
                <input
                  type="text"
                  value={editingQuestion.correctAnswer as string}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  placeholder="Enter the correct answer"
                />
                <p className="text-xs text-simmonds-stone mt-1">
                  Use ___ in the question text to indicate the blank
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Explanation (optional)</label>
              <textarea
                value={editingQuestion.explanation || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-20"
                placeholder="Explain why this answer is correct..."
              />
            </div>
          </div>

          <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
            <button
              onClick={() => {
                setShowQuestionModal(false);
                setEditingQuestion(null);
              }}
              className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveQuestion}
              disabled={!editingQuestion.questionText || !editingQuestion.correctAnswer}
              className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Question
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAIModal = () => {
    if (!showAIModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full">
          <div className="p-6 border-b border-simmonds-cream">
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Generate Questions with AI</h3>
            <p className="text-sm text-simmonds-stone">Use AI to automatically generate quiz questions</p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Number of Questions</label>
              <input
                type="number"
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(parseInt(e.target.value) || 5)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                min="1"
                max="20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Additional Instructions (optional)
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
                placeholder="e.g., Focus on past tense, include vocabulary about travel..."
              />
            </div>

            <div className="bg-simmonds-cream/50 p-4 rounded-xl">
              <p className="text-sm text-simmonds-charcoal">
                <strong>Test Settings:</strong>
              </p>
              <p className="text-sm text-simmonds-stone">
                Level: {quizForm.level} | Skill Focus: {quizForm.skillFocus} | Purpose: {quizForm.testPurpose.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAIModal(false);
                setAiPrompt('');
              }}
              className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
              className="px-6 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light disabled:opacity-50 flex items-center gap-2"
            >
              {isGeneratingAI ? (
                <>
                  <span className="animate-spin">...</span>
                  Generating...
                </>
              ) : (
                'Generate Questions'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step === 'details' ? 'bg-simmonds-primary text-white' : 'bg-simmonds-lime text-white'
            }`}
          >
            1
          </div>
          <span className="ml-2 text-sm font-medium text-simmonds-charcoal">Details</span>
        </div>
        <div className={`w-16 h-1 mx-4 ${step === 'details' ? 'bg-simmonds-cream' : 'bg-simmonds-lime'}`} />
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step === 'questions' ? 'bg-simmonds-primary text-white' :
              step === 'preview' ? 'bg-simmonds-lime text-white' : 'bg-simmonds-cream text-simmonds-stone'
            }`}
          >
            2
          </div>
          <span className="ml-2 text-sm font-medium text-simmonds-charcoal">Questions</span>
        </div>
        <div className={`w-16 h-1 mx-4 ${step === 'preview' ? 'bg-simmonds-lime' : 'bg-simmonds-cream'}`} />
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step === 'preview' ? 'bg-simmonds-primary text-white' : 'bg-simmonds-cream text-simmonds-stone'
            }`}
          >
            3
          </div>
          <span className="ml-2 text-sm font-medium text-simmonds-charcoal">Preview</span>
        </div>
      </div>

      {step === 'details' && renderDetailsStep()}
      {step === 'questions' && renderQuestionsStep()}
      {step === 'preview' && renderPreviewStep()}

      {renderQuestionModal()}
      {renderAIModal()}
    </div>
  );
};

export default QuizBuilder;
