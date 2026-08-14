/**
 * Shared helpers for the Simmonds seed-data ingest pipeline.
 * Node 22+ (uses built-in fetch and node:crypto only — no npm deps).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEED_DIR = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(SEED_DIR, 'out');
export const CACHE_DIR = join(SEED_DIR, '.cache');

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function ensureDirs() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });
}

/* ------------------------------------------------------------------ */
/* Canonical content hash                                              */
/* ------------------------------------------------------------------ */

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

/**
 * Canonical, stable contentHash recipe (THE one place this is defined):
 * recursively sort all object keys in `body`, JSON.stringify the sorted
 * structure, lowercase it, collapse all whitespace runs to a single space,
 * then sha256 hex digest.
 */
export function contentHash(body) {
  const canonical = JSON.stringify(sortKeysDeep(body)).toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/* ------------------------------------------------------------------ */
/* Record factory                                                      */
/* ------------------------------------------------------------------ */

/** Build one contentBlocks record in the exact target shape. */
export function makeRecord({ blockType, level, skill, topic, title, body, provenance, rightsStatus, attribution }) {
  if (!LEVELS.includes(level)) throw new Error(`bad level: ${level}`);
  if (!attribution || typeof attribution !== 'string' || !attribution.trim()) {
    throw new Error(`attribution is required (provenance=${provenance})`);
  }
  const now = Date.now();
  return {
    blockType,
    level,
    skill,
    topic,
    title,
    body,
    source: 'seed_corpus',
    provenance,
    rightsStatus,
    attribution: attribution.trim(),
    reviewStatus: 'unreviewed',
    exemplarEligible: true,
    contentHash: contentHash(body),
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* JSONL IO (write overwrites; never appends)                          */
/* ------------------------------------------------------------------ */

export function writeJsonl(filePath, records) {
  mkdirSync(dirname(filePath), { recursive: true });
  const text = records.map((r) => JSON.stringify(r)).join('\n');
  writeFileSync(filePath, text + (text ? '\n' : ''), 'utf8');
  return records.length;
}

export function readJsonl(filePath) {
  const out = [];
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) out.push(JSON.parse(trimmed));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fetch helpers (with .cache/ support)                                */
/* ------------------------------------------------------------------ */

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_HEADERS = {
  'User-Agent': 'SimmondsSeedPipeline/0.1 (educational content ingest; contact: dev@localhost)',
};

export async function fetchBuffer(url, { headers = {}, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...headers } });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.status = res.status;
        throw err;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (err.status && err.status >= 400 && err.status < 500) throw err; // don't retry 4xx
      if (attempt < retries) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function fetchText(url, opts = {}) {
  return (await fetchBuffer(url, opts)).toString('utf8');
}

/** Fetch with a local file cache so re-runs don't re-hit the network. */
export async function fetchCachedBuffer(url, cachePath, opts = {}) {
  if (existsSync(cachePath)) return readFileSync(cachePath);
  const buf = await fetchBuffer(url, opts);
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, buf);
  return buf;
}

export async function fetchCachedText(url, cachePath, opts = {}) {
  return (await fetchCachedBuffer(url, cachePath, opts)).toString('utf8');
}

/* ------------------------------------------------------------------ */
/* HTML stripping                                                      */
/* ------------------------------------------------------------------ */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
};

export function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}

/** Strip an HTML fragment to plain text (scripts/styles/comments removed). */
export function stripHtml(html) {
  let t = html;
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ');
  t = t.replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>/gi, '\n\n');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  t = decodeEntities(t);
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/ *\n */g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/* ------------------------------------------------------------------ */
/* Deterministic shuffle (stable sampling across runs)                 */
/* ------------------------------------------------------------------ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(arr, seed = 1337) {
  const rand = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Distribution counter, e.g. countByLevel(records). */
export function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return counts;
}

export function formatDist(counts) {
  return LEVELS.filter((l) => counts[l]).map((l) => `${l}=${counts[l]}`).join(' ') || '(none)';
}
