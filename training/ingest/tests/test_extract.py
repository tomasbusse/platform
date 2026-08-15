import json
from pathlib import Path

from training.ingest.anonymize import write_anonymized
from training.ingest.classify import classify_records, read_jsonl
from training.ingest.extract import extract_corpus
from training.ingest.to_training import build_training_outputs


def _extracted_rows(out_dir: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in (out_dir / "extracted.jsonl").read_text(encoding="utf-8").splitlines()
    ]


def test_missing_angebote_source_folder_is_skipped_with_clear_message(tmp_path, capsys):
    missing_source = tmp_path / "Angebote"

    summary = extract_corpus(missing_source, tmp_path / "output")

    captured = capsys.readouterr()
    assert summary["totalFiles"] == 0
    assert "Angebote" in captured.out
    assert "skip" in captured.out.casefold()


def test_txt_file_is_extracted_as_utf8_text(tmp_path):
    source = tmp_path / "Angebote"
    source.mkdir()
    (source / "angebot.txt").write_text("Grüße aus Berlin", encoding="utf-8")

    out_dir = tmp_path / "output"
    summary = extract_corpus(source, out_dir)

    assert summary["success"] == 1
    assert _extracted_rows(out_dir)[0]["text"] == "Grüße aus Berlin"


def test_markdown_file_is_extracted_as_utf8_text(tmp_path):
    source = tmp_path / "Angebote"
    source.mkdir()
    (source / "angebot.md").write_text("# Angebot\n\nEin Absatz.", encoding="utf-8")

    out_dir = tmp_path / "output"
    summary = extract_corpus(source, out_dir)

    assert summary["success"] == 1
    assert _extracted_rows(out_dir)[0]["text"] == "# Angebot\n\nEin Absatz."


def test_readme_txt_is_skipped_entirely_and_not_counted_as_a_document(tmp_path):
    source = tmp_path / "Angebote"
    source.mkdir()
    (source / "README.TXT").write_text("Pipeline documentation", encoding="utf-8")

    out_dir = tmp_path / "output"
    summary = extract_corpus(source, out_dir)

    assert summary["totalFiles"] == 0
    assert summary["success"] == 0
    assert summary["skipped"] == 0
    assert _extracted_rows(out_dir) == []


def test_pipeline_classifies_original_path_then_anonymizes_with_bucket_preserved(tmp_path):
    source = tmp_path / "Angebote"
    source.mkdir()
    filename = "Simmonds Language Services_Preisübersicht.txt"
    (source / filename).write_text(
        "Unser Kursangebot umfasst individuelle Einheiten und Lernbegleitung. " * 5,
        encoding="utf-8",
    )
    out_dir = tmp_path / "output"

    extract_corpus(source, out_dir)
    extracted = _extracted_rows(out_dir)
    assert extracted[0]["sourceRelpath"] == filename

    classify_records(extracted, out_dir)
    classified = read_jsonl(out_dir / "classified.jsonl")
    assert classified[0]["bucket"] == "offer"
    assert classified[0]["relpath"] == filename

    write_anonymized(out_dir / "classified.jsonl", out_dir)
    anonymized = read_jsonl(out_dir / "anonymized.jsonl")
    assert anonymized[0]["bucket"] == "offer"
    assert anonymized[0]["sourceRelpath"] == filename
    assert anonymized[0]["relpath"] == "[PERSON] Language Services_Preisübersicht.txt"

    stats = build_training_outputs(anonymized, out_dir)
    blocks = read_jsonl(out_dir / "content_blocks.jsonl")
    assert stats["contentBlocks"]["total"] == 1
    assert blocks[0]["blockType"] == "offerLetter"


def test_run_all_orders_classification_before_anonymization():
    script = (Path(__file__).parents[1] / "run_all.sh").read_text(encoding="utf-8")

    commands = [
        line
        for line in script.splitlines()
        if '"${SCRIPT_DIR}/' in line and '"${PYTHON_BIN}"' in line
    ]
    assert [command.split('"${SCRIPT_DIR}/', 1)[1].split('"', 1)[0] for command in commands] == [
        "extract.py",
        "classify.py",
        "anonymize.py",
        "to_training.py",
    ]
    assert 'classify.py" --in "${OUT_DIR}/extracted.jsonl"' in script
    assert 'anonymize.py" --in "${OUT_DIR}/classified.jsonl"' in script
    assert 'to_training.py" --in "${OUT_DIR}/anonymized.jsonl"' in script
