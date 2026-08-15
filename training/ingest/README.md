# Local material ingest

This directory contains a four-stage, local-only Python 3.12 pipeline for turning the read-only Simmonds teaching archive into anonymized review candidates. It makes no cloud or model API calls. Generated data goes to `output/`, which is ignored by Git because it contains extracted, PII-adjacent source material.

## Setup

Create a Python 3.12 environment outside the repository and install the two runtime dependencies:

```bash
python3.12 -m venv /tmp/simmonds-ingest-venv
/tmp/simmonds-ingest-venv/bin/pip install -r training/ingest/requirements.txt
```

Legacy `.doc` extraction additionally requires the macOS `textutil` command. A failing or malformed document is recorded and does not abort extraction.

Plain UTF-8 `.txt` and `.md` files are extracted directly. Files named exactly `README.txt` (case-insensitive) are pipeline documentation and are ignored entirely. Other unsupported formats, including `.pptx`, `.rtf`, audio/image/ZIP/XLSX files, and incidental code/config files, are audited as skipped sources.

## Run the full pipeline

The defaults use `/Users/tomas/apps/simmonds-teaching-import/` as the read-only source and `training/ingest/output/` as the destination:

```bash
PYTHON_BIN=/tmp/simmonds-ingest-venv/bin/python training/ingest/run_all.sh
```

Optional positional arguments override source and destination:

```bash
PYTHON_BIN=python3.12 training/ingest/run_all.sh /path/to/source /path/to/output
```

`run_all.sh` uses `set -euo pipefail` and runs extraction, classification on original records, anonymization, and conversion in order.

## Run stages independently

```bash
python3.12 training/ingest/extract.py \
  --source /Users/tomas/apps/simmonds-teaching-import/ \
  --out-dir training/ingest/output/

python3.12 training/ingest/classify.py \
  --in training/ingest/output/extracted.jsonl \
  --out-dir training/ingest/output/

python3.12 training/ingest/anonymize.py \
  --in training/ingest/output/classified.jsonl \
  --out-dir training/ingest/output/

python3.12 training/ingest/to_training.py \
  --in training/ingest/output/anonymized.jsonl \
  --out-dir training/ingest/output/
```

Extraction writes `extracted.jsonl`, `skipped.json`, `extract_failures.json`, and `extract_summary.json`. Every extracted row has both a display `relpath` and an original `sourceRelpath`. PDF text comes from PyMuPDF, DOCX paragraph text from python-docx, legacy DOC text from `textutil`, and TXT/Markdown text from UTF-8 reads. Extracted text is capped at 100,000 characters per document. Unsupported files are never text-extracted; their relative path, extension, and byte size are audited instead.

Classification writes `classified.jsonl`, `buckets.json`, and one `bucket_<name>.jsonl` file for each of the seven buckets. It runs before anonymization so original paths, folders, and text drive the decision, and it persists the selected `bucket` on every record. Strong relpath/text keywords take precedence over top-level folder defaults. The original `sourceRelpath` remains unchanged downstream for deterministic classification and canonical-pricing checks; it is PII-adjacent and must not be used as display provenance.

Anonymization consumes `classified.jsonl` and writes `anonymized.jsonl` and `anonymize_audit.json`. It requires and preserves the persisted bucket. It replaces the required seed names, conservative name candidates found in filenames, email addresses, phone-like digit sequences, German/UK street addresses, names in salutations, and signature-like lines. It anonymizes the display `relpath`, folder, and document text so downstream topics and provenance do not leak seed names while leaving `sourceRelpath` unchanged. `Simmonds` is kept in document text with explicit company cues such as `Sprachschule Simmonds`, `Firma Simmonds`, `Simmonds Language Services`, `Simmonds Sprachdienste`, `Simmonds English School`, `Simmonds Ltd`, `Simmonds GmbH`, `Simmonds team`, employer-style `at Simmonds`, and `g.page/`/`google.com/` URL slugs. An immediately preceding title or known person name, with an optional middle initial, always takes precedence and makes the surname personal; uncued or ambiguous uses are also stripped. The audit reports `PERSON`, `PRICE`, `EMAIL`, `PHONE`, `ADDRESS`, `SIMMONDS_BRAND_KEPT`, `SIMMONDS_PERSON_STRIPPED`, and offer-only `KUNDE` counters.

