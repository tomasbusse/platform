#!/usr/bin/env python3
"""Build a chat-format SFT dataset from a Convex snapshot export."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import random
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Sequence


SYSTEM = (
    "You are the Simmonds English content engine: professional English lessons "
    "for adult German-L1 learners, CEFR-strict, never childish, English content "
    "with brief German hints only where pedagogically useful."
)


@dataclass(frozen=True)
class Example:
    """One output record plus metadata used only for aggregate statistics."""

    record: dict[str, Any]
    task: str
    level: str | None = None
    block_type: str | None = None


@dataclass
class DatasetResult:
    """The filtered examples and audit counters produced while building them."""

    examples: list[Example]
    dropped_by_rights: Counter[str]
    dropped_duplicates: int

    def stats(self, min_pairs: int) -> dict[str, Any]:
        by_task = Counter(example.task for example in self.examples)
        by_level = Counter(
            example.level
            for example in self.examples
            if example.task == "A" and example.level is not None
        )
        by_block_type = Counter(
            example.block_type
            for example in self.examples
            if example.task == "A" and example.block_type is not None
        )
        total = len(self.examples)
        return {
            "total": total,
            "byTask": {"A": by_task["A"], "B": by_task["B"]},
            "byLevel": dict(sorted(by_level.items())),
            "byBlockType": dict(sorted(by_block_type.items())),
            "droppedByRights": dict(sorted(self.dropped_by_rights.items())),
            "gate": {"minPairs": min_pairs, "met": total >= min_pairs},
        }


def _table_entry_name(names: Iterable[str], table_name: str) -> str:
    """Find a table JSONL entry without assuming a fixed Convex zip layout."""

    wanted = table_name.casefold()
    candidates: list[tuple[int, int, str]] = []
    for name in names:
        if not name.casefold().endswith(".jsonl"):
            continue
        path = PurePosixPath(name)
        parts = [part.casefold() for part in path.parts]
        stem = path.stem.casefold()
        lowered = name.casefold()
        if wanted in parts:
            score = 3
        elif stem == wanted:
            score = 2
        elif wanted in lowered:
            score = 1
        else:
            continue
        candidates.append((-score, len(path.parts), name))

    if not candidates:
        raise ValueError(f"No JSONL entry found for table {table_name!r}")
    candidates.sort()
    return candidates[0][2]


def read_table_rows(snapshot: str | Path, table_name: str) -> list[dict[str, Any]]:
    """Read one table from a Convex export zip and return its JSON objects."""

    rows: list[dict[str, Any]] = []
    with zipfile.ZipFile(snapshot) as archive:
        entry_name = _table_entry_name(archive.namelist(), table_name)
        with archive.open(entry_name) as raw_file:
            with io.TextIOWrapper(raw_file, encoding="utf-8") as text_file:
                for line_number, line in enumerate(text_file, start=1):
                    if not line.strip():
                        continue
                    try:
                        row = json.loads(line)
                    except json.JSONDecodeError as error:
                        raise ValueError(
                            f"Invalid JSON in {entry_name} at line {line_number}"
                        ) from error
                    if not isinstance(row, dict):
                        raise ValueError(
                            f"Expected a JSON object in {entry_name} at line {line_number}"
                        )
                    rows.append(row)
    return rows


def _sort_rows(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            str(row.get("_id", "")),
            json.dumps(row, ensure_ascii=False, sort_keys=True),
        ),
    )


def build_task_a_examples(
    rows: Iterable[dict[str, Any]],
    include_seed: bool = False,
) -> tuple[list[Example], Counter[str]]:
    """Filter contentBlocks and convert eligible rows to Task A examples."""

    examples: list[Example] = []
    dropped_by_rights: Counter[str] = Counter()

    for row in _sort_rows(rows):
        if row.get("reviewStatus") == "rejected":
            continue
        eligible = row.get("reviewStatus") == "teacher_approved" or (
            include_seed and row.get("source") == "seed_corpus"
        )
        if not eligible:
            continue

        rights_status = row.get("rightsStatus")
        if rights_status in {"cc_by_sa", "unknown"}:
            dropped_by_rights[str(rights_status)] += 1
            continue

        block_type = str(row["blockType"])
        level = str(row["level"])
        skill = str(row["skill"])
        topic = str(row["topic"])
        assistant_content = json.dumps(
            {
                "title": row["title"],
                "topic": row["topic"],
                "body": row["body"],
            },
            ensure_ascii=False,
        )
        record = {
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": (
                        f"Create one {block_type} content block for CEFR {level}, "
                        f'skill {skill}, topic "{topic}". Return ONLY JSON with keys '
                        f"title, topic, body matching the {block_type} body shape."
                    ),
                },
                {"role": "assistant", "content": assistant_content},
            ]
        }
        examples.append(
            Example(record=record, task="A", level=level, block_type=block_type)
        )

    return examples, dropped_by_rights


def build_task_b_examples(rows: Iterable[dict[str, Any]]) -> list[Example]:
    """Convert genuine, non-rejected aiContent edits to Task B examples."""

    examples: list[Example] = []
    for row in _sort_rows(rows):
        if row.get("reviewStatus") == "rejected":
            continue
        generated_content = row.get("generatedContent")
        published_output = row.get("publishedOutput")
        if not isinstance(published_output, str) or not published_output.strip():
            continue
        if published_output == generated_content:
            continue

        record = {
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": (
                        "Here is a draft lesson JSON:\n"
                        f"{generated_content}\n"
                        "Revise it to final publishable Simmonds quality. Return only "
                        "the revised JSON."
                    ),
                },
                {"role": "assistant", "content": published_output},
            ]
        }
        examples.append(Example(record=record, task="B"))
    return examples


def deduplicate_examples(examples: Iterable[Example]) -> tuple[list[Example], int]:
    """Keep the first example for each assistant-content SHA-256 digest."""

    deduplicated: list[Example] = []
    seen: set[str] = set()
    dropped = 0
    for example in examples:
        assistant_content = example.record["messages"][2]["content"]
        digest = hashlib.sha256(assistant_content.encode("utf-8")).hexdigest()
        if digest in seen:
            dropped += 1
            continue
        seen.add(digest)
        deduplicated.append(example)
    return deduplicated, dropped


def build_dataset(
    snapshot: str | Path,
    include_seed: bool = False,
) -> DatasetResult:
    """Build, gate, and deduplicate the combined Task A/Task B pool."""

    content_rows = read_table_rows(snapshot, "contentBlocks")
    ai_rows = read_table_rows(snapshot, "aiContent")
    task_a, dropped_by_rights = build_task_a_examples(content_rows, include_seed)
    task_b = build_task_b_examples(ai_rows)
    examples, dropped_duplicates = deduplicate_examples([*task_a, *task_b])
    return DatasetResult(examples, dropped_by_rights, dropped_duplicates)


def split_examples(
    examples: Sequence[Example],
    val_split: float,
    seed: int,
) -> tuple[list[Example], list[Example]]:
    """Shuffle deterministically and return train and validation partitions."""

    if not 0.0 <= val_split <= 1.0:
        raise ValueError("val_split must be between 0 and 1")
    shuffled = list(examples)
    random.Random(seed).shuffle(shuffled)
    val_count = max(0, min(len(shuffled), round(len(shuffled) * val_split)))
    validation = shuffled[:val_count]
    training = shuffled[val_count:]
    return training, validation


def _write_jsonl(path: Path, examples: Iterable[Example]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as output:
        for example in examples:
            output.write(json.dumps(example.record, ensure_ascii=False) + "\n")


def write_dataset(
    result: DatasetResult,
    out_dir: str | Path,
    min_pairs: int,
    val_split: float,
    seed: int,
) -> dict[str, Any]:
    """Split and write dataset artifacts, returning the emitted statistics."""

    output_path = Path(out_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    training, validation = split_examples(result.examples, val_split, seed)
    _write_jsonl(output_path / "train.jsonl", training)
    _write_jsonl(output_path / "val.jsonl", validation)
    stats = result.stats(min_pairs)
    with (output_path / "stats.json").open(
        "w", encoding="utf-8", newline="\n"
    ) as output:
        json.dump(stats, output, ensure_ascii=False, indent=2)
        output.write("\n")
    return stats


def gate_exit_code(stats: dict[str, Any]) -> int:
    return 0 if stats["gate"]["met"] else 2


def print_gate_message(stats: dict[str, Any]) -> None:
    total = stats["total"]
    minimum = stats["gate"]["minPairs"]
    if stats["gate"]["met"]:
        print(f"GATE MET ({total}/{minimum})")
    else:
        print(f"GATE NOT MET ({total}/{minimum})", file=sys.stderr)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export Convex content as a chat-format fine-tuning dataset."
    )
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--min-pairs", type=int, default=500)
    parser.add_argument("--val-split", type=float, default=0.05)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--include-seed", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    result = build_dataset(args.snapshot, include_seed=args.include_seed)
    stats = write_dataset(
        result,
        args.out,
        min_pairs=args.min_pairs,
        val_split=args.val_split,
        seed=args.seed,
    )
    print_gate_message(stats)
    return gate_exit_code(stats)


if __name__ == "__main__":
    raise SystemExit(main())
