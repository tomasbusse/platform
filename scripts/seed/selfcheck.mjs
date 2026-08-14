/**
 * selfcheck.mjs — validate out/contentBlocks.jsonl against the target contract.
 * Recomputes contentHash with an INDEPENDENT re-implementation of the recipe
 * (not the lib.mjs one) to catch hashing drift. Exits non-zero on failure.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR, LEVELS } from './lib.mjs';

const EXPECTED_KEYS = [
  'blockType', 'level', 'skill', 'topic', 'title', 'body', 'source', 'provenance',
  'rightsStatus', 'attribution', 'reviewStatus', 'exemplarEligible', 'contentHash',
  'usageCount', 'createdAt', 'updatedAt',
].sort();
const BLOCK_TYPES = new Set(['sentencePair', 'vocabSet', 'readingPassage']);
const RIGHTS = new Set(['public_domain', 'cc_by', 'cc_by_sa']);
const PLACEHOLDER_RE = /todo|placeholder|tbd|lorem|xxx|fixme|\[.*\]/i;

// Independent re-implementation of the canonical hash recipe.
function independentHash(body) {
  const sortDeep = (v) => {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]));
    }
    return v;
  };
  const canonical = JSON.stringify(sortDeep(body)).toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

const lines = readFileSync(join(OUT_DIR, 'contentBlocks.jsonl'), 'utf8').split('\n').filter((l) => l.trim());
const checks = { parse: 0, keys: 0, level: 0, attribution: 0, hashFormat: 0, hashRecompute: 0, blockFields: 0 };
const failures = [];
const hashes = new Set();
const provenancePrefixes = {};

lines.forEach((line, i) => {
  const tag = `line ${i + 1}`;
  let r;
  try { r = JSON.parse(line); checks.parse++; } catch { failures.push(`${tag}: invalid JSON`); return; }

  if (JSON.stringify(Object.keys(r).sort()) === JSON.stringify(EXPECTED_KEYS)) checks.keys++;
  else failures.push(`${tag}: key mismatch (${Object.keys(r).sort().join(',')})`);

  if (LEVELS.includes(r.level)) checks.level++;
  else failures.push(`${tag}: bad level ${r.level}`);

  if (typeof r.attribution === 'string' && r.attribution.trim().length > 0 && !PLACEHOLDER_RE.test(r.attribution)) checks.attribution++;
  else failures.push(`${tag}: bad attribution ${JSON.stringify(r.attribution)}`);

  if (/^[0-9a-f]{64}$/.test(r.contentHash)) checks.hashFormat++;
  else failures.push(`${tag}: bad contentHash format`);

  if (independentHash(r.body) === r.contentHash) checks.hashRecompute++;
  else failures.push(`${tag}: contentHash does not match recomputed body hash`);

  const staticOk =
    BLOCK_TYPES.has(r.blockType) &&
    RIGHTS.has(r.rightsStatus) &&
    r.source === 'seed_corpus' &&
    r.reviewStatus === 'unreviewed' &&
    r.exemplarEligible === true &&
    r.usageCount === 0 &&
    typeof r.createdAt === 'number' && typeof r.updatedAt === 'number' &&
    typeof r.topic === 'string' && r.topic && typeof r.title === 'string' && r.title &&
    (r.blockType !== 'sentencePair' || (r.body.en && r.body.de && r.body.attribution)) &&
    (r.blockType !== 'vocabSet' || (Array.isArray(r.body.words) && r.body.words.every((w) => w.word && w.pos && LEVELS.includes(w.cefr) && w.germanHint === null))) &&
    (r.blockType !== 'readingPassage' || (typeof r.body.text === 'string' && Array.isArray(r.body.questions) && r.body.questions.length === 0));
  if (staticOk) checks.blockFields++;
  else failures.push(`${tag}: static field/body-shape violation`);

  hashes.add(r.contentHash);
  const prefix = String(r.provenance).split(':')[0];
  provenancePrefixes[prefix] = (provenancePrefixes[prefix] || 0) + 1;
});

const n = lines.length;
console.log(`lines: ${n}`);
for (const [name, count] of Object.entries(checks)) {
  console.log(`${count === n ? 'PASS' : 'FAIL'} ${name}: ${count}/${n}`);
}
console.log(`${hashes.size === n ? 'PASS' : 'FAIL'} uniqueHashes: ${hashes.size}/${n}`);
console.log(`provenance prefixes: ${JSON.stringify(provenancePrefixes)}`);
if (failures.length) {
  console.log(`\n${failures.length} failures (first 10):`);
  for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
