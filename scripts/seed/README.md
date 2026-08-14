# Seed-data ingest pipeline (first draft)

Downloads license-clean lesson-content sources and emits a combined, deduped
JSONL file ready for:

```bash
npx convex import --table contentBlocks scripts/seed/out/contentBlocks.jsonl
```

No npm dependencies — Node 22+ built-ins only (`fetch`, `node:crypto`) plus the
system `unzip` CLI (used for the Tatoeba `.zip`; Node's zlib does not handle
the ZIP container format). That is why there is deliberately no `package.json`
in this directory.

## Files

| File | Purpose |
| --- | --- |
| `lib.mjs` | Shared helpers: the ONE canonical `contentHash` recipe, record factory, JSONL read/write (write = overwrite), cached fetch, HTML stripping, deterministic seeded shuffle, level-distribution formatting. |
| `01-cefrj.mjs` | CEFR-J + Octanove vocabulary profiles → `out/vocabSets.jsonl` + `out/cefrj-map.json`. |
| `02-tatoeba.mjs` | Tatoeba DE-EN pairs → `out/sentencePairs.jsonl`. **Requires `out/cefrj-map.json` from step 01** (fails fast without it). |
| `03-voa.mjs` | VOA Learning English articles → `out/readingPassages.jsonl` (robots.txt gated, 1 req/s). |
| `combine.mjs` | Concatenates all `out/*.jsonl` (except `contentBlocks.jsonl`), dedupes by `contentHash`, writes `out/contentBlocks.jsonl`. |
| `.cache/` | Raw downloads, so re-runs don't re-hit the network. Delete to force a fresh download. |
| `out/` | Generated JSONL + `cefrj-map.json`. Each script overwrites its own outputs on every run. |

## Run

```bash
node scripts/seed/01-cefrj.mjs   # must run before 02
node scripts/seed/02-tatoeba.mjs
node scripts/seed/03-voa.mjs
node scripts/seed/combine.mjs
node scripts/seed/selfcheck.mjs  # optional: validate the combined output
```

## Sources and licenses

| Source | Records | License | `rightsStatus` | Attribution requirement |
| --- | --- | --- | --- | --- |
| [Tatoeba](https://www.manythings.org/anki/deu-eng.zip) DE-EN pairs | `sentencePair` (max 5000, EN side 3–15 words) | CC BY 2.0 FR | `cc_by` | Per-sentence attribution string (3rd TSV column, e.g. `CC-BY 2.0 (France) Attribution: tatoeba.org #...`) carried **verbatim** into `attribution` and `body.attribution`. |
| [CEFR-J Vocabulary Profile v1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) (A1–B2) | `vocabSet` (~20 words per level×POS set) | Free for research/commercial use **with citation** (© Tono Laboratory, TUFS) — mapped to nearest rights category | `cc_by` | Citation string in every record's `attribution`. |
| [Octanove Vocabulary Profile C1/C2 v1.0](https://github.com/openlanguageprofiles/olp-en-cefrj) | `vocabSet` | CC BY-SA 4.0 | `cc_by_sa` | Citation string naming Octanove Labs + the license in every record's `attribution`. |
| [VOA Learning English](https://learningenglish.voanews.com) | `readingPassage` (target 25) | Public domain (US Gov work) | `public_domain` | `Voice of America — public domain`. |

## Source-specific behavior

- **CEFR-J (01):** CSV paths are discovered via the GitHub git-trees API
  (`/git/trees/master?recursive=1`), not hardcoded. Also writes
  `out/cefrj-map.json` (flat `word → CEFR level` map, CEFR-J levels win on
  conflicts) used by 02.
- **Tatoeba (02):** zip is downloaded to `.cache/` (bare fetch first; one retry
  with a browser User-Agent on HTTP 403), extracted with the `unzip` CLI via
  `child_process`. Sampling is a deterministic seeded shuffle, so the same
  5000 pairs are picked on every run. Leveling: a sentence is assigned the
  lowest CEFR level whose **cumulative** word list covers ≥ 90% of its content
  words (function words excluded); if no level reaches 90%, fallback by
  sentence length (≤5→A1, ≤8→A2, ≤11→B1, else B2).
- **VOA (03):** fetches and logs `robots.txt` first; if any needed path is
  Disallow'd for `User-agent: *`, the source stops (writing an empty output
  file) rather than scraping against robots.txt. Articles are fetched at
  1 request/second from six section pages. Byline comes from the page's
  JSON-LD `author`; articles with no identifiable byline, or whose byline or
  body mentions AP / Reuters / AFP, are skipped (wire content is not VOA
  public-domain). VOA has no machine-readable CEFR levels, so level is mapped
  from the section: American Stories→A2, As It Is / Arts & Culture /
  Health & Lifestyle→B1, Science & Technology / Words & Their Stories→B2.

## Record shape

One JSON object per line with exactly the `contentBlocks` fields. `contentHash`
is defined once in `lib.mjs`: recursively sort all keys in `body`,
`JSON.stringify`, lowercase, collapse whitespace runs to a single space,
sha256 hex. `combine.mjs` dedupes on it.
