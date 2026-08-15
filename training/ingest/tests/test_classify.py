import json

import pytest

from training.ingest.classify import classify_record, classify_records


def _record(folder: str, relpath: str, text: str = "General content") -> dict:
    return {
        "relpath": relpath,
        "sourceRelpath": relpath,
        "folder": folder,
        "modifiedAt": "2026-01-01T00:00:00+00:00",
        "chars": len(text),
        "truncated": False,
        "text": text,
    }


@pytest.mark.parametrize(
    ("record", "expected"),
    [
        (_record("Einstufung", "Einstufung/basic.docx"), "placement_test"),
        (_record("Evaluation", "Evaluation/form.pdf"), "evaluation_rubric"),
        (_record("Services", "Services/overview.docx"), "service_description"),
        (_record("Templates+AGB", "Templates+AGB/contract.doc"), "template_brand"),
        (_record("Material", "Material/lesson.pdf"), "lesson_material"),
        (
            _record("James' shared material", "James' shared material/topic.pdf"),
            "lesson_material",
        ),
        (_record("Misc", "Misc/notes.txt"), "other"),
    ],
)
def test_folder_defaults(record, expected):
    assert classify_record(record) == expected


@pytest.mark.parametrize(
    ("record", "expected"),
    [
        (_record("Material", "Material/placement quiz.pdf"), "placement_test"),
        (_record("Services", "Services/AGB final.docx"), "template_brand"),
        (_record("Material", "Material/topic.pdf", "Bewertung rubric"), "evaluation_rubric"),
        (_record("Material", "Material/Preise 2026.pdf"), "service_description"),
        (_record("Misc", "Misc/template letter.docx"), "template_brand"),
    ],
)
def test_strong_keywords_override_folder_defaults(record, expected):
    assert classify_record(record) == expected


@pytest.mark.parametrize(
    "record",
    [
        _record("Misc", "archive/ANgEbOtE/client.docx"),
        _record("Angebote", "client.docx"),
        _record("Misc", "Misc/Angebot Kurskonzept.docx"),
        _record("Misc", "Misc/client.docx", "Unser Angebot enthält Preise für alle Module."),
    ],
)
def test_offer_classification_matches_folder_or_strong_keyword_pair(record):
    assert classify_record(record) == "offer"


def test_offer_classification_does_not_match_angebot_without_required_context():
    record = _record("Misc", "Misc/Angebot Entwurf.docx", "Allgemeine Leistungen")

    assert classify_record(record) == "service_description"


def test_more_specific_existing_rules_take_precedence_over_offer_folder():
    record = _record("Angebote", "Angebote/AGB Angebot Preise.docx")

    assert classify_record(record) == "template_brand"


@pytest.mark.parametrize(
    "source_relpath",
    [
        "Pricing document 26/price-list.pdf",
        "Archiv/PRICING DOCUMENT 26/price-list.pdf",
        "Material/Preisübersicht_2026.pdf",
        "Material/PREISÜBERSICHT_2026.pdf",
    ],
)
def test_canonical_pricing_paths_are_offer_bucket(source_relpath):
    record = _record("Misc", "[PERSON]_price-list.pdf")
    record["sourceRelpath"] = source_relpath

    assert classify_record(record) == "offer"


def test_original_source_relpath_drives_classification_after_display_path_redaction():
    record = _record(
        "Material",
        "Material/[PERSON] Language Services_Preisübersicht.pdf",
    )
    record["sourceRelpath"] = (
        "Material/Simmonds Language Services_Preisübersicht.pdf"
    )

    assert classify_record(record) == "offer"


def test_stronger_rule_precedes_canonical_pricing_rule():
    record = _record("Templates+AGB", "Templates+AGB/AGB.pdf")
    record["sourceRelpath"] = "Pricing document 26/AGB.pdf"

    assert classify_record(record) == "template_brand"


def test_classify_records_writes_combined_classified_jsonl_with_bucket(tmp_path):
    records = [
        _record("Material", "Material/lesson.pdf"),
        _record("Angebote", "Angebote/client.pdf"),
    ]

    classify_records(records, tmp_path)

    rows = [
        json.loads(line)
        for line in (tmp_path / "classified.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert [row["bucket"] for row in rows] == ["lesson_material", "offer"]
