import React, { useState } from 'react';
import { QuestionType } from './QuestionTypeSelector';
import AudioPlayer from './AudioPlayer';

export interface GeneratedQuestion {
  type: QuestionType;
  // Common fields
  question?: string;
  statement?: string;
  instruction?: string;
  sentence?: string;
  prompt?: string;
  passage?: string;
  explanation?: string;

  // Multiple choice / select
  options?: string[];
  correctAnswer?: number | number[] | boolean | string;
  correctAnswers?: number[];

  // Fill blank
  acceptableAnswers?: string[];

  // Matching
  pairs?: Array<{ left: string; right: string }>;

  // Ordering
  items?: string[];
  correctOrder?: string[];

  // Cloze
  blanks?: Array<{
    id: number;
    correctAnswer: string;
    acceptableAnswers?: string[];
  }>;

  // Listening
  audioScript?: string;
  audioUrl?: string;
  audioStorageId?: string;
  audioWordCount?: number;
  questions?: Array<{
    question: string;
    type: string;
    options: string[];
    correctAnswer: number;
  }>;

  // Speaking / Short answer
  sampleAnswer?: string;
  sampleResponse?: string;
  gradingCriteria?: string[];

  // Image / Video based
  imageDescription?: string;
  imageKeywords?: string[];
  videoDescription?: string;
  responseType?: string;
}

