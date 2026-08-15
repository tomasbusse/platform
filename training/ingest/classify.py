#!/usr/bin/env python3
"""Classify original teaching documents into deterministic content buckets."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path


DEFAULT_IN = Path(__file__).resolve().parent / "output" / "extracted.jsonl"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "output"
BUCKETS = (
    "lesson_material",
    "placement_test",
    "evaluation_rubric",
    "service_description",
    "template_brand",
    "offer",
    "other",
)
FOLDER_DEFAULTS = {
    "Einstufung": "placement_test",
    "Evaluation": "evaluation_rubric",
    "Services": "service_description",
    "Templates+AGB": "template_brand",
    "James' shared material": "lesson_material",
    "[PERSON]' shared material": "lesson_material",
    "Material": "lesson_material",
}
KEYWORD_RULES = (
    ("placement_test", re.compile(r"einstufung|placement", re.IGNORECASE)),
    ("template_brand", re.compile(r"\bagb\b|template|impressum", re.IGNORECASE)),
    (
        "evaluation_rubric",
        re.compile(r"evaluierung|rubric|bewertung", re.IGNORECASE),
    ),
)
OFFER_FOLDER_RE = re.compile(r"angebote", re.IGNORECASE)
OFFER_KEYWORD_RE = re.compile(r"angebot", re.IGNORECASE)
OFFER_CONTEXT_RE = re.compile(r"kurskonzept|preise", re.IGNORECASE)
SERVICE_DESCRIPTION_RE = re.compile(
    r"angebot|preise|pricing|leistungen", re.IGNORECASE
)
CANONICAL_OFFER_RE = re.compile(r"Pricing document 26|Preisübersicht", re.IGNORECASE)


def classify_record(record: dict) -> str:
    """Return one bucket using strong keywords before top-level folder defaults."""

    folder = str(record.get("folder", ""))
    relpath = str(record.get("relpath", ""))
    source_relpath = str(record.get("sourceRelpath", relpath))
    haystack = f"{folder}\n{relpath}\n{source_relpath}\n{record.get('text', '')}"
    for bucket, pattern in KEYWORD_RULES:
        if pattern.search(haystack):
            return bucket
    if CANONICAL_OFFER_RE.search(source_relpath):
        return "offer"
    if OFFER_FOLDER_RE.search(f"{folder}\n{relpath}") or (
        OFFER_KEYWORD_RE.search(haystack) and OFFER_CONTEXT_RE.search(haystack)
    ):
        return "offer"
    if SERVICE_DESCRIPTION_RE.search(haystack):
        return "service_description"
    return FOLDER_DEFAULTS.get(folder, "other")


def read_jsonl(path: Path) -> list[dict]:
    records: list[dict] = []
    with path.open(encoding="utf-8") as input_file:
        for line_number, line in enumerate(input_file, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"Expected object at {path}:{line_number}")
            records.append(value)
    return records


def classify_records(records: list[dict], out_dir: Path) -> dict[str, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    classified_handle = (out_dir / "classified.jsonl").open("w", encoding="utf-8")
    handles = {
        bucket: (out_dir / f"bucket_{bucket}.jsonl").open("w", encoding="utf-8")
        for bucket in BUCKETS
    }
    counts: Counter[str] = Counter({bucket: 0 for bucket in BUCKETS})
    try:
        for record in records:
            bucket = classify_record(record)
            result = dict(record)
            result["bucket"] = bucket
            serialized = json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n"
            classified_handle.write(serialized)
            handles[bucket].write(serialized)
            counts[bucket] += 1
    finally:
        classified_handle.close()
        for handle in handles.values():
            handle.close()

    summary = {bucket: counts[bucket] for bucket in BUCKETS}
    (out_dir / "buckets.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="in_path", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    classify_records(read_jsonl(args.in_path), args.out_dir)


if __name__ == "__main__":
    main()
