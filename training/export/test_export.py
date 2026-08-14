# uv run --with pytest -m pytest test_export.py

import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest


EXPORT_DIR = Path(__file__).resolve().parent


def _write_jsonl(archive: zipfile.ZipFile, name: str, rows: list[dict]) -> None:
    payload = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    archive.writestr(name, payload.encode("utf-8"))


@pytest.fixture
def snapshot(tmp_path: Path) -> Path:
    content_rows = [
        {
            "_id": "block-01",
            "blockType": "vocabSet",
            "level": "B1",
            "skill": "vocabulary",
            "topic": "meetings",
            "title": "Meeting verbs",
            "body": {"items": [{"term": "adjourn", "hint": "vertagen"}]},
            "source": "human",
            "rightsStatus": "proprietary",
            "reviewStatus": "teacher_approved",
        },
        {
            "_id": "block-02",
            "blockType": "dialogue",
            "level": "B1",
            "skill": "speaking",
            "topic": "feedback",
            "title": "Rejected dialogue",
            "body": {"turns": []},
            "source": "human",
            "rightsStatus": "proprietary",
            "reviewStatus": "rejected",
        },
        {
            "_id": "block-03",
            "blockType": "readingPassage",
            "level": "B2",
            "skill": "reading",
            "topic": "leadership",
            "title": "Share-alike passage",
            "body": {"text": "Licensed text"},
            "source": "human",
            "rightsStatus": "cc_by_sa",
            "reviewStatus": "teacher_approved",
        },
        {
            "_id": "block-04",
            "blockType": "grammarExplainer",
            "level": "A2",
            "skill": "grammar",
            "topic": "past tense",
            "title": "Unknown-rights explainer",
            "body": {"rule": "Use the past tense."},
            "source": "human",
            "rightsStatus": "unknown",
            "reviewStatus": "teacher_approved",
        },
        {
            "_id": "block-05",
            "blockType": "sentencePair",
            "level": "A1",
            "skill": "mixed",
            "topic": "introductions",
            "title": "Seed introductions",
            "body": {"source": "Guten Tag", "target": "Good afternoon"},
            "source": "seed_corpus",
            "rightsStatus": "public_domain",
            "reviewStatus": "unreviewed",
        },
        {
            "_id": "block-06",
            "blockType": "vocabSet",
            "level": "B1",
            "skill": "vocabulary",
            "topic": "meetings",
            "title": "Meeting verbs",
            "body": {"items": [{"term": "adjourn", "hint": "vertagen"}]},
            "source": "human",
            "rightsStatus": "proprietary",
            "reviewStatus": "teacher_approved",
        },
    ]
    ai_rows = [
        {
            "_id": "ai-01",
            "reviewStatus": "approved",
            "generatedContent": '{"title":"Unchanged"}',
            "publishedOutput": '{"title":"Unchanged"}',
        },
        {
            "_id": "ai-02",
            "reviewStatus": "approved",
            "generatedContent": '{"title":"Draft"}',
            "publishedOutput": '{"title":"Published lesson"}',
        },
        {
            "_id": "ai-03",
            "reviewStatus": "rejected",
            "generatedContent": '{"title":"Bad draft"}',
            "publishedOutput": '{"title":"Rejected edit"}',
        },
    ]

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("_tables/documents.jsonl", b'{"name":"metadata"}\n')
        _write_jsonl(
            archive,
            "nested/export/contentBlocks/documents.jsonl",
            content_rows,
        )
        _write_jsonl(archive, "tables/aiContent/records.jsonl", ai_rows)

    path = tmp_path / "snapshot.zip"
    path.write_bytes(buffer.getvalue())
    return path