interface QuestionEditorProps {
  question: GeneratedQuestion;
  index: number;
  onSave: (question: GeneratedQuestion) => void;
  onCancel: () => void;
  onRegenerateAudio?: (script: string) => Promise<{ audioUrl: string; storageId: string } | null>;
  isRegeneratingAudio?: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  onSave,
  onCancel,
  onRegenerateAudio,
  isRegeneratingAudio = false,
}) => {
  const [editedQuestion, setEditedQuestion] = useState<GeneratedQuestion>({ ...question });
  const [audioScriptChanged, setAudioScriptChanged] = useState(false);

  const updateField = <K extends keyof GeneratedQuestion>(
    field: K,
    value: GeneratedQuestion[K]
  ) => {
    setEditedQuestion((prev) => ({ ...prev, [field]: value }));
    if (field === 'audioScript') {
      setAudioScriptChanged(true);
    }
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[optionIndex] = value;
    updateField('options', newOptions);
  };

  const updatePair = (pairIndex: number, side: 'left' | 'right', value: string) => {
    const newPairs = [...(editedQuestion.pairs || [])];
    newPairs[pairIndex] = { ...newPairs[pairIndex], [side]: value };
    updateField('pairs', newPairs);
  };

  const updateBlank = (blankIndex: number, value: string) => {
    const newBlanks = [...(editedQuestion.blanks || [])];
    newBlanks[blankIndex] = { ...newBlanks[blankIndex], correctAnswer: value };
    updateField('blanks', newBlanks);
  };

  const updateListeningSubQuestion = (qIndex: number, field: string, value: unknown) => {
    const newQuestions = [...(editedQuestion.questions || [])];
    newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
    updateField('questions', newQuestions);
  };

  const handleSave = async () => {
    // If audio script changed and we have a regenerate function, regenerate audio
    if (audioScriptChanged && editedQuestion.audioScript && onRegenerateAudio) {
      const result = await onRegenerateAudio(editedQuestion.audioScript);
      if (result) {
        onSave({
          ...editedQuestion,
          audioUrl: result.audioUrl,
          audioStorageId: result.storageId,
        });
        return;
      }
    }
    onSave(editedQuestion);
  };

  const getQuestionText = (): string => {
    return (
      editedQuestion.question ||
      editedQuestion.statement ||
      editedQuestion.instruction ||
      editedQuestion.sentence ||
      editedQuestion.prompt ||
      ''
    );
  };

  const setQuestionText = (value: string) => {
    if (editedQuestion.question !== undefined) updateField('question', value);
    else if (editedQuestion.statement !== undefined) updateField('statement', value);
    else if (editedQuestion.instruction !== undefined) updateField('instruction', value);
    else if (editedQuestion.sentence !== undefined) updateField('sentence', value);
    else if (editedQuestion.prompt !== undefined) updateField('prompt', value);
    else updateField('question', value);
  };

  const renderTypeSpecificEditor = () => {
    switch (editedQuestion.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Question Text
              </label>
              <textarea
                value={getQuestionText()}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Options (select correct answer)
              </label>
              {(editedQuestion.options || []).map((option, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={editedQuestion.correctAnswer === i}
                    onChange={() => updateField('correctAnswer', i)}
                    className="w-4 h-4 text-simmonds-primary"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(i, e.target.value)}
                    className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    placeholder={`Option ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'multiple-select':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Question Text
              </label>
              <textarea
                value={getQuestionText()}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Options (check all correct answers)
              </label>
              {(editedQuestion.options || []).map((option, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={(editedQuestion.correctAnswers || []).includes(i)}
                    onChange={(e) => {
                      const current = editedQuestion.correctAnswers || [];
                      if (e.target.checked) {
                        updateField('correctAnswers', [...current, i]);
                      } else {
                        updateField('correctAnswers', current.filter((x) => x !== i));
                      }
                    }}
                    className="w-4 h-4 text-simmonds-primary rounded"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(i, e.target.value)}
                    className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'fill-blank':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Sentence (use _____ for blank)
              </label>
              <textarea
                value={editedQuestion.sentence || ''}
                onChange={(e) => updateField('sentence', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Correct Answer
              </label>
              <input
                type="text"
                value={String(editedQuestion.correctAnswer || '')}
                onChange={(e) => updateField('correctAnswer', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              />
            </div>
          </div>
        );

      case 'true-false':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Statement
              </label>
              <textarea
                value={editedQuestion.statement || ''}
                onChange={(e) => updateField('statement', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Correct Answer
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tfAnswer"
                    checked={editedQuestion.correctAnswer === true}
                    onChange={() => updateField('correctAnswer', true)}
                    className="w-4 h-4 text-simmonds-primary"
                  />
                  True
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tfAnswer"
                    checked={editedQuestion.correctAnswer === false}
                    onChange={() => updateField('correctAnswer', false)}
                    className="w-4 h-4 text-simmonds-primary"
                  />
                  False
                </label>
              </div>
            </div>
          </div>
        );

      case 'matching':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Instruction
              </label>
              <input
                type="text"
                value={editedQuestion.instruction || ''}
                onChange={(e) => updateField('instruction', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Matching Pairs
              </label>
              {(editedQuestion.pairs || []).map((pair, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => updatePair(i, 'left', e.target.value)}
                    className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    placeholder="Left item"
                  />
                  <span className="text-simmonds-stone">↔</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => updatePair(i, 'right', e.target.value)}
                    className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    placeholder="Right item"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'ordering':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Instruction
              </label>
              <input
                type="text"
                value={editedQuestion.instruction || ''}
                onChange={(e) => updateField('instruction', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Items (in correct order)
              </label>
              {(editedQuestion.correctOrder || editedQuestion.items || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-8 text-center text-simmonds-stone">{i + 1}.</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newOrder = [...(editedQuestion.correctOrder || editedQuestion.items || [])];
                      newOrder[i] = e.target.value;
                      updateField('correctOrder', newOrder);
                    }}
                    className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'short-answer':
      case 'speaking':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                {editedQuestion.type === 'speaking' ? 'Prompt' : 'Question'}
              </label>
              <textarea
                value={editedQuestion.prompt || editedQuestion.question || ''}
                onChange={(e) => updateField(editedQuestion.type === 'speaking' ? 'prompt' : 'question', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Sample {editedQuestion.type === 'speaking' ? 'Response' : 'Answer'}
              </label>
              <textarea
                value={editedQuestion.sampleResponse || editedQuestion.sampleAnswer || ''}
                onChange={(e) => updateField(editedQuestion.type === 'speaking' ? 'sampleResponse' : 'sampleAnswer', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Grading Criteria (one per line)
              </label>
              <textarea
                value={(editedQuestion.gradingCriteria || []).join('\n')}
                onChange={(e) => updateField('gradingCriteria', e.target.value.split('\n').filter(Boolean))}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>
          </div>
        );

      case 'listening':
        return (
          <div className="space-y-4">
            {editedQuestion.audioUrl && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                  Current Audio
                </label>
                <AudioPlayer audioUrl={editedQuestion.audioUrl} replaysAllowed={10} compact />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Audio Script
                {audioScriptChanged && (
                  <span className="ml-2 text-xs text-simmonds-terracotta">
                    (will regenerate audio on save)
                  </span>
                )}
              </label>
              <textarea
                value={editedQuestion.audioScript || ''}
                onChange={(e) => updateField('audioScript', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-32"
              />
              <p className="text-xs text-simmonds-stone mt-1">
                Word count: {(editedQuestion.audioScript || '').trim().split(/\s+/).filter(Boolean).length}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Questions about the audio
              </label>
              {(editedQuestion.questions || []).map((q, i) => (
                <div key={i} className="border border-simmonds-cream rounded-xl p-4 mb-4">
                  <div className="mb-3">
                    <label className="block text-xs text-simmonds-stone mb-1">Question {i + 1}</label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => updateListeningSubQuestion(i, 'question', e.target.value)}
                      className="w-full px-3 py-2 border border-simmonds-cream rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    {q.options.map((opt, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`subq-${i}`}
                          checked={q.correctAnswer === j}
                          onChange={() => updateListeningSubQuestion(i, 'correctAnswer', j)}
                          className="w-3 h-3 text-simmonds-primary"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[j] = e.target.value;
                            updateListeningSubQuestion(i, 'options', newOpts);
                          }}
                          className="flex-1 px-3 py-1 border border-simmonds-cream rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'cloze':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Instruction
              </label>
              <input
                type="text"
                value={editedQuestion.instruction || ''}
                onChange={(e) => updateField('instruction', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Passage (use {`{{1}}, {{2}}`}, etc. for blanks)
              </label>
              <textarea
                value={editedQuestion.passage || ''}
                onChange={(e) => updateField('passage', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-32"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Blank Answers
              </label>
              {(editedQuestion.blanks || []).map((blank, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-12 text-simmonds-stone text-sm">{`{{${blank.id}}}`}</span>
                  <input
                    type="text"
                    value={blank.correctAnswer}
                    onChange={(e) => updateBlank(i, e.target.value)}
                    className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    placeholder="Correct answer"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'image-based':
      case 'video-based':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                {editedQuestion.type === 'image-based' ? 'Image' : 'Video'} Description
              </label>
              <textarea
                value={editedQuestion.type === 'image-based' ? editedQuestion.imageDescription : editedQuestion.videoDescription || ''}
                onChange={(e) => updateField(editedQuestion.type === 'image-based' ? 'imageDescription' : 'videoDescription', e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
                placeholder={`Describe the ${editedQuestion.type === 'image-based' ? 'image' : 'video'} content...`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Question
              </label>
              <textarea
                value={getQuestionText()}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              />
            </div>

            {editedQuestion.options && (
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                  Options
                </label>
                {editedQuestion.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      name="mediaAnswer"
                      checked={editedQuestion.correctAnswer === i}
                      onChange={() => updateField('correctAnswer', i)}
                      className="w-4 h-4 text-simmonds-primary"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-simmonds-stone">
            Editor not available for this question type.
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-simmonds-cream flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">
              Edit Question {index + 1}
            </h3>
            <p className="text-sm text-simmonds-stone capitalize">
              Type: {editedQuestion.type.replace('-', ' ')}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-simmonds-stone hover:text-simmonds-charcoal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {renderTypeSpecificEditor()}

          {/* Explanation (common to all types) */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Explanation (optional)
            </label>
            <textarea
              value={editedQuestion.explanation || ''}
              onChange={(e) => updateField('explanation', e.target.value)}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-20"
              placeholder="Explain why the answer is correct..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isRegeneratingAudio}
            className={`
              px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium
              flex items-center gap-2
              ${isRegeneratingAudio
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-simmonds-primary-light'
              }
            `}
          >
            {isRegeneratingAudio ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerating Audio...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
