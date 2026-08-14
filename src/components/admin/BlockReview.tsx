/**
 * BlockReview.tsx - Lehrer-Prüfung für KI-generierte Content Blocks
 *
 * Internal admin tool: teachers review AI-generated lesson content blocks
 * and approve or reject them before they are used in lessons.
 */

import React, { useState } from 'react';
import { usePaginatedQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { User, Company } from '../../types';

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type Skill =
  | 'grammar'
  | 'vocabulary'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking'
  | 'pronunciation'
  | 'mixed';
type BlockType =
  | 'vocabSet'
  | 'sentencePair'
  | 'dialogue'
  | 'grammarExplainer'
  | 'exerciseAtom'
  | 'readingPassage'
  | 'listeningScript'
  | 'culturalNote'
  | 'imagePromptTemplate'
  | 'speakingPrompt';

interface GraderScores {
  pedagogy: number;
  cefrFit: number;
  voice: number;
  judgeModel: string;
  notes?: string;
}

interface ContentBlock {
  _id: Id<'contentBlocks'>;
  blockType: BlockType;
  level: CefrLevel;
  skill: Skill;
  topic: string;
  title: string;
  body: unknown;
  reviewStatus: 'unreviewed' | 'ai_approved' | 'teacher_approved' | 'rejected';
  graderScores?: GraderScores;
  createdAt: number;
}

const lessonDbApi = api.lessonDb;

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  vocabSet: 'Wortschatz',
  sentencePair: 'Satzpaar',
  dialogue: 'Dialog',
  grammarExplainer: 'Grammatik',
  exerciseAtom: 'Übung',
  readingPassage: 'Lesetext',
  listeningScript: 'Hörskript',
  culturalNote: 'Kulturhinweis',
  imagePromptTemplate: 'Bildvorlage',
  speakingPrompt: 'Sprechaufgabe',
};

const SKILL_LABELS: Record<Skill, string> = {
  grammar: 'Grammatik',
  vocabulary: 'Wortschatz',
  reading: 'Lesen',
  listening: 'Hören',
  writing: 'Schreiben',
  speaking: 'Sprechen',
  pronunciation: 'Aussprache',
  mixed: 'Gemischt',
};

// --- Runtime guards for narrowing the untyped block body -------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const asNonEmptyArray = (value: unknown): unknown[] | null =>
  Array.isArray(value) && value.length > 0 ? value : null;

const firstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
};

/** Best-effort plain-text rendering for a list entry (word, example, question, ...). */
const entryText = (entry: unknown): string | null => {
  if (typeof entry === 'string') return entry;
  if (isRecord(entry)) {
    return firstString(entry, ['question', 'example', 'text', 'word', 'term', 'de', 'en', 'line']);
  }
  return null;
};

/** Vocab entries may be plain strings or word/translation records. */
const vocabEntryText = (entry: unknown): string | null => {
  if (typeof entry === 'string') return entry;
  if (isRecord(entry)) {
    const primary = firstString(entry, ['de', 'word', 'term', 'text']);
    const secondary = firstString(entry, ['en', 'translation', 'meaning']);
    if (primary && secondary) return `${primary} – ${secondary}`;
    return primary ?? secondary;
  }
  return null;
};

// --- Body previews ----------------------------------------------------------

const RawBody: React.FC<{ body: unknown }> = ({ body }) => (
  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-simmonds-cream-lighter p-3 text-xs text-simmonds-charcoal">
    {JSON.stringify(body, null, 2)}
  </pre>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-simmonds-stone">{children}</p>
);

const EntryList: React.FC<{ entries: unknown[]; ordered?: boolean }> = ({ entries, ordered }) => {
  const items = entries.map((entry, index) => (
    <li key={index} className="text-sm text-simmonds-charcoal">
      {entryText(entry) ?? JSON.stringify(entry)}
    </li>
  ));
  return ordered ? (
    <ol className="list-decimal list-inside space-y-1">{items}</ol>
  ) : (
    <ul className="list-disc list-inside space-y-1">{items}</ul>
  );
};

