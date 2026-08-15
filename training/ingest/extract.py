#!/usr/bin/env python3
"""Extract text and metadata from the local Simmonds teaching corpus."""

from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable


DEFAULT_SOURCE = Path("/Users/tomas/apps/simmonds-teaching-import/")
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "output"
MAX_CHARS = 100_000
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}


def extract_pdf(path: Path) -> str:
    """Return page text from a PDF using PyMuPDF."""

    import fitz

    with fitz.open(path) as document:
        return "".join(page.get_text() for page in document)


def extract_docx(path: Path) -> str:
    """Return paragraph text from a DOCX using python-docx."""

    from docx import Document

    document = Document(path)
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def extract_doc(path: Path) -> str:
    """Return legacy Word text using the macOS textutil executable."""

    completed = subprocess.run(
        ["textutil", "-convert", "txt", "-stdout", str(path)],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    return completed.stdout


def extract_plain_text(path: Path) -> str:
    """Return UTF-8 text from a plain-text or Markdown document."""

    return path.read_text(encoding="utf-8")


EXTRACTORS: dict[str, Callable[[Path], str]] = {
    ".pdf": extract_pdf,
    ".docx": extract_docx,
    ".doc": extract_doc,
    ".txt": extract_plain_text,
    ".md": extract_plain_text,
}


def _extension(path: Path) -> str:
    return path.suffix.casefold() or "[none]"


def _json_dump(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def extract_corpus(source: Path, out_dir: Path) -> dict[str, object]:
    """Walk *source*, write extraction artifacts, and return summary counters."""

    source = source.expanduser().resolve()
    out_dir = out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not source.exists():
        print(f"Info: source folder {source} does not exist; skipping extraction.")
    elif "angebote" not in source.name.casefold() and not any(
        child.is_dir() and "angebote" in child.name.casefold()
        for child in source.iterdir()
    ):
        print(
            f"Info: Angebote source folder not found under {source}; "
            "skipping offer documents."
        )

    files = sorted(
        (
            path
            for path in source.rglob("*")
            if path.is_file() and path.name.casefold() != "readme.txt"
        ),
        key=lambda path: path.relative_to(source).as_posix().casefold(),
    )
    extension_counts: Counter[str] = Counter()
    status_by_extension: dict[str, Counter[str]] = {}
    skipped: list[dict[str, object]] = []
    failures: list[dict[str, str]] = []
    successes = 0

    extracted_path = out_dir / "extracted.jsonl"
    with extracted_path.open("w", encoding="utf-8") as output:
        for path in files:
            relpath = path.relative_to(source).as_posix()
            extension = _extension(path)
            extension_counts[extension] += 1
            extension_status = status_by_extension.setdefault(extension, Counter())

            if extension not in SUPPORTED_EXTENSIONS:
                try:
                    size_bytes = path.stat().st_size
                except OSError as error:
                    failures.append({"relpath": relpath, "error": str(error)})
                    extension_status["failure"] += 1
                    continue
                skipped.append(
                    {"relpath": relpath, "ext": extension, "sizeBytes": size_bytes}
                )
                extension_status["skipped"] += 1
                continue

            try:
                stat = path.stat()
                raw_text = EXTRACTORS[extension](path)
                truncated = len(raw_text) > MAX_CHARS
                text = raw_text[:MAX_CHARS]
                record = {
                    "relpath": relpath,
                    "sourceRelpath": relpath,
                    "folder": Path(relpath).parts[0],
                    "modifiedAt": datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    ).isoformat(),
                    "chars": len(text),
                    "truncated": truncated,
                    "text": text,
                }
                output.write(_json_dump(record) + "\n")
                successes += 1
                extension_status["success"] += 1
            except Exception as error:  # one corrupt source must not abort the corpus run
                failures.append(
                    {"relpath": relpath, "error": f"{type(error).__name__}: {error}"}
                )
                extension_status["failure"] += 1

    (out_dir / "skipped.json").write_text(
        json.dumps(skipped, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (out_dir / "extract_failures.json").write_text(
        json.dumps(failures, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    summary: dict[str, object] = {
        "extensions": dict(sorted(extension_counts.items())),
        "success": successes,
        "failure": len(failures),
        "skipped": len(skipped),
        "statusByExtension": {
            extension: {
                status: status_by_extension[extension][status]
                for status in ("success", "failure", "skipped")
            }
            for extension in sorted(status_by_extension)
        },
        "totalFiles": len(files),
    }
    (out_dir / "extract_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    extract_corpus(args.source, args.out_dir)


if __name__ == "__main__":
    main()