Conversion writes `content_blocks.jsonl`, `sft_pairs.jsonl`, and `stats.json`. Worksheet-sized lesson, placement, and evaluation documents become Convex `contentBlocks` candidates. Exercise markers take priority, followed by grammar keywords, with reading passage as the lesson-material fallback. Placement tests use `exerciseAtom`. Evaluation rubrics use `culturalNote` because the current Convex schema has no rubric-specific block type; its `note` field is repurposed as a free-text rubric body. This is a schema limitation, and every generated candidate remains `unreviewed`.

Raw documents do not provide trustworthy answer keys. Generated `exerciseAtom` bodies therefore use the non-empty placeholder `see full text` and retain the anonymized source in `referenceText` for human review.

## Offer archive ingestion

Client offers use the `offer` bucket. A document enters this bucket when its source folder path contains `Angebote` (case-insensitive), or when its filename/text contains `Angebot` together with either `Kurskonzept` or `Preise`. The existing placement, template/AGB, and evaluation rules run first so those more specific document types keep their established buckets.

An original `sourceRelpath` containing `Pricing document 26` or `Preisübersicht` also enters the `offer` bucket, after the stronger placement, template/AGB, and evaluation rules. Euro prices are masked in every offer as `[XX] Euro` or `[XX] €` except when `sourceRelpath` contains the canonical marker folder `Pricing document 26` (case-insensitive).

Only `offer` records receive the additional client-company anonymization pass. Capitalized multi-word company names ending in `GmbH`, `AG`, `KG`, `GbR`, `mbH`, or `e.V.` become `[KUNDE]`; existing Simmonds brand protection remains authoritative, so entities such as `Simmonds Sprachschule GmbH` are preserved. Other buckets do not run this pass.

Offers from 200 through 4,000 characters become one `offerLetter`; shorter documents are skipped as `tooShort`. Longer offers use a boundary near 1,500 characters for the letter and convert the remainder into `offerSection` blocks. Heading-delimited or heading-free section prose longer than about 1,500 characters is split again at paragraph, sentence, or word boundaries into roughly 800–1,500-character chunks. Every offer block is human, proprietary content attributed to `Simmonds Angebotsarchiv`. The schema requires a CEFR level even though offers are not learner-levelled, so the converter stores `level="B1"` as a deliberate modeling wart until the shared content-block model can represent non-CEFR material.

The source archive does not need to contain an `Angebote` folder. Extraction logs an informational skip message and continues with the available folders; pointing extraction directly at a missing `Angebote` path likewise produces empty extraction artifacts instead of an exception or stack trace.

## Human anonymization spot-check

`anonymize_audit.json` is an aggregate replacement count, not proof that every identifier was found. A reviewer should:

1. Confirm the privacy counts (`PERSON`, `PRICE`, `EMAIL`, `PHONE`, `ADDRESS`, and `KUNDE`) are plausible and investigate a surprising zero where replacements are expected.
2. Search `anonymized.jsonl`, `content_blocks.jsonl`, and `sft_pairs.jsonl` case-insensitively for every known seed name and any newly discovered names from filenames.
3. Randomly sample records from every top-level folder, especially templates, evaluations, salutations, and final signature lines.
4. Check that explicit company uses of `Simmonds` remain readable while personal or ambiguous surname uses are gone.
5. Treat all outputs as internal and PII-adjacent until a human has completed this review.

## Tests

```bash
uv run --with pytest --with pymupdf --with python-docx \
  -m pytest training/ingest/tests
```

If dependencies are already available in the active environment, `python -m pytest training/ingest/tests` is equivalent.
