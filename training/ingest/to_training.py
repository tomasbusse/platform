#!/usr/bin/env python3
"""Convert classified local documents into content-block and SFT candidates."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable


DEFAULT_IN = Path(__file__).resolve().parent / "output" / "anonymized.jsonl"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "output"
SYSTEM = (
    "You are the Simmonds English content engine: professional English lessons "
    "for adult German-L1 learners, CEFR-strict, never childish, English content "
    "with brief German hints only where pedagogically useful."
)
CONTENT_BUCKETS = {"lesson_material", "placement_test", "evaluation_rubric", "offer"}
EXERCISE_RE = re.compile(
    r"_{3,}|\ba\)\s*.+?\bb\)\s*.+?\bc\)|"
    r"\b1\.\s*_{2,}.*?\b2\.\s*_{2,}|choose the correct|fill in the blank",
    re.IGNORECASE | re.DOTALL,
)
GRAMMAR_RE = re.compile(r"\btense\b|\bgrammar\b|conjugation|grammatik", re.IGNORECASE)
EXAMPLE_RE = re.compile(r"\bexample\b|\be\.g\.|\bfor example\b|\bbeispiel\b", re.IGNORECASE)


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as input_file:
        for line_number, line in enumerate(input_file, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"Expected object at {path}:{line_number}")
            rows.append(value)
    return rows


def clean_topic(relpath: str) -> str:
    stem = Path(relpath).stem
    cleaned = re.sub(r"[_-]+", " ", stem)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned or "Untitled material"


def infer_level(record: dict) -> str:
    haystack = f"{record.get('relpath', '')}\n{record.get('text', '')}"
    if re.search(r"\bbeginner\b|\bA1\b|\bA2\b|anfänger", haystack, re.IGNORECASE):
        return "A2"
    if re.search(r"upper[ -]intermediate|\bB2\b", haystack, re.IGNORECASE):
        return "B2"
    if re.search(r"\badvanced\b|\bC1\b|\bC2\b", haystack, re.IGNORECASE):
        return "C1"
    return "B1"


def infer_block_type(record: dict) -> str:
    bucket = str(record["bucket"])
    text = str(record.get("text", ""))
    if bucket == "offer":
        return "offerLetter"
    if bucket == "placement_test":
        return "exerciseAtom"
    if bucket == "evaluation_rubric":
        return "culturalNote"
    if EXERCISE_RE.search(text):
        return "exerciseAtom"
    if GRAMMAR_RE.search(text):
        return "grammarExplainer"
    return "readingPassage"


def _example_lines(text: str) -> list[str]:
    examples = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and EXAMPLE_RE.search(line) and len(line.strip()) <= 500
    ][:5]
    return examples or ["See the full source material for examples."]


def make_body(block_type: str, text: str) -> dict:
    if block_type == "exerciseAtom":
        prompt = text[:400].strip() or "Complete the exercise using the reference text."
        return {
            "exerciseType": "short_answer",
            "prompt": prompt,
            "answerKey": "see full text",
            "referenceText": text,
        }
    if block_type == "readingPassage":
        return {
            "text": text[:6000],
            "questions": ["What is the main topic of this passage?"],
        }
    if block_type == "grammarExplainer":
        return {"explanation": text[:1500], "examples": _example_lines(text)}
    if block_type == "culturalNote":
        return {"note": text[:4000]}
    raise ValueError(f"Unsupported block type: {block_type}")


def _build_content_block(
    record: dict,
    block_type: str,
    body: dict,
    *,
    title: str | None = None,
) -> dict:
    topic = clean_topic(str(record.get("relpath", "")))
    digest_payload = json.dumps({"blockType": block_type, "body": body}, sort_keys=True)
    is_offer = str(record.get("bucket", "")) == "offer"
    return {
        "companyId": None,
        "blockType": block_type,
        "level": "B1" if is_offer else infer_level(record),
        "skill": "writing"
        if is_offer
        else {
            "grammarExplainer": "grammar",
            "readingPassage": "reading",
        }.get(block_type, "mixed"),
        "topic": topic,
        "title": title or topic,
        "body": body,
        "source": "human",
        "provenance": str(record.get("relpath", "")),
        "rightsStatus": "proprietary",
        "attribution": "Simmonds Angebotsarchiv"
        if is_offer
        else "Simmonds internal material",
        "reviewStatus": "unreviewed",
        "exemplarEligible": True,
        "contentHash": hashlib.sha256(digest_payload.encode("utf-8")).hexdigest(),
    }


def make_content_block(record: dict) -> dict:
    """Build the single content block used by all non-offer buckets."""

    text = str(record.get("text", ""))
    block_type = infer_block_type(record)
    return _build_content_block(record, block_type, make_body(block_type, text))


def _split_near_boundary(text: str, target: int = 1500) -> tuple[str, str]:
    """Split near *target*, preferring paragraph, sentence, then word boundaries."""

    lower = max(1, target - 600)
    upper = min(len(text) - 1, target + 600)
    paragraph_boundaries = [
        match.start()
        for match in re.finditer(r"\n\s*\n", text)
        if lower <= match.start() <= upper
    ]
    if paragraph_boundaries:
        boundary = min(paragraph_boundaries, key=lambda position: abs(position - target))
    else:
        sentence_boundaries = [
            match.end()
            for match in re.finditer(r"[.!?](?:[ \t]+|\n+)", text)
            if lower <= match.end() <= upper
        ]
        if sentence_boundaries:
            boundary = min(sentence_boundaries, key=lambda position: abs(position - target))
        else:
            spaces = [
                position
                for position in range(lower, upper + 1)
                if text[position].isspace()
            ]
            boundary = min(spaces, key=lambda position: abs(position - target)) if spaces else target
    return text[:boundary].strip(), text[boundary:].strip()


def _is_offer_heading(line: str) -> bool:
    candidate = line.strip()
    if not candidate or len(candidate) > 100 or len(candidate.split()) > 10:
        return False
    if candidate[-1] in ".!?:;,":
        return False
    first_alpha = next((character for character in candidate if character.isalpha()), "")
    return bool(first_alpha and first_alpha.isupper())


def _split_offer_sections(text: str) -> list[tuple[str, str]]:
    groups: list[tuple[str | None, str]] = []
    current_heading: str | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_lines
        chunk = "\n".join(current_lines).strip()
        if chunk:
            groups.append((current_heading, chunk))
        current_lines = []

    for line in text.splitlines():
        if _is_offer_heading(line):
            flush()
            current_heading = line.strip()
        else:
            current_lines.append(line)
    flush()

    sections: list[tuple[str, str]] = []
    for heading, group_text in groups:
        for section_text in _split_long_offer_chunk(group_text):
            section_number = len(sections) + 1
            sections.append((heading or f"Abschnitt {section_number}", section_text))
    return sections


def _split_long_offer_chunk(
    text: str, *, target: int = 1200, minimum: int = 800, maximum: int = 1500
) -> list[str]:
    """Split long section prose at paragraph, sentence, or word boundaries."""

    remaining = text.strip()
    chunks: list[str] = []
    while len(remaining) > maximum:
        if len(remaining) <= maximum * 2:
            preferred = len(remaining) // 2
        else:
            preferred = target
        minimum_tail = min(600, len(remaining) - maximum)
        lower = min(minimum, preferred)
        upper = min(maximum, len(remaining) - minimum_tail)

        paragraph_boundaries = [
            match.start()
            for match in re.finditer(r"\n\s*\n", remaining)
            if lower <= match.start() <= upper
        ]
        sentence_boundaries = [
            match.end()
            for match in re.finditer(r"[.!?](?:[ \t]+|\n+)", remaining)
            if lower <= match.end() <= upper
        ]
        word_boundaries = [
            position
            for position in range(lower, upper + 1)
            if remaining[position].isspace()
        ]
        candidates = paragraph_boundaries or sentence_boundaries or word_boundaries
        boundary = (
            min(candidates, key=lambda position: abs(position - preferred))
            if candidates
            else min(max(preferred, lower), upper)
        )
        chunk = remaining[:boundary].strip()
        if not chunk:
            boundary = upper
            chunk = remaining[:boundary].strip()
        chunks.append(chunk)
        remaining = remaining[boundary:].strip()

    if remaining:
        chunks.append(remaining)
    return chunks


def make_offer_content_blocks(record: dict) -> list[dict]:
    """Build one offer letter and, for long documents, reusable offer sections."""

    text = str(record.get("text", ""))
    betreff = clean_topic(str(record.get("relpath", "")))
    if len(text) <= 4000:
        return [
            _build_content_block(
                record,
                "offerLetter",
                {"betreff": betreff, "anschreiben": text},
            )
        ]

    anschreiben, remainder = _split_near_boundary(text)
    blocks = [
        _build_content_block(
            record,
            "offerLetter",
            {"betreff": betreff, "anschreiben": anschreiben},
        )
    ]
    for heading, section_text in _split_offer_sections(remainder):
        blocks.append(
            _build_content_block(
                record,
                "offerSection",
                {"heading": heading, "text": section_text},
                title=heading,
            )
        )
    return blocks


def make_content_blocks(record: dict) -> list[dict]:
    if str(record.get("bucket", "")) == "offer":
        return make_offer_content_blocks(record)
    return [make_content_block(record)]


def make_sft_pair(record: dict) -> dict:
    topic = clean_topic(str(record.get("relpath", "")))
    level = infer_level(record)
    return {
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": f'Create a worksheet/exercise in Simmonds style on "{topic}" for {level}.',
            },
            {"role": "assistant", "content": str(record.get("text", ""))[:20000]},
        ]
    }


def _skip_reason(
    chars: int, maximum: int, bucket_allowed: bool, minimum: int = 200
) -> str | None:
    if chars < minimum:
        return "tooShort"
    if chars > maximum:
        return "tooLong"
    if not bucket_allowed:
        return "wrongBucket"
    return None


def build_training_outputs(records: Iterable[dict], out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    block_type_counts: Counter[str] = Counter()
    level_counts: Counter[str] = Counter()
    content_skips: Counter[str] = Counter()
    sft_skips: Counter[str] = Counter()
    content_total = 0
    sft_total = 0
    document_total = 0

    with (out_dir / "content_blocks.jsonl").open(
        "w", encoding="utf-8"
    ) as content_output, (out_dir / "sft_pairs.jsonl").open(
        "w", encoding="utf-8"
    ) as sft_output:
        for record in records:
            document_total += 1
            chars = int(record.get("chars", len(str(record.get("text", "")))))
            bucket = str(record.get("bucket", "other"))

            content_maximum = 100_000 if bucket == "offer" else 8000
            content_reason = _skip_reason(
                chars,
                content_maximum,
                bucket in CONTENT_BUCKETS,
                minimum=200,
            )
            if content_reason is None:
                for block in make_content_blocks(record):
                    content_output.write(
                        json.dumps(block, ensure_ascii=False, sort_keys=True) + "\n"
                    )
                    content_total += 1
                    block_type_counts[block["blockType"]] += 1
                    level_counts[block["level"]] += 1
            else:
                content_skips[content_reason] += 1

            sft_reason = _skip_reason(chars, 20000, bucket != "other")
            if sft_reason is None:
                pair = make_sft_pair(record)
                sft_output.write(
                    json.dumps(pair, ensure_ascii=False, sort_keys=True) + "\n"
                )
                sft_total += 1
            else:
                sft_skips[sft_reason] += 1

    stats = {
        "documents": document_total,
        "contentBlocks": {
            "total": content_total,
            "byBlockType": dict(sorted(block_type_counts.items())),
            "byLevel": dict(sorted(level_counts.items())),
        },
        "sftPairs": sft_total,
        "skipped": {
            "contentBlocks": {
                reason: content_skips[reason]
                for reason in ("tooShort", "tooLong", "wrongBucket")
            },
            "sftPairs": {
                reason: sft_skips[reason]
                for reason in ("tooShort", "tooLong", "wrongBucket")
            },
        },
    }
    (out_dir / "stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2, sort_keys=True))
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="in_path", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_training_outputs(read_jsonl(args.in_path), args.out_dir)


if __name__ == "__main__":
    main()
