/**
 * 01-cefrj.mjs — CEFR-J + Octanove vocabulary profiles -> vocabSet records.
 *
 * Source: https://github.com/openlanguageprofiles/olp-en-cefrj
 *  - CEFR-J Vocabulary Profile v1.5 (A1-B2): free for research and commercial
 *    use with citation (copyright Tono Laboratory, TUFS) -> rightsStatus cc_by.
 *  - Octanove Vocabulary Profile C1/C2 v1.0: CC BY-SA 4.0 -> rightsStatus cc_by_sa.
 *
 * CSV paths are discovered via the GitHub git-trees API (not hardcoded).
 * Emits: out/vocabSets.jsonl and out/cefrj-map.json (word -> level map used
 * by 02-tatoeba.mjs).
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  OUT_DIR, CACHE_DIR, LEVELS, ensureDirs, fetchCachedText,
  makeRecord, writeJsonl, countBy, formatDist,
} from './lib.mjs';

const REPO = 'openlanguageprofiles/olp-en-cefrj';
const BRANCH = 'master';
const TREE_API = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

const CEFRJ_ATTRIBUTION =
  'The CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo University of Foreign Studies ' +
  '(http://www.cefr-j.org/download.html) — free for research and commercial use with citation';
const OCTANOVE_ATTRIBUTION =
  'Octanove Vocabulary Profile C1/C2 ver 1.0 by Octanove Labs (http://www.octanove.com/), ' +
  'licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)';

const SET_SIZE = 20;
const MIN_TAIL = 8; // merge a final chunk smaller than this into the previous set

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

function parseVocabCsv(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const wordIdx = header.findIndex((h) => h === 'headword' || h === 'word');
  const posIdx = header.findIndex((h) => h === 'pos');
  const cefrIdx = header.findIndex((h) => h === 'cefr' || h === 'level');
  if (wordIdx < 0 || posIdx < 0 || cefrIdx < 0) {
    throw new Error(`unexpected CSV header: ${lines[0]}`);
  }
  const rows = [];
  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line);
    const word = (f[wordIdx] || '').trim().toLowerCase();
    const pos = (f[posIdx] || '').trim().toLowerCase();
    const cefr = (f[cefrIdx] || '').trim().toUpperCase();
    if (word && pos && LEVELS.includes(cefr)) rows.push({ word, pos, cefr });
  }
  return rows;
}

function chunkWords(words) {
  const chunks = [];
  for (let i = 0; i < words.length; i += SET_SIZE) chunks.push(words.slice(i, i + SET_SIZE));
  if (chunks.length > 1 && chunks[chunks.length - 1].length < MIN_TAIL) {
    chunks[chunks.length - 2].push(...chunks[chunks.length - 1]);
    chunks.pop();
  }
  return chunks;
}

async function main() {
  ensureDirs();
  const ghHeaders = {
    'User-Agent': 'SimmondsSeedPipeline/0.1',
    Accept: 'application/vnd.github+json',
  };

  // 1. Discover CSV paths via the git-trees API (no hardcoded filenames).
  const tree = JSON.parse(await fetchCachedText(TREE_API, join(CACHE_DIR, 'gh-tree.json'), { headers: ghHeaders }));
  const csvPaths = tree.tree
    .map((n) => n.path)
    .filter((p) => /\.csv$/i.test(p) && /vocabulary-profile/i.test(p));
  if (csvPaths.length === 0) throw new Error('no vocabulary-profile CSVs found in repo tree');
  console.log(`discovered CSVs: ${csvPaths.join(', ')}`);

  // 2. Download and parse each profile.
  const profiles = [];
  for (const path of csvPaths) {
    const text = await fetchCachedText(`${RAW_BASE}/${path}`, join(CACHE_DIR, path.replace(/\//g, '__')), { headers: ghHeaders });
    const rows = parseVocabCsv(text);
    const isOctanove = /octanove/i.test(path) || rows.every((r) => r.cefr === 'C1' || r.cefr === 'C2');
    profiles.push({
      path,
      rows,
      kind: isOctanove ? 'octanove' : 'cefrj',
      attribution: isOctanove ? OCTANOVE_ATTRIBUTION : CEFRJ_ATTRIBUTION,
      rightsStatus: isOctanove ? 'cc_by_sa' : 'cc_by',
      provenance: isOctanove ? 'octanove:v1.0' : 'cefrj:v1.5',
    });
    console.log(`parsed ${path}: ${rows.length} rows (${isOctanove ? 'Octanove C1/C2' : 'CEFR-J A1-B2'})`);
  }

  // 3. Word -> level map (CEFR-J first so its lower levels win on conflicts).
  const wordMap = {};
  for (const p of [...profiles].sort((a, b) => (a.kind === 'cefrj' ? -1 : 1) - (b.kind === 'cefrj' ? -1 : 1))) {
    for (const r of p.rows) if (!(r.word in wordMap)) wordMap[r.word] = r.cefr;
  }
  writeFileSync(join(OUT_DIR, 'cefrj-map.json'), JSON.stringify(wordMap), 'utf8');
  console.log(`wrote out/cefrj-map.json: ${Object.keys(wordMap).length} words`);

  // 4. Group by level x POS, chunk into ~20-word sets, emit records.
  const groups = new Map(); // `${level}|${pos}|${kind}` -> {words, profile}
  for (const p of profiles) {
    const seen = new Set();
    for (const r of p.rows) {
      const dedupeKey = `${r.cefr}|${r.pos}|${r.word}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const key = `${r.cefr}|${r.pos}|${p.kind}`;
      if (!groups.has(key)) groups.set(key, { words: [], profile: p });
      groups.get(key).words.push({ word: r.word, pos: r.pos, cefr: r.cefr, germanHint: null });
    }
  }

  const records = [];
  for (const [key, { words, profile }] of [...groups.entries()].sort()) {
    const [level, pos] = key.split('|');
    const chunks = chunkWords(words);
    chunks.forEach((chunk, i) => {
      records.push(makeRecord({
        blockType: 'vocabSet',
        level,
        skill: 'vocabulary',
        topic: pos,
        title: `${level} ${pos} vocabulary — set ${i + 1} of ${chunks.length}`,
        body: { words: chunk },
        provenance: profile.provenance,
        rightsStatus: profile.rightsStatus,
        attribution: profile.attribution,
      }));
    });
  }

  writeJsonl(join(OUT_DIR, 'vocabSets.jsonl'), records);
  console.log(`wrote out/vocabSets.jsonl: ${records.length} vocabSet records`);
  console.log(`level distribution (sets): ${formatDist(countBy(records, 'level'))}`);
  const wordCounts = {};
  for (const r of records) wordCounts[r.level] = (wordCounts[r.level] || 0) + r.body.words.length;
  console.log(`level distribution (words): ${formatDist(wordCounts)}`);
}

main().catch((err) => { console.error(`FAIL: ${err.message}`); process.exit(1); });
