import React from 'react';

export type QuestionType =
  | 'multiple-choice'
  | 'multiple-select'
  | 'fill-blank'
  | 'matching'
  | 'ordering'
  | 'true-false'
  | 'short-answer'
  | 'listening'
  | 'speaking'
  | 'image-based'
  | 'video-based'
  | 'cloze';

interface QuestionTypeInfo {
  id: QuestionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'basic' | 'interactive' | 'media' | 'text';
}

const QUESTION_TYPES: QuestionTypeInfo[] = [
  {
    id: 'multiple-choice',
    label: 'Multiple Choice',
    description: '4 options, pick ONE correct',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    category: 'basic',
  },
  {
    id: 'multiple-select',
    label: 'Multiple Select',
    description: 'Pick ALL correct answers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    category: 'basic',
  },
  {
    id: 'fill-blank',
    label: 'Fill in Blank',
    description: 'Type the missing word',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    category: 'text',
  },
  {
    id: 'true-false',
    label: 'True/False',
    description: 'Is statement true or false?',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    category: 'basic',
  },
  {
    id: 'matching',
    label: 'Matching',
    description: 'Match pairs together',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    category: 'interactive',
  },
  {
    id: 'ordering',
    label: 'Ordering',
    description: 'Arrange in correct sequence',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    category: 'interactive',
  },
  {
    id: 'short-answer',
    label: 'Short Answer',
    description: 'Type a written response',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    category: 'text',
  },
  {
    id: 'listening',
    label: 'Listening',
    description: 'Listen to audio, answer questions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    ),
    category: 'media',
  },
  {
    id: 'speaking',
    label: 'Speaking',
    description: 'Record voice response',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    category: 'media',
  },
  {
    id: 'image-based',
    label: 'Image-Based',
    description: 'Answer about a picture',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    category: 'media',
  },
  {
    id: 'video-based',
    label: 'Video-Based',
    description: 'Watch video, answer questions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    category: 'media',
  },
  {
    id: 'cloze',
    label: 'Cloze',
    description: 'Passage with multiple blanks',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    category: 'text',
  },
];

interface QuestionTypeSelectorProps {
  selectedTypes: QuestionType[];
  onChange: (types: QuestionType[]) => void;
  disabled?: boolean;
}

const QuestionTypeSelector: React.FC<QuestionTypeSelectorProps> = ({
  selectedTypes,
  onChange,
  disabled = false,
}) => {
  const toggleType = (type: QuestionType) => {
    if (disabled) return;

    if (selectedTypes.includes(type)) {
      // Don't allow deselecting the last type
      if (selectedTypes.length === 1) return;
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onChange(QUESTION_TYPES.map((t) => t.id));
  };

  const clearAll = () => {
    if (disabled) return;
    // Keep at least one type
    onChange(['multiple-choice']);
  };

  const categories = {
    basic: QUESTION_TYPES.filter((t) => t.category === 'basic'),
    text: QUESTION_TYPES.filter((t) => t.category === 'text'),
    interactive: QUESTION_TYPES.filter((t) => t.category === 'interactive'),
    media: QUESTION_TYPES.filter((t) => t.category === 'media'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-simmonds-charcoal">
          Question Types to Include
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-xs text-simmonds-primary hover:underline disabled:opacity-50"
          >
            Select All
          </button>
          <span className="text-simmonds-stone">|</span>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-simmonds-stone hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Basic Questions */}
        <div>
          <p className="text-xs font-medium text-simmonds-stone uppercase tracking-wide mb-2">
            Basic
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categories.basic.map((type) => (
              <TypeCard
                key={type.id}
                type={type}
                selected={selectedTypes.includes(type.id)}
                onClick={() => toggleType(type.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>

        {/* Text Questions */}
        <div>
          <p className="text-xs font-medium text-simmonds-stone uppercase tracking-wide mb-2">
            Text-Based
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categories.text.map((type) => (
              <TypeCard
                key={type.id}
                type={type}
                selected={selectedTypes.includes(type.id)}
                onClick={() => toggleType(type.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>

        {/* Interactive Questions */}
        <div>
          <p className="text-xs font-medium text-simmonds-stone uppercase tracking-wide mb-2">
            Interactive
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categories.interactive.map((type) => (
              <TypeCard
                key={type.id}
                type={type}
                selected={selectedTypes.includes(type.id)}
                onClick={() => toggleType(type.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>

        {/* Media Questions */}
        <div>
          <p className="text-xs font-medium text-simmonds-stone uppercase tracking-wide mb-2">
            Media
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categories.media.map((type) => (
              <TypeCard
                key={type.id}
                type={type}
                selected={selectedTypes.includes(type.id)}
                onClick={() => toggleType(type.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-simmonds-stone">
        {selectedTypes.length} type{selectedTypes.length !== 1 ? 's' : ''} selected.
        At least one type must be selected.
      </p>
    </div>
  );
};

interface TypeCardProps {
  type: QuestionTypeInfo;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}

const TypeCard: React.FC<TypeCardProps> = ({ type, selected, onClick, disabled }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-start gap-2 p-3 rounded-xl border-2 text-left
        transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${selected
          ? 'border-simmonds-primary bg-simmonds-primary/5'
          : 'border-simmonds-cream hover:border-simmonds-stone/30'
        }
      `}
    >
      <div
        className={`
          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
          transition-all duration-200
          ${selected
            ? 'border-simmonds-primary bg-simmonds-primary'
            : 'border-simmonds-stone/40'
          }
        `}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={selected ? 'text-simmonds-primary' : 'text-simmonds-stone'}>
            {type.icon}
          </span>
          <span className="font-medium text-simmonds-charcoal text-sm truncate">
            {type.label}
          </span>
        </div>
        <p className="text-xs text-simmonds-stone truncate">{type.description}</p>
      </div>
    </button>
  );
};

export default QuestionTypeSelector;
