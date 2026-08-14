/**
 * 02-tatoeba.mjs — Tatoeba DE-EN sentence pairs -> sentencePair records.
 *
 * Source: https://www.manythings.org/anki/deu-eng.zip (Tatoeba, CC BY 2.0 FR).
 * Each TSV line: english<TAB>german<TAB>attribution — the third column is the
 * per-sentence attribution string and is carried into `attribution` verbatim.
 *
 * Depends on out/cefrj-map.json from 01-cefrj.mjs (leveling heuristic);
 * fails fast if it is missing. Emits out/sentencePairs.jsonl.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OUT_DIR, CACHE_DIR, LEVELS, ensureDirs, fetchBuffer,
  makeRecord, writeJsonl, seededShuffle, countBy, formatDist,
} from './lib.mjs';

const ZIP_URL = 'https://www.manythings.org/anki/deu-eng.zip';
const ZIP_CACHE = join(CACHE_DIR, 'deu-eng.zip');
const EXTRACT_DIR = join(CACHE_DIR, 'deu-eng');
const CEFRJ_MAP_PATH = join(OUT_DIR, 'cefrj-map.json');

const MAX_PAIRS = 5000;
const MIN_WORDS = 3;
const MAX_WORDS = 15;
const COVERAGE_THRESHOLD = 0.9;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// English function words excluded from the content-word coverage check.
const STOPWORDS = new Set((
  'a an the and or but if then else when while of at by for with about into through during ' +
  'before after above below to from up down in out on off over under again further once here ' +
  'there all any both each few more most other some such no nor not only own same so than too ' +
  'very can will just should now i me my we our you your he him his she her it its they them ' +
  'their this that these those am is are was were be been being have has had having do does did ' +
  'doing would could ought shall must'
).split(' '));

function wordCount(en) {
  return en.trim().split(/\s+/).length;
}

function contentWords(en) {
  const tokens = en.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
  return tokens
    .map((t) => (t.endsWith("'s") ? t.slice(0, -2) : t))
    .filter((t) => t && !STOPWORDS.has(t));
}

function buildCumulative(wordMap) {
  const byLevel = {};
  for (const [word, level] of Object.entries(wordMap)) {
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(word);
  }
  const cumulative = {};
  let acc = new Set();
  for (const level of LEVELS) {
    acc = new Set([...acc, ...(byLevel[level] || [])]);
    cumulative[level] = acc;
  }
  return cumulative;
}

function levelForSentence(en, cumulative) {
  const words = contentWords(en);
  if (words.length > 0) {
    for (const level of LEVELS) {
      const covered = words.filter((w) => cumulative[level].has(w)).length;
      if (covered / words.length >= COVERAGE_THRESHOLD) return { level, how: 'coverage' };
    }
  }
  // Fallback: sentence length.
  const n = wordCount(en);
  const level = n <= 5 ? 'A1' : n <= 8 ? 'A2' : n <= 11 ? 'B1' : 'B2';
  return { level, how: 'length' };
}

async function downloadZip() {
  if (existsSync(ZIP_CACHE)) {
    console.log(`cache hit: ${ZIP_CACHE}`);
    return;
  }
  let buf;
  try {
    buf = await fetchBuffer(ZIP_URL, { headers: { 'User-Agent': '' }, retries: 0 });
  } catch (err) {
    if (err.status === 403) {
      console.log('bare fetch returned 403; retrying once with browser User-Agent');
      buf = await fetchBuffer(ZIP_URL, { headers: { 'User-Agent': BROWSER_UA }, retries: 0 });
    } else throw err;
  }
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) { // 'PK'
    throw new Error(`download from manythings.org is not a ZIP (got ${buf.slice(0, 32).toString()})`);
  }
  writeFileSync(ZIP_CACHE, buf);
  console.log(`downloaded ${ZIP_URL} -> ${ZIP_CACHE} (${buf.length} bytes)`);
}

function extractZip() {
  execFileSync('unzip', ['-o', '-q', ZIP_CACHE, '-d', EXTRACT_DIR]);
  const txtFiles = readdirSync(EXTRACT_DIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => ({ f, size: statSync(join(EXTRACT_DIR, f)).size }))
    .sort((a, b) => b.size - a.size);
  if (txtFiles.length === 0) throw new Error('no .txt file found in extracted zip');
  return join(EXTRACT_DIR, txtFiles[0].f);
}

async function main() {
  ensureDirs();

  // Fail fast: the leveling heuristic needs 01's output.
  if (!existsSync(CEFRJ_MAP_PATH)) {
    console.error(`FAIL: ${CEFRJ_MAP_PATH} not found. Run \`node scripts/seed/01-cefrj.mjs\` first.`);
    process.exit(1);
  }
  const wordMap = JSON.parse(readFileSync(CEFRJ_MAP_PATH, 'utf8'));
  const cumulative = buildCumulative(wordMap);
  console.log(`loaded cefrj-map.json: ${Object.keys(wordMap).length} words`);

  await downloadZip();
  const tsvPath = extractZip();
  console.log(`extracted TSV: ${tsvPath}`);

  const lines = readFileSync(tsvPath, 'utf8').split('\n');
  const candidates = [];
  let skippedCols = 0;
  let skippedWords = 0;
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const cols = line.split('\t');
    if (cols.length !== 3 || !cols[0].trim() || !cols[1].trim() || !cols[2].trim()) {
      skippedCols++;
      return;
    }
    const n = wordCount(cols[0]);
    if (n < MIN_WORDS || n > MAX_WORDS) { skippedWords++; return; }
    candidates.push({ en: cols[0].trim(), de: cols[1].trim(), attribution: cols[2].trim(), line: idx + 1 });
  });
  console.log(`parsed ${lines.length} lines; candidates after ${MIN_WORDS}-${MAX_WORDS}-word filter: ${candidates.length} (skipped: ${skippedCols} bad columns, ${skippedWords} word-count)`);

  const sampled = seededShuffle(candidates, 20260814).slice(0, MAX_PAIRS);
  console.log(`sampled ${sampled.length} pairs (deterministic shuffle)`);

  const records = [];
  const howCounts = { coverage: 0, length: 0 };
  for (const c of sampled) {
    const { level, how } = levelForSentence(c.en, cumulative);
    howCounts[how]++;
    records.push(makeRecord({
      blockType: 'sentencePair',
      level,
      skill: 'vocabulary',
      topic: 'general',
      title: c.en.length > 60 ? `${c.en.slice(0, 57)}…` : c.en,
      body: { en: c.en, de: c.de, attribution: c.attribution },
      provenance: `tatoeba:${c.line}`,
      rightsStatus: 'cc_by',
      attribution: c.attribution,
    }));
  }

  writeJsonl(join(OUT_DIR, 'sentencePairs.jsonl'), records);
  console.log(`wrote out/sentencePairs.jsonl: ${records.length} sentencePair records`);
  console.log(`level distribution: ${formatDist(countBy(records, 'level'))}`);
  console.log(`leveled by: coverage=${howCounts.coverage} length-fallback=${howCounts.length}`);
}

main().catch((err) => { console.error(`FAIL: ${err.message}`); process.exit(1); });
