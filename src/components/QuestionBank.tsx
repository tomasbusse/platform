import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface QuestionBankProps {
  currentUser: User | null;
  company: Company | null;
}

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

interface Filters {
  skill: Skill | 'all';
  level: Level | 'all';
  questionType: QuestionType | 'all';
  difficulty: Difficulty | 'all';
  search: string;
}

const QuestionBank: React.FC<QuestionBankProps> = ({ currentUser, company }) => {
  const [filters, setFilters] = useState<Filters>({
    skill: 'all',
    level: 'all',
    questionType: 'all',
    difficulty: 'all',
    search: '',
  });
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  // Build query args based on filters
  const queryArgs = company?._id ? {
    companyId: company._id as Id<"companies">,
    ...(filters.skill !== 'all' && { skill: filters.skill }),
    ...(filters.level !== 'all' && { level: filters.level }),
    ...(filters.questionType !== 'all' && { questionType: filters.questionType }),
    ...(filters.difficulty !== 'all' && { difficulty: filters.difficulty }),
  } : 'skip';

  const questions = useQuery(
    api.quizzes.getQuestionsByFilters,
    queryArgs as any
  );

  const deleteQuestion = useMutation(api.quizzes.deleteQuestion);
  const updateQuestion = useMutation(api.quizzes.updateQuestion);

  const filteredQuestions = questions?.filter(q => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return q.questionText.toLowerCase().includes(searchLower) ||
             q.tags.some(t => t.toLowerCase().includes(searchLower));
    }
    return true;
  }) || [];

  const handleSelectAll = () => {
    if (selectedQuestions.length === filteredQuestions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filteredQuestions.map(q => q._id));
    }
  };

  const handleSelectQuestion = (questionId: string) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(selectedQuestions.filter(id => id !== questionId));
    } else {
      setSelectedQuestions([...selectedQuestions, questionId]);
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedQuestions.length} question(s)?`)) {
      return;
    }

    try {
      for (const questionId of selectedQuestions) {
        await deleteQuestion({ questionId: questionId as Id<"questionBank"> });
      }
      setSelectedQuestions([]);
      alert('Questions deleted successfully!');
    } catch (error) {
      console.error('Error deleting questions:', error);
      alert('Failed to delete some questions');
    }
  };

  const handleEditQuestion = (question: any) => {
    setEditingQuestion({ ...question });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;

    try {
      await updateQuestion({
        questionId: editingQuestion._id as Id<"questionBank">,
        questionText: editingQuestion.questionText,
        questionData: editingQuestion.questionData,
        difficulty: editingQuestion.difficulty,
        tags: editingQuestion.tags,
      });
      setShowEditModal(false);
      setEditingQuestion(null);
      alert('Question updated successfully!');
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      await deleteQuestion({ questionId: questionId as Id<"questionBank"> });
      alert('Question deleted successfully!');
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  const getSkillColor = (skill: Skill) => {
    const colors: Record<Skill, string> = {
      grammar: 'bg-simmonds-primary/10 text-simmonds-primary',
      vocabulary: 'bg-simmonds-olive/10 text-simmonds-olive',
      reading: 'bg-simmonds-lime/10 text-simmonds-lime-dark',
      listening: 'bg-purple-100 text-purple-700',
      writing: 'bg-orange-100 text-orange-700',
      speaking: 'bg-pink-100 text-pink-700',
      pronunciation: 'bg-cyan-100 text-cyan-700',
    };
    return colors[skill] || 'bg-gray-100 text-gray-700';
  };

  const getDifficultyColor = (difficulty: Difficulty) => {
    const colors: Record<Difficulty, string> = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-700';
  };

  const stats = {
    total: questions?.length || 0,
    byLevel: questions?.reduce((acc, q) => {
      acc[q.level] = (acc[q.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {},
    bySkill: questions?.reduce((acc, q) => {
      acc[q.skill] = (acc[q.skill] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {},
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Total Questions</p>
          <p className="text-2xl font-bold text-simmonds-primary">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Grammar Questions</p>
          <p className="text-2xl font-bold text-simmonds-olive">{stats.bySkill.grammar || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Vocabulary Questions</p>
          <p className="text-2xl font-bold text-simmonds-lime-dark">{stats.bySkill.vocabulary || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Cambridge Aligned</p>
          <p className="text-2xl font-bold text-simmonds-terracotta">
            {questions?.filter(q => q.isCambridgeAligned).length || 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-simmonds-stone mb-1">Skill</label>
            <select
              value={filters.skill}
              onChange={(e) => setFilters({ ...filters, skill: e.target.value as Skill | 'all' })}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="all">All Skills</option>
              <option value="grammar">Grammar</option>
              <option value="vocabulary">Vocabulary</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing</option>
              <option value="speaking">Speaking</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-simmonds-stone mb-1">Level</label>
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value as Level | 'all' })}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="all">All Levels</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-simmonds-stone mb-1">Type</label>
            <select
              value={filters.questionType}
              onChange={(e) => setFilters({ ...filters, questionType: e.target.value as QuestionType | 'all' })}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="all">All Types</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="fill_in_blank">Fill in Blank</option>
              <option value="true_false">True/False</option>
              <option value="listening">Listening</option>
              <option value="reading_comprehension">Reading</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-simmonds-stone mb-1">Difficulty</label>
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value as Difficulty | 'all' })}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-simmonds-stone mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              placeholder="Search questions..."
            />
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      {selectedQuestions.length > 0 && (
        <div className="bg-simmonds-primary/10 p-4 rounded-xl flex items-center justify-between">
          <span className="text-simmonds-primary font-medium">
            {selectedQuestions.length} question{selectedQuestions.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedQuestions([])}
              className="px-4 py-2 text-simmonds-charcoal hover:bg-simmonds-cream rounded-xl"
            >
              Clear Selection
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-simmonds-terracotta text-white rounded-xl hover:bg-simmonds-terracotta-dark"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
        <div className="p-4 border-b border-simmonds-cream flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded"
              />
              <span className="ml-2 text-sm text-simmonds-stone">Select All</span>
            </label>
            <span className="text-sm text-simmonds-stone">
              Showing {filteredQuestions.length} of {stats.total} questions
            </span>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-simmonds-stone mb-2">No questions found</p>
            <p className="text-sm text-simmonds-stone">
              Create questions using the Quiz Builder or adjust your filters
            </p>
          </div>
        ) : (
          <div className="divide-y divide-simmonds-cream">
            {filteredQuestions.map((question) => (
              <div
                key={question._id}
                className="p-4 hover:bg-simmonds-cream-light/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(question._id)}
                    onChange={() => handleSelectQuestion(question._id)}
                    className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded mt-1"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSkillColor(question.skill)}`}>
                        {question.skill}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-cream text-simmonds-stone rounded text-xs">
                        {question.level}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-cream text-simmonds-stone rounded text-xs">
                        {question.questionType.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(question.difficulty)}`}>
                        {question.difficulty}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-lime/10 text-simmonds-lime-dark rounded text-xs">
                        {question.points} pt{question.points !== 1 ? 's' : ''}
                      </span>
                      {question.isCambridgeAligned && (
                        <span className="px-2 py-0.5 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded text-xs">
                          Cambridge
                        </span>
                      )}
                    </div>

                    <p className="text-simmonds-charcoal mb-2">{question.questionText}</p>

                    {question.questionData?.options && (
                      <div className="text-sm text-simmonds-stone mb-2">
                        Options: {question.questionData.options.join(' | ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {question.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-simmonds-cream text-simmonds-stone rounded-full text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-simmonds-stone">
                          Used {question.usageCount} time{question.usageCount !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => handleEditQuestion(question)}
                          className="text-simmonds-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(question._id)}
                          className="text-simmonds-terracotta hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-simmonds-cream">
              <h3 className="text-lg font-semibold text-simmonds-charcoal">Edit Question</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Question Text</label>
                <textarea
                  value={editingQuestion.questionText}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Difficulty</label>
                <select
                  value={editingQuestion.difficulty}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {editingQuestion.questionData?.options && (
                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Options</label>
                  {editingQuestion.questionData.options.map((option: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        checked={editingQuestion.questionData.correctAnswer === option}
                        onChange={() => setEditingQuestion({
                          ...editingQuestion,
                          questionData: { ...editingQuestion.questionData, correctAnswer: option }
                        })}
                        className="w-4 h-4 text-simmonds-primary"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...editingQuestion.questionData.options];
                          newOptions[index] = e.target.value;
                          setEditingQuestion({
                            ...editingQuestion,
                            questionData: { ...editingQuestion.questionData, options: newOptions }
                          });
                        }}
                        className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Explanation</label>
                <textarea
                  value={editingQuestion.questionData?.explanation || ''}
                  onChange={(e) => setEditingQuestion({
                    ...editingQuestion,
                    questionData: { ...editingQuestion.questionData, explanation: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-20"
                />
              </div>
            </div>

            <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingQuestion(null);
                }}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
