import React, { useState } from 'react';
import { QuizGenerationConfig } from './AIQuizConfigForm';
import { GeneratedQuestion } from './QuestionEditor';
import QuestionEditor from './QuestionEditor';
import AudioPlayer from './AudioPlayer';

interface QuizReviewPanelProps {
  questions: GeneratedQuestion[];
  config: QuizGenerationConfig;
  onSave: (questions: GeneratedQuestion[]) => void;
  onBack: () => void;
  onRegenerateQuestion?: (index: number) => Promise<GeneratedQuestion | null>;
  onRegenerateAudio?: (script: string) => Promise<{ audioUrl: string; storageId: string } | null>;
  isRegenerating?: boolean;
}

const QuizReviewPanel: React.FC<QuizReviewPanelProps> = ({
  questions,
  config,
  onSave,
  onBack,
  onRegenerateQuestion,
  onRegenerateAudio,
  isRegenerating = false,
}) => {
  const [editedQuestions, setEditedQuestions] = useState<GeneratedQuestion[]>(questions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);

  const handleEditQuestion = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveQuestion = (question: GeneratedQuestion) => {
    const newQuestions = [...editedQuestions];
    if (editingIndex !== null) {
      newQuestions[editingIndex] = question;
      setEditedQuestions(newQuestions);
    }
    setEditingIndex(null);
  };

  const handleDeleteQuestion = (index: number) => {
    if (editedQuestions.length <= 1) {
      alert('Cannot delete the last question. A quiz must have at least one question.');
      return;
    }
    setEditedQuestions(editedQuestions.filter((_, i) => i !== index));
  };

  const handleRegenerateQuestion = async (index: number) => {
    if (!onRegenerateQuestion) return;

    setRegeneratingIndex(index);
    try {
      const newQuestion = await onRegenerateQuestion(index);
      if (newQuestion) {
        const newQuestions = [...editedQuestions];
        newQuestions[index] = newQuestion;
        setEditedQuestions(newQuestions);
      }
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleRegenerateAudio = async (script: string): Promise<{ audioUrl: string; storageId: string } | null> => {
    if (!onRegenerateAudio) return null;

    setIsRegeneratingAudio(true);
    try {
      return await onRegenerateAudio(script);
    } finally {
      setIsRegeneratingAudio(false);
    }
  };

  const getQuestionText = (q: GeneratedQuestion): string => {
    return (
      q.question ||
      q.statement ||
      q.instruction ||
      q.sentence ||
      q.prompt ||
      q.audioScript?.substring(0, 50) + '...' ||
      'No text'
    );
  };

  const getQuestionTypeLabel = (type: string): string => {
    return type
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getQuestionTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'multiple-choice': 'bg-blue-100 text-blue-800',
      'multiple-select': 'bg-indigo-100 text-indigo-800',
      'fill-blank': 'bg-purple-100 text-purple-800',
      'true-false': 'bg-green-100 text-green-800',
      'matching': 'bg-yellow-100 text-yellow-800',
      'ordering': 'bg-orange-100 text-orange-800',
      'short-answer': 'bg-pink-100 text-pink-800',
      'listening': 'bg-red-100 text-red-800',
      'speaking': 'bg-teal-100 text-teal-800',
      'image-based': 'bg-cyan-100 text-cyan-800',
      'video-based': 'bg-emerald-100 text-emerald-800',
      'cloze': 'bg-violet-100 text-violet-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-simmonds-charcoal">{config.title}</h2>
            <p className="text-sm text-simmonds-stone">
              Review and edit your generated questions before saving
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-full text-sm font-medium">
              {config.targetLevel}
            </span>
            <span className="px-3 py-1 bg-simmonds-olive/10 text-simmonds-olive rounded-full text-sm font-medium">
              {editedQuestions.length} Questions
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-simmonds-cream/50 rounded-xl">
            <p className="text-2xl font-bold text-simmonds-primary">{editedQuestions.length}</p>
            <p className="text-xs text-simmonds-stone">Questions</p>
          </div>
          <div className="text-center p-3 bg-simmonds-cream/50 rounded-xl">
            <p className="text-2xl font-bold text-simmonds-olive">{config.targetLevel}</p>
            <p className="text-xs text-simmonds-stone">CEFR Level</p>
          </div>
          <div className="text-center p-3 bg-simmonds-cream/50 rounded-xl">
            <p className="text-2xl font-bold text-simmonds-charcoal">
              {config.timeLimitMinutes || '∞'}
            </p>
            <p className="text-xs text-simmonds-stone">Minutes</p>
          </div>
          <div className="text-center p-3 bg-simmonds-cream/50 rounded-xl">
            <p className="text-2xl font-bold text-simmonds-stone">{config.questionTypes.length}</p>
            <p className="text-xs text-simmonds-stone">Question Types</p>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-simmonds-charcoal">Questions</h3>
        </div>

        <div className="space-y-3">
          {editedQuestions.map((question, index) => (
            <div
              key={index}
              className="border border-simmonds-cream rounded-xl p-4 hover:border-simmonds-stone/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-simmonds-primary text-white rounded text-xs font-medium">
                      Q{index + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getQuestionTypeColor(question.type)}`}
                    >
                      {getQuestionTypeLabel(question.type)}
                    </span>
                  </div>

                  {/* Question Text */}
                  <p className="text-simmonds-charcoal line-clamp-2">
                    {getQuestionText(question)}
                  </p>

                  {/* Audio Player for Listening Questions */}
                  {question.type === 'listening' && question.audioUrl && (
                    <div className="mt-3">
                      <AudioPlayer
                        audioUrl={question.audioUrl}
                        replaysAllowed={10}
                        compact
                      />
                    </div>
                  )}

                  {/* Options Preview */}
                  {question.options && question.options.length > 0 && (
                    <div className="mt-2 text-sm text-simmonds-stone">
                      <span className="font-medium">Options:</span>{' '}
                      {question.options.slice(0, 3).join(', ')}
                      {question.options.length > 3 && '...'}
                    </div>
                  )}

                  {/* Correct Answer Preview */}
                  {(question.correctAnswer !== undefined || question.correctAnswers) && (
                    <div className="mt-1 text-sm text-simmonds-olive">
                      <span className="font-medium">Answer:</span>{' '}
                      {question.correctAnswers
                        ? question.correctAnswers.map((i) => question.options?.[i]).join(', ')
                        : typeof question.correctAnswer === 'boolean'
                          ? question.correctAnswer ? 'True' : 'False'
                          : typeof question.correctAnswer === 'number'
                            ? question.options?.[question.correctAnswer] || question.correctAnswer
                            : question.correctAnswer}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditQuestion(index)}
                    className="p-2 text-simmonds-primary hover:bg-simmonds-primary/10 rounded-lg transition-colors"
                    title="Edit question"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {onRegenerateQuestion && (
                    <button
                      onClick={() => handleRegenerateQuestion(index)}
                      disabled={regeneratingIndex !== null || isRegenerating}
                      className={`p-2 rounded-lg transition-colors ${
                        regeneratingIndex === index
                          ? 'text-simmonds-stone'
                          : 'text-simmonds-olive hover:bg-simmonds-olive/10'
                      }`}
                      title="Regenerate question"
                    >
                      {regeneratingIndex === index ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteQuestion(index)}
                    className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg transition-colors"
                    title="Delete question"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {editedQuestions.length === 0 && (
          <div className="text-center py-12 text-simmonds-stone">
            <p>No questions to display. Go back and generate questions.</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Config
        </button>

        <button
          onClick={() => onSave(editedQuestions)}
          disabled={editedQuestions.length === 0}
          className={`
            px-6 py-2 rounded-xl font-medium text-white flex items-center gap-2
            ${editedQuestions.length === 0
              ? 'bg-simmonds-stone/50 cursor-not-allowed'
              : 'bg-simmonds-lime hover:bg-simmonds-lime-dark'
            }
          `}
        >
          Save Quiz
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Question Editor Modal */}
      {editingIndex !== null && editedQuestions[editingIndex] && (
        <QuestionEditor
          question={editedQuestions[editingIndex]}
          index={editingIndex}
          onSave={handleSaveQuestion}
          onCancel={() => setEditingIndex(null)}
          onRegenerateAudio={onRegenerateAudio ? handleRegenerateAudio : undefined}
          isRegeneratingAudio={isRegeneratingAudio}
        />
      )}
    </div>
  );
};

export default QuizReviewPanel;
