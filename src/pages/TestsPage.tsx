/**
 * TestsPage.tsx - Unified Tests Module
 *
 * This page consolidates the "Teaching" and "Take Test" navigation links into a single "Tests" section.
 *
 * Features:
 * - Test list view with + button to create new tests (for teachers)
 * - Test detail/edit interface via slide-out panel
 * - Question builder with multi-modal support (images, audio, video)
 * - Test taking functionality for students
 * - Analytics for teachers
 *
 * Created: November 28, 2025
 * Rollback: See docs/TESTS_MODULE_CHANGELOG.md
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';
import QuizBuilder from '../components/QuizBuilder';
import QuestionBank from '../components/QuestionBank';

interface TestsPageProps {
  currentUser: User | null;
  company: Company | null;
}

// Types
type ViewMode = 'list' | 'create' | 'edit' | 'preview' | 'take-test' | 'results' | 'question-bank' | 'analytics';
type TestStatus = 'draft' | 'published' | 'archived';

interface QuizData {
  _id: Id<"quizzes">;
  title: string;
  description?: string;
  instructions?: string;
  level: string;
  testPurpose: string;
  skillFocus: string;
  duration: number;
  passingScore: number;
  totalQuestions: number;
  totalPoints: number;
  status: TestStatus;
  isCambridgeAligned: boolean;
  cambridgeLevel?: string;
  settings?: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showCorrectAnswers: boolean;
    showExplanations: boolean;
    allowRetake: boolean;
    maxAttempts: number;
    requirePassingScore: boolean;
    showTimer: boolean;
    showProgressBar?: boolean;
    allowSkip?: boolean;
    allowReview?: boolean;
    autoSubmitOnTimeout?: boolean;
  };
  tags?: string[];
  questionIds?: Id<"questionBank">[];
  inlineQuestions?: any[];
  createdAt: number;
}

// Icon Components
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const QuestionIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const BankIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TestsPage: React.FC<TestsPageProps> = ({ currentUser, company }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPurpose, setFilterPurpose] = useState<string>('all');
  const [selectedTestId, setSelectedTestId] = useState<Id<"quizzes"> | null>(null);

  // Determine user role
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'corporate_admin';
  const isStudent = currentUser?.role === 'student';

  // Fetch quizzes based on role
  const quizzes = useQuery(
    api.quizzes.getCompanyQuizzes,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  // Fetch user's test sessions for students
  const userTestSessions = useQuery(
    api.testSessions.getUserTestSessions,
    currentUser?._id ? { userId: currentUser._id as Id<"users"> } : 'skip'
  );

  // Filter quizzes based on search and filters
  const filteredQuizzes = quizzes?.filter(quiz => {
    // For students, only show published tests
    if (isStudent && quiz.status !== 'published') return false;

    // Apply search filter
    if (searchQuery && !quiz.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Apply level filter
    if (filterLevel !== 'all' && quiz.level !== filterLevel) return false;

    // Apply status filter (teachers only)
    if (isTeacher && filterStatus !== 'all' && quiz.status !== filterStatus) return false;

    // Apply purpose filter
    if (filterPurpose !== 'all' && quiz.testPurpose !== filterPurpose) return false;

    return true;
  }) || [];

  // Published quizzes count for students
  const availableTestsCount = quizzes?.filter(q => q.status === 'published').length || 0;

  // Handle test actions
  const handleCreateTest = () => {
    setViewMode('create');
  };

  const handleViewQuestionBank = () => {
    setViewMode('question-bank');
  };

  const handleViewAnalytics = () => {
    setViewMode('analytics');
  };

  const handleTakeTest = (testId: Id<"quizzes">) => {
    setSelectedTestId(testId);
    setViewMode('take-test');
  };

  const handleEditTest = (testId: Id<"quizzes">) => {
    setSelectedTestId(testId);
    setViewMode('edit');
  };

  const handlePreviewTest = (testId: Id<"quizzes">) => {
    setSelectedTestId(testId);
    setViewMode('preview');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedTestId(null);
  };

  // Render test card component
  const renderTestCard = (quiz: QuizData) => {
    const completedSession = userTestSessions?.find(
      s => s.quizId === quiz._id && s.status === 'completed'
    );

    return (
      <div
        key={quiz._id}
        className="bg-white rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md hover:border-simmonds-primary/30 transition-all duration-200 overflow-hidden group"
      >
        {/* Card Header with Status Badge */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-simmonds-charcoal text-lg truncate group-hover:text-simmonds-primary transition-colors">
                {quiz.title}
              </h3>
              {quiz.description && (
                <p className="text-sm text-simmonds-stone mt-1 line-clamp-2">
                  {quiz.description}
                </p>
              )}
            </div>
            {isTeacher && (
              <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                quiz.status === 'published'
                  ? 'bg-simmonds-lime/20 text-simmonds-lime-dark'
                  : quiz.status === 'archived'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-simmonds-cream text-simmonds-stone'
              }`}>
                {quiz.status === 'published' ? 'Published' : quiz.status === 'archived' ? 'Archived' : 'Draft'}
              </span>
            )}
          </div>

          {/* Tags/Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2.5 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-lg text-xs font-medium">
              {quiz.level}
            </span>
            <span className="px-2.5 py-1 bg-simmonds-olive/10 text-simmonds-olive rounded-lg text-xs font-medium capitalize">
              {quiz.skillFocus}
            </span>
            {quiz.isCambridgeAligned && (
              <span className="px-2.5 py-1 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-lg text-xs font-medium">
                Cambridge
              </span>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-sm text-simmonds-stone">
            <div className="flex items-center gap-1.5">
              <QuestionIcon />
              <span>{quiz.totalQuestions} questions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClockIcon />
              <span>{quiz.duration} min</span>
            </div>
          </div>
        </div>

        {/* Card Footer with Actions */}
        <div className="px-5 py-3 bg-simmonds-cream/30 border-t border-simmonds-cream flex items-center justify-between">
          {isStudent ? (
            <>
              {completedSession ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-simmonds-lime-dark font-medium">
                    Score: {completedSession.score}%
                  </span>
                </div>
              ) : (
                <span className="text-sm text-simmonds-stone">Not attempted</span>
              )}
              <button
                onClick={() => handleTakeTest(quiz._id)}
                className="flex items-center gap-2 px-4 py-2 bg-simmonds-primary text-white rounded-xl text-sm font-medium hover:bg-simmonds-primary-light transition-colors"
              >
                <PlayIcon />
                {completedSession ? 'Retake' : 'Start Test'}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-simmonds-stone">
                {quiz.testPurpose.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePreviewTest(quiz._id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-simmonds-olive hover:bg-simmonds-olive/10 rounded-lg text-sm font-medium transition-colors"
                  title="Preview quiz"
                >
                  <EyeIcon />
                  Preview
                </button>
                {quiz.status !== 'published' && (
                  <button
                    onClick={() => handleEditTest(quiz._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-simmonds-primary hover:bg-simmonds-primary/10 rounded-lg text-sm font-medium transition-colors"
                    title="Edit quiz"
                  >
                    <EditIcon />
                    Edit
                  </button>
                )}
                {quiz.status === 'published' && (
                  <button
                    onClick={() => handleTakeTest(quiz._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-simmonds-primary text-white rounded-lg text-sm font-medium hover:bg-simmonds-primary-light transition-colors"
                    title="Take quiz as student would"
                  >
                    <PlayIcon />
                    Take
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render analytics view
  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
        >
          <BackIcon />
          Back to Tests
        </button>
        <h2 className="text-xl font-semibold text-simmonds-charcoal">Test Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone mb-1">Total Tests</p>
          <p className="text-3xl font-bold text-simmonds-primary">{quizzes?.length || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone mb-1">Published</p>
          <p className="text-3xl font-bold text-simmonds-lime-dark">
            {quizzes?.filter(q => q.status === 'published').length || 0}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone mb-1">Total Questions</p>
          <p className="text-3xl font-bold text-simmonds-olive">
            {quizzes?.reduce((sum, q) => sum + q.totalQuestions, 0) || 0}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone mb-1">Cambridge Aligned</p>
          <p className="text-3xl font-bold text-simmonds-terracotta">
            {quizzes?.filter(q => q.isCambridgeAligned).length || 0}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Tests by Level</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => {
            const count = quizzes?.filter(q => q.level === level).length || 0;
            const maxCount = Math.max(...(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l =>
              quizzes?.filter(q => q.level === l).length || 0
            )), 1);
            const heightPercent = (count / maxCount) * 100;

            return (
              <div key={level} className="text-center">
                <div className="h-24 bg-simmonds-cream/50 rounded-xl flex items-end justify-center p-2">
                  <div
                    className="bg-gradient-to-t from-simmonds-primary to-simmonds-primary-light rounded-lg w-10 transition-all duration-300"
                    style={{ height: `${Math.max(heightPercent, 10)}%` }}
                  />
                </div>
                <p className="mt-2 font-semibold text-simmonds-charcoal">{level}</p>
                <p className="text-sm text-simmonds-stone">{count} test{count !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Tests by Purpose</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: 'placement', label: 'Placement', color: 'simmonds-primary' },
            { key: 'follow_up', label: 'Follow-up', color: 'simmonds-olive' },
            { key: 'practice', label: 'Practice', color: 'simmonds-lime-dark' },
            { key: 'level_assessment', label: 'Level Assessment', color: 'simmonds-terracotta' },
            { key: 'diagnostic', label: 'Diagnostic', color: 'simmonds-stone' },
            { key: 'certification', label: 'Certification', color: 'simmonds-primary-dark' },
          ].map(({ key, label, color }) => {
            const count = quizzes?.filter(q => q.testPurpose === key).length || 0;
            return (
              <div key={key} className="flex items-center justify-between p-3 bg-simmonds-cream/30 rounded-xl">
                <span className="text-sm text-simmonds-charcoal">{label}</span>
                <span className={`text-lg font-bold text-${color}`}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Render question bank view
  const renderQuestionBank = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
        >
          <BackIcon />
          Back to Tests
        </button>
        <h2 className="text-xl font-semibold text-simmonds-charcoal">Question Bank</h2>
      </div>
      <QuestionBank currentUser={currentUser} company={company} />
    </div>
  );

  // Render create test view
  const renderCreateTest = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
        >
          <BackIcon />
          Back to Tests
        </button>
        <h2 className="text-xl font-semibold text-simmonds-charcoal">Create New Test</h2>
      </div>
      <QuizBuilder
        currentUser={currentUser}
        company={company}
        onQuizCreated={(quizId) => {
          console.log('Quiz created:', quizId);
          setViewMode('list');
        }}
      />
    </div>
  );

  // Render take test view (placeholder - would integrate with existing test taking functionality)
  const renderTakeTest = () => {
    const selectedQuiz = quizzes?.find(q => q._id === selectedTestId);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
          >
            <BackIcon />
            Back to Tests
          </button>
          <h2 className="text-xl font-semibold text-simmonds-charcoal">
            {selectedQuiz?.title || 'Take Test'}
          </h2>
        </div>

        {selectedQuiz ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-simmonds-cream max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-simmonds-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PlayIcon />
              </div>
              <h3 className="text-2xl font-semibold text-simmonds-charcoal mb-2">{selectedQuiz.title}</h3>
              <p className="text-simmonds-stone">{selectedQuiz.description}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 bg-simmonds-primary/5 rounded-xl">
                <p className="text-sm text-simmonds-stone">Level</p>
                <p className="text-xl font-bold text-simmonds-primary">{selectedQuiz.level}</p>
              </div>
              <div className="text-center p-4 bg-simmonds-olive/10 rounded-xl">
                <p className="text-sm text-simmonds-stone">Questions</p>
                <p className="text-xl font-bold text-simmonds-olive">{selectedQuiz.totalQuestions}</p>
              </div>
              <div className="text-center p-4 bg-simmonds-lime/10 rounded-xl">
                <p className="text-sm text-simmonds-stone">Duration</p>
                <p className="text-xl font-bold text-simmonds-lime-dark">{selectedQuiz.duration} min</p>
              </div>
              <div className="text-center p-4 bg-simmonds-cream rounded-xl">
                <p className="text-sm text-simmonds-stone">Passing</p>
                <p className="text-xl font-bold text-simmonds-charcoal">{selectedQuiz.passingScore}%</p>
              </div>
            </div>

            <div className="bg-simmonds-cream-light border border-simmonds-cream rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-simmonds-charcoal mb-2">Important Information</h4>
              <ul className="text-sm text-simmonds-stone space-y-1">
                <li>- Ensure you have a stable internet connection</li>
                <li>- Find a quiet environment to take the test</li>
                <li>- You will have {selectedQuiz.duration} minutes to complete</li>
                <li>- Your progress will be saved automatically</li>
              </ul>
            </div>

            <div className="text-center">
              <button
                onClick={() => alert('Test taking functionality coming soon. Please use the existing Take Test feature from the navigation.')}
                className="px-8 py-3 bg-simmonds-primary text-white rounded-xl font-semibold hover:bg-simmonds-primary-light transition-colors"
              >
                Begin Test
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-simmonds-stone">Test not found</p>
          </div>
        )}
      </div>
    );
  };

  // Render edit test view
  const renderEditTest = () => {
    const selectedQuiz = quizzes?.find(q => q._id === selectedTestId) as QuizData | undefined;

    if (!selectedQuiz) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
            >
              <BackIcon />
              Back to Tests
            </button>
          </div>
          <div className="text-center py-12">
            <p className="text-simmonds-stone">Test not found</p>
          </div>
        </div>
      );
    }

    if (selectedQuiz.status === 'published') {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
            >
              <BackIcon />
              Back to Tests
            </button>
            <h2 className="text-xl font-semibold text-simmonds-charcoal">Edit Test</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream p-8 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-simmonds-terracotta/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-simmonds-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal mb-2">Cannot Edit Published Test</h3>
            <p className="text-simmonds-stone mb-6">
              Published tests cannot be edited directly. You can archive this test and create a new version, or duplicate it to make changes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleBackToList}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light transition-colors"
              >
                Back to List
              </button>
              <button
                onClick={() => handlePreviewTest(selectedQuiz._id)}
                className="px-6 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light transition-colors"
              >
                Preview Instead
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
          >
            <BackIcon />
            Back to Tests
          </button>
          <h2 className="text-xl font-semibold text-simmonds-charcoal">Edit Test: {selectedQuiz.title}</h2>
        </div>
        <QuizBuilder
          currentUser={currentUser}
          company={company}
          editingQuiz={selectedQuiz}
          onQuizCreated={(quizId) => {
            console.log('Quiz updated:', quizId);
            setViewMode('list');
            setSelectedTestId(null);
          }}
        />
      </div>
    );
  };

  // Render preview test view
  const renderPreviewTest = () => {
    const selectedQuiz = quizzes?.find(q => q._id === selectedTestId) as QuizData | undefined;

    if (!selectedQuiz) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
            >
              <BackIcon />
              Back to Tests
            </button>
          </div>
          <div className="text-center py-12">
            <p className="text-simmonds-stone">Test not found</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary-dark"
            >
              <BackIcon />
              Back to Tests
            </button>
            <h2 className="text-xl font-semibold text-simmonds-charcoal">Preview: {selectedQuiz.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              selectedQuiz.status === 'published'
                ? 'bg-simmonds-lime/20 text-simmonds-lime-dark'
                : selectedQuiz.status === 'archived'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-simmonds-cream text-simmonds-stone'
            }`}>
              {selectedQuiz.status === 'published' ? 'Published' : selectedQuiz.status === 'archived' ? 'Archived' : 'Draft'}
            </span>
            {selectedQuiz.status !== 'published' && (
              <button
                onClick={() => handleEditTest(selectedQuiz._id)}
                className="flex items-center gap-1.5 px-4 py-2 text-simmonds-primary hover:bg-simmonds-primary/10 rounded-xl text-sm font-medium transition-colors"
              >
                <EditIcon />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Quiz Overview Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-simmonds-primary/10 to-simmonds-olive/10 p-6 border-b border-simmonds-cream">
            <h3 className="text-2xl font-bold text-simmonds-charcoal mb-2">{selectedQuiz.title}</h3>
            {selectedQuiz.description && (
              <p className="text-simmonds-stone">{selectedQuiz.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-lg text-sm font-medium">
                {selectedQuiz.level}
              </span>
              <span className="px-3 py-1 bg-simmonds-olive/10 text-simmonds-olive rounded-lg text-sm font-medium capitalize">
                {selectedQuiz.skillFocus}
              </span>
              <span className="px-3 py-1 bg-simmonds-cream text-simmonds-stone rounded-lg text-sm font-medium capitalize">
                {selectedQuiz.testPurpose.replace('_', ' ')}
              </span>
              {selectedQuiz.isCambridgeAligned && (
                <span className="px-3 py-1 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-lg text-sm font-medium">
                  Cambridge Aligned
                </span>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            <div className="text-center p-4 bg-simmonds-primary/5 rounded-xl">
              <p className="text-sm text-simmonds-stone mb-1">Questions</p>
              <p className="text-2xl font-bold text-simmonds-primary">{selectedQuiz.totalQuestions}</p>
            </div>
            <div className="text-center p-4 bg-simmonds-olive/10 rounded-xl">
              <p className="text-sm text-simmonds-stone mb-1">Total Points</p>
              <p className="text-2xl font-bold text-simmonds-olive">{selectedQuiz.totalPoints || 0}</p>
            </div>
            <div className="text-center p-4 bg-simmonds-lime/10 rounded-xl">
              <p className="text-sm text-simmonds-stone mb-1">Duration</p>
              <p className="text-2xl font-bold text-simmonds-lime-dark">{selectedQuiz.duration} min</p>
            </div>
            <div className="text-center p-4 bg-simmonds-cream rounded-xl">
              <p className="text-sm text-simmonds-stone mb-1">Passing Score</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{selectedQuiz.passingScore}%</p>
            </div>
          </div>

          {/* Instructions */}
          {selectedQuiz.instructions && (
            <div className="px-6 pb-4">
              <h4 className="font-semibold text-simmonds-charcoal mb-2">Instructions</h4>
              <div className="bg-simmonds-cream/50 p-4 rounded-xl">
                <p className="text-simmonds-stone whitespace-pre-wrap">{selectedQuiz.instructions}</p>
              </div>
            </div>
          )}

          {/* Settings */}
          {selectedQuiz.settings && (
            <div className="px-6 pb-6">
              <h4 className="font-semibold text-simmonds-charcoal mb-3">Quiz Settings</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {selectedQuiz.settings.shuffleQuestions && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Shuffle Questions</span>
                  </div>
                )}
                {selectedQuiz.settings.shuffleOptions && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Shuffle Options</span>
                  </div>
                )}
                {selectedQuiz.settings.showCorrectAnswers && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Show Correct Answers</span>
                  </div>
                )}
                {selectedQuiz.settings.showExplanations && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Show Explanations</span>
                  </div>
                )}
                {selectedQuiz.settings.allowRetake && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Allow Retakes ({selectedQuiz.settings.maxAttempts} max)</span>
                  </div>
                )}
                {selectedQuiz.settings.showTimer && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Show Timer</span>
                  </div>
                )}
                {selectedQuiz.settings.showProgressBar && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Show Progress Bar</span>
                  </div>
                )}
                {selectedQuiz.settings.allowSkip && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Allow Skip</span>
                  </div>
                )}
                {selectedQuiz.settings.allowReview && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Allow Review</span>
                  </div>
                )}
                {selectedQuiz.settings.autoSubmitOnTimeout && (
                  <div className="flex items-center gap-2 text-sm text-simmonds-stone">
                    <CheckCircleIcon />
                    <span>Auto-submit on Timeout</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {selectedQuiz.tags && selectedQuiz.tags.length > 0 && (
            <div className="px-6 pb-6">
              <h4 className="font-semibold text-simmonds-charcoal mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {selectedQuiz.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Questions Summary */}
          <div className="border-t border-simmonds-cream p-6">
            <h4 className="font-semibold text-simmonds-charcoal mb-4">
              Questions ({selectedQuiz.totalQuestions})
            </h4>
            {selectedQuiz.totalQuestions === 0 ? (
              <div className="text-center py-8 bg-simmonds-cream/30 rounded-xl">
                <p className="text-simmonds-stone mb-2">No questions added yet</p>
                {selectedQuiz.status !== 'published' && (
                  <button
                    onClick={() => handleEditTest(selectedQuiz._id)}
                    className="text-simmonds-primary hover:underline text-sm"
                  >
                    Add questions
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-simmonds-cream/30 rounded-xl p-4">
                <p className="text-sm text-simmonds-stone">
                  This quiz contains {selectedQuiz.totalQuestions} question{selectedQuiz.totalQuestions !== 1 ? 's' : ''}
                  {selectedQuiz.totalPoints ? ` worth ${selectedQuiz.totalPoints} total points` : ''}.
                </p>
                {selectedQuiz.inlineQuestions && selectedQuiz.inlineQuestions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {selectedQuiz.inlineQuestions.slice(0, 5).map((q: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary rounded text-xs">
                          Q{i + 1}
                        </span>
                        <span className="text-simmonds-charcoal truncate flex-1">
                          {q.questionText || 'Untitled question'}
                        </span>
                        <span className="text-simmonds-stone text-xs">
                          {q.points || 1} pt{(q.points || 1) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                    {selectedQuiz.inlineQuestions.length > 5 && (
                      <p className="text-xs text-simmonds-stone mt-2">
                        + {selectedQuiz.inlineQuestions.length - 5} more questions
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-simmonds-cream p-6 bg-simmonds-cream/20">
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={handleBackToList}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-white transition-colors"
              >
                Back to List
              </button>
              {selectedQuiz.status !== 'published' && (
                <button
                  onClick={() => handleEditTest(selectedQuiz._id)}
                  className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light transition-colors"
                >
                  Edit Quiz
                </button>
              )}
              {selectedQuiz.status === 'published' && (
                <button
                  onClick={() => handleTakeTest(selectedQuiz._id)}
                  className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light transition-colors flex items-center gap-2"
                >
                  <PlayIcon />
                  Take Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render main list view
  const renderListView = () => (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-simmonds-charcoal">Tests</h1>
          <p className="text-simmonds-stone mt-1">
            {isStudent
              ? `${availableTestsCount} test${availableTestsCount !== 1 ? 's' : ''} available`
              : 'Create and manage assessments'
            }
          </p>
        </div>

        {isTeacher && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleViewAnalytics}
              className="flex items-center gap-2 px-4 py-2.5 bg-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-dark transition-colors"
            >
              <ChartIcon />
              Analytics
            </button>
            <button
              onClick={handleViewQuestionBank}
              className="flex items-center gap-2 px-4 py-2.5 bg-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-dark transition-colors"
            >
              <BankIcon />
              Question Bank
            </button>
            <button
              onClick={handleCreateTest}
              className="flex items-center gap-2 px-4 py-2.5 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light transition-colors"
            >
              <PlusIcon />
              New Test
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-simmonds-stone">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-4 py-2.5 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary bg-white"
            >
              <option value="all">All Levels</option>
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Proficient</option>
              <option value="mixed">Mixed</option>
            </select>

            <select
              value={filterPurpose}
              onChange={(e) => setFilterPurpose(e.target.value)}
              className="px-4 py-2.5 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary bg-white"
            >
              <option value="all">All Types</option>
              <option value="placement">Placement</option>
              <option value="follow_up">Follow-up</option>
              <option value="practice">Practice</option>
              <option value="level_assessment">Level Assessment</option>
              <option value="diagnostic">Diagnostic</option>
              <option value="certification">Certification</option>
            </select>

            {isTeacher && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary bg-white"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Test Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream p-12 text-center">
          {searchQuery || filterLevel !== 'all' || filterPurpose !== 'all' || filterStatus !== 'all' ? (
            <>
              <p className="text-simmonds-stone mb-4">No tests match your search criteria</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterLevel('all');
                  setFilterPurpose('all');
                  setFilterStatus('all');
                }}
                className="text-simmonds-primary hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-simmonds-cream rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QuestionIcon />
              </div>
              <p className="text-simmonds-stone mb-4">
                {isStudent ? 'No tests available yet' : 'No tests created yet'}
              </p>
              {isTeacher && (
                <button
                  onClick={handleCreateTest}
                  className="px-6 py-2.5 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light transition-colors"
                >
                  Create Your First Test
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map(quiz => renderTestCard(quiz as unknown as QuizData))}
        </div>
      )}
    </>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {viewMode === 'list' && renderListView()}
      {viewMode === 'create' && renderCreateTest()}
      {viewMode === 'edit' && renderEditTest()}
      {viewMode === 'preview' && renderPreviewTest()}
      {viewMode === 'question-bank' && renderQuestionBank()}
      {viewMode === 'analytics' && renderAnalytics()}
      {viewMode === 'take-test' && renderTakeTest()}
    </div>
  );
};

export default TestsPage;