const BlockBodyPreview: React.FC<{ blockType: BlockType; body: unknown }> = ({ blockType, body }) => {
  if (!isRecord(body)) return <RawBody body={body} />;

  switch (blockType) {
    case 'vocabSet': {
      const words = asNonEmptyArray(body.words);
      if (!words) return <RawBody body={body} />;
      return (
        <ul className="flex flex-wrap gap-2">
          {words.map((word, index) => (
            <li
              key={index}
              className="rounded-full bg-simmonds-cream px-3 py-1 text-sm text-simmonds-charcoal"
            >
              {vocabEntryText(word) ?? JSON.stringify(word)}
            </li>
          ))}
        </ul>
      );
    }

    case 'sentencePair': {
      const en = asString(body.en);
      const de = asString(body.de);
      if (!en || !de) return <RawBody body={body} />;
      return (
        <div className="space-y-2">
          <p className="text-sm text-simmonds-charcoal">
            <span className="mr-2 inline-block rounded bg-simmonds-cream px-1.5 py-0.5 text-xs font-medium text-simmonds-stone">
              EN
            </span>
            {en}
          </p>
          <p className="text-sm text-simmonds-charcoal">
            <span className="mr-2 inline-block rounded bg-simmonds-primary/10 px-1.5 py-0.5 text-xs font-medium text-simmonds-primary">
              DE
            </span>
            {de}
          </p>
        </div>
      );
    }

    case 'dialogue': {
      const turns = asNonEmptyArray(body.turns);
      if (!turns) return <RawBody body={body} />;
      return (
        <ul className="space-y-2">
          {turns.map((turn, index) => {
            if (isRecord(turn)) {
              const speaker = firstString(turn, ['speaker', 'role', 'name']);
              const line = firstString(turn, ['line', 'text', 'de', 'sentence']);
              if (line) {
                return (
                  <li key={index} className="text-sm">
                    {speaker && (
                      <span className="font-medium text-simmonds-primary">{speaker}: </span>
                    )}
                    <span className="text-simmonds-charcoal">{line}</span>
                  </li>
                );
              }
            }
            return (
              <li key={index} className="text-sm text-simmonds-charcoal">
                {entryText(turn) ?? JSON.stringify(turn)}
              </li>
            );
          })}
        </ul>
      );
    }

    case 'grammarExplainer': {
      const explanation = asString(body.explanation);
      const examples = asNonEmptyArray(body.examples);
      if (!explanation || !examples) return <RawBody body={body} />;
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-simmonds-charcoal">{explanation}</p>
          <div>
            <SectionLabel>Beispiele</SectionLabel>
            <EntryList entries={examples} />
          </div>
        </div>
      );
    }

    case 'exerciseAtom': {
      const prompt = asString(body.prompt);
      if (!prompt) return <RawBody body={body} />;
      const exerciseType = asString(body.exerciseType);
      const options = Array.isArray(body.options) ? body.options : null;
      const answerKey = body.answerKey;
      const isCorrectOption = (option: unknown, index: number): boolean =>
        Object.is(option, answerKey) ||
        (typeof answerKey === 'number' && Number.isInteger(answerKey) && answerKey === index);
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {exerciseType && (
              <span className="rounded-full bg-simmonds-cream px-2 py-0.5 text-xs text-simmonds-stone">
                {exerciseType}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-simmonds-charcoal">{prompt}</p>
          {options ? (
            <ul className="space-y-1">
              {options.map((option, index) => {
                const correct = isCorrectOption(option, index);
                return (
                  <li
                    key={index}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      correct
                        ? 'bg-green-50 font-medium text-green-800 ring-1 ring-green-200'
                        : 'bg-simmonds-cream-lighter text-simmonds-charcoal'
                    }`}
                  >
                    {entryText(option) ?? JSON.stringify(option)}
                    {correct && <span className="ml-2 text-xs text-green-600">✓ richtige Antwort</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            (typeof answerKey === 'string' || typeof answerKey === 'number') && (
              <p className="text-sm text-simmonds-charcoal">
                <span className="text-simmonds-stone">Antwort: </span>
                <span className="font-medium text-green-700">{String(answerKey)}</span>
              </p>
            )
          )}
        </div>
      );
    }

    case 'readingPassage': {
      const text = asString(body.text);
      const questions = asNonEmptyArray(body.questions);
      if (!text || !questions) return <RawBody body={body} />;
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-simmonds-charcoal">{text}</p>
          <div>
            <SectionLabel>Verständnisfragen</SectionLabel>
            <EntryList entries={questions} ordered />
          </div>
        </div>
      );
    }

    case 'listeningScript': {
      const script = asString(body.script);
      const questions = asNonEmptyArray(body.questions);
      if (!script || !questions) return <RawBody body={body} />;
      return (
        <div className="space-y-3">
          <div>
            <SectionLabel>Skript</SectionLabel>
            <p className="whitespace-pre-wrap text-sm text-simmonds-charcoal">{script}</p>
          </div>
          <div>
            <SectionLabel>Fragen</SectionLabel>
            <EntryList entries={questions} ordered />
          </div>
        </div>
      );
    }

    case 'culturalNote': {
      const note = asString(body.note);
      if (!note) return <RawBody body={body} />;
      return <p className="whitespace-pre-wrap text-sm text-simmonds-charcoal">{note}</p>;
    }

    case 'imagePromptTemplate': {
      const prompt = asString(body.prompt);
      if (!prompt) return <RawBody body={body} />;
      return (
        <div>
          <SectionLabel>Bildprompt</SectionLabel>
          <p className="whitespace-pre-wrap text-sm italic text-simmonds-charcoal">{prompt}</p>
        </div>
      );
    }

    case 'speakingPrompt': {
      const prompt = asString(body.prompt);
      if (!prompt) return <RawBody body={body} />;
      return (
        <div>
          <SectionLabel>Aufgabe</SectionLabel>
          <p className="whitespace-pre-wrap text-sm text-simmonds-charcoal">{prompt}</p>
        </div>
      );
    }

    default:
      return <RawBody body={body} />;
  }
};

// --- Card -------------------------------------------------------------------

const Chip: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>
);

const ScoreBadge: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <span className="inline-flex items-center gap-1 rounded-lg bg-simmonds-cream px-2 py-1 text-xs">
    <span className="text-simmonds-stone">{label}</span>
    <span className="font-semibold text-simmonds-charcoal">{value}</span>
  </span>
);

interface BlockCardProps {
  block: ContentBlock;
  onVerdict: (blockId: Id<'contentBlocks'>, verdict: 'teacher_approved' | 'rejected') => void;
}

const BlockCard: React.FC<BlockCardProps> = ({ block, onVerdict }) => (
  <div className="rounded-2xl border border-simmonds-cream bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-simmonds-charcoal">{block.title}</h3>
        <p className="mt-0.5 text-sm text-simmonds-stone">
          {block.topic} · Erstellt am {new Date(block.createdAt).toLocaleDateString('de-DE')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip className="bg-simmonds-primary/10 text-simmonds-primary">{block.level}</Chip>
        <Chip className="bg-simmonds-cream text-simmonds-charcoal">{SKILL_LABELS[block.skill]}</Chip>
        <Chip className="bg-simmonds-cream text-simmonds-stone">
          {BLOCK_TYPE_LABELS[block.blockType]}
        </Chip>
      </div>
    </div>

    {block.graderScores && (
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        title={`Automatische Bewertung durch ${block.graderScores.judgeModel}`}
      >
        <ScoreBadge label="Pädagogik" value={block.graderScores.pedagogy} />
        <ScoreBadge label="GER-Passung" value={block.graderScores.cefrFit} />
        <ScoreBadge label="Sprachstil" value={block.graderScores.voice} />
        {block.graderScores.notes && (
          <span className="text-xs italic text-simmonds-stone">{block.graderScores.notes}</span>
        )}
      </div>
    )}

    <div className="mt-4 border-t border-simmonds-cream pt-4">
      <BlockBodyPreview blockType={block.blockType} body={block.body} />
    </div>

    <div className="mt-4 flex justify-end gap-3">
      <button
        onClick={() => onVerdict(block._id, 'rejected')}
        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        Ablehnen
      </button>
      <button
        onClick={() => onVerdict(block._id, 'teacher_approved')}
        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
      >
        Genehmigen
      </button>
    </div>
  </div>
);

// --- Page -------------------------------------------------------------------

interface BlockReviewProps {
  currentUser: User | null;
  company: Company | null;
}

const BlockReview: React.FC<BlockReviewProps> = () => {
  const [levelFilter, setLevelFilter] = useState<CefrLevel | 'all'>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<Id<'contentBlocks'>>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // "all levels" omits the level arg entirely; changing args resets pagination.
  const { results, status, loadMore } = usePaginatedQuery(
    lessonDbApi.blocksForReview,
    levelFilter === 'all' ? {} : { level: levelFilter },
    { initialNumItems: 20 }
  );
  const reviewBlock = useMutation(lessonDbApi.reviewBlock);

  // Optimistic removal: paginated queries don't compose withOptimisticUpdate
  // across pages, so dismissed ids are filtered out locally instead.
  const visibleBlocks = results.filter((block) => !dismissedIds.has(block._id));

  const handleVerdict = async (
    blockId: Id<'contentBlocks'>,
    verdict: 'teacher_approved' | 'rejected'
  ) => {
    setActionError(null);
    setDismissedIds((prev) => new Set(prev).add(blockId));
    try {
      await reviewBlock({ blockId, verdict });
    } catch (error) {
      console.error('Fehler beim Speichern der Bewertung:', error);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
      setActionError('Die Bewertung konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-simmonds-cream bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-simmonds-charcoal">Inhaltsprüfung</h2>
          <p className="mt-1 text-sm text-simmonds-stone">
            KI-generierte Lerninhalte prüfen und freigeben.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-simmonds-charcoal">
          <span className="text-simmonds-stone">Niveau:</span>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value as CefrLevel | 'all')}
            className="rounded-xl border border-simmonds-cream bg-white px-3 py-2 text-sm text-simmonds-charcoal focus:border-simmonds-primary focus:outline-none"
          >
            <option value="all">Alle Niveaus</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {status === 'LoadingFirstPage' ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-simmonds-primary"></div>
          <p className="text-sm text-simmonds-stone">Inhalte werden geladen …</p>
        </div>
      ) : visibleBlocks.length === 0 && status === 'Exhausted' ? (
        <div className="rounded-2xl border border-simmonds-cream bg-white p-12 text-center shadow-sm">
          <p className="text-xl font-semibold text-simmonds-charcoal">Alles geprüft</p>
          <p className="mt-2 text-sm text-simmonds-stone">
            Aktuell liegen keine ungeprüften Inhalte vor.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {visibleBlocks.map((block) => (
              <BlockCard key={block._id} block={block} onVerdict={handleVerdict} />
            ))}
          </div>
          {(status === 'CanLoadMore' || status === 'LoadingMore') && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => loadMore(20)}
                disabled={status === 'LoadingMore'}
                className="rounded-xl bg-simmonds-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {status === 'LoadingMore' ? 'Wird geladen …' : 'Mehr laden'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BlockReview;
