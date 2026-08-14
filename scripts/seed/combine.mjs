/**
 * combine.mjs — merge all per-source out/*.jsonl into out/contentBlocks.jsonl.
 *
 * Concatenates every out/*.jsonl except contentBlocks.jsonl itself, dedupes by
 * contentHash (first occurrence wins), and writes the combined file. Prints the
 * total line count and unique hash count — they must match.
 *
 * Output is ready for:
 *   npx convex import --table contentBlocks scripts/seed/out/contentBlocks.jsonl
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR, ensureDirs, readJsonl, writeJsonl, countBy, formatDist } from './lib.mjs';

function main() {
  ensureDirs();
  const inputs = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.jsonl') && f !== 'contentBlocks.jsonl')
    .sort();
  if (inputs.length === 0) throw new Error('no out/*.jsonl inputs found — run 01/02/03 first');
  console.log(`inputs: ${inputs.join(', ')}`);

  const seen = new Set();
  const combined = [];
  let dupes = 0;
  const perFile = {};
  for (const file of inputs) {
    const records = readJsonl(join(OUT_DIR, file));
    let kept = 0;
    for (const r of records) {
      if (seen.has(r.contentHash)) { dupes++; continue; }
      seen.add(r.contentHash);
      combined.push(r);
      kept++;
    }
    perFile[file] = { read: records.length, kept };
  }

  for (const [file, { read, kept }] of Object.entries(perFile)) {
    console.log(`${file}: read=${read} kept=${kept}`);
  }

  writeJsonl(join(OUT_DIR, 'contentBlocks.jsonl'), combined);
  const hashCount = new Set(combined.map((r) => r.contentHash)).size;
  console.log(`wrote out/contentBlocks.jsonl: ${combined.length} records`);
  console.log(`duplicates dropped: ${dupes}`);
  console.log(`line count: ${combined.length}; unique contentHash count: ${hashCount}; match: ${combined.length === hashCount ? 'YES' : 'NO'}`);
  console.log(`level distribution: ${formatDist(countBy(combined, 'level'))}`);
  console.log(`by blockType: ${JSON.stringify(countBy(combined, 'blockType'))}`);
}

main();