def test_build_dataset_applies_filters_shapes_and_dedup(snapshot: Path) -> None:
    from training.export import export_dataset

    result = export_dataset.build_dataset(snapshot, include_seed=False)

    assert len(result.examples) == 2
    assert result.dropped_duplicates == 1
    assert result.stats(2) == {
        "total": 2,
        "byTask": {"A": 1, "B": 1},
        "byLevel": {"B1": 1},
        "byBlockType": {"vocabSet": 1},
        "droppedByRights": {"cc_by_sa": 1, "unknown": 1},
        "gate": {"minPairs": 2, "met": True},
    }

    records = [example.record for example in result.examples]
    assert all(len(record["messages"]) == 3 for record in records)
    assert all(
        record["messages"][0]
        == {"role": "system", "content": export_dataset.SYSTEM}
        for record in records
    )

    task_a = next(example for example in result.examples if example.task == "A")
    task_b = next(example for example in result.examples if example.task == "B")
    assert json.loads(task_a.record["messages"][2]["content"]) == {
        "title": "Meeting verbs",
        "topic": "meetings",
        "body": {"items": [{"term": "adjourn", "hint": "vertagen"}]},
    }
    assert "CEFR B1" in task_a.record["messages"][1]["content"]
    assert task_b.record["messages"][2]["content"] == '{"title":"Published lesson"}'
    assert "Draft" in task_b.record["messages"][1]["content"]


def test_seed_rows_are_opt_in(snapshot: Path) -> None:
    from training.export import export_dataset

    default_result = export_dataset.build_dataset(snapshot, include_seed=False)
    seed_result = export_dataset.build_dataset(snapshot, include_seed=True)

    assert len(default_result.examples) == 2
    assert len(seed_result.examples) == 3
    assert seed_result.stats(3)["byLevel"] == {"A1": 1, "B1": 1}
    assert seed_result.stats(3)["byBlockType"] == {
        "sentencePair": 1,
        "vocabSet": 1,
    }


def test_seeded_split_is_deterministic(snapshot: Path) -> None:
    from training.export import export_dataset

    examples = export_dataset.build_dataset(snapshot, include_seed=True).examples
    first_train, first_val = export_dataset.split_examples(examples, 0.34, 42)
    second_train, second_val = export_dataset.split_examples(examples, 0.34, 42)

    assert [row.record for row in first_train] == [row.record for row in second_train]
    assert [row.record for row in first_val] == [row.record for row in second_val]
    assert len(first_train) == 2
    assert len(first_val) == 1


@pytest.mark.parametrize(
    ("minimum", "expected_code", "message"),
    [(2, 0, "GATE MET (2/2)"), (3, 2, "GATE NOT MET (2/3)")],
)
def test_gate_check_threshold_boundary(
    snapshot: Path,
    minimum: int,
    expected_code: int,
    message: str,
) -> None:
    completed = subprocess.run(
        [
            sys.executable,
            str(EXPORT_DIR / "gate_check.py"),
            "--snapshot",
            str(snapshot),
            "--min-pairs",
            str(minimum),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == expected_code
    report = json.loads(completed.stdout.splitlines()[0])
    assert report["total"] == 2
    assert report["gate"] == {"minPairs": minimum, "met": expected_code == 0}
    combined_output = completed.stdout + completed.stderr
    assert message in combined_output


def test_export_writes_files_before_failed_gate(snapshot: Path, tmp_path: Path) -> None:
    from training.export import export_dataset

    out_dir = tmp_path / "data"
    code = export_dataset.main(
        [
            "--snapshot",
            str(snapshot),
            "--out",
            str(out_dir),
            "--min-pairs",
            "3",
            "--val-split",
            "0.5",
            "--seed",
            "42",
        ]
    )

    assert code == 2
    assert (out_dir / "train.jsonl").is_file()
    assert (out_dir / "val.jsonl").is_file()
    stats = json.loads((out_dir / "stats.json").read_text(encoding="utf-8"))
    assert list(stats) == [
        "total",
        "byTask",
        "byLevel",
        "byBlockType",
        "droppedByRights",
        "gate",
    ]
    assert stats["total"] == 2
    assert len((out_dir / "train.jsonl").read_text(encoding="utf-8").splitlines()) == 1
    assert len((out_dir / "val.jsonl").read_text(encoding="utf-8").splitlines()) == 1
