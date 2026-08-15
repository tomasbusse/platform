import json

import pytest

from training.ingest.to_training import SYSTEM, build_training_outputs


def _record(name: str, bucket: str, text: str, chars: int | None = None) -> dict:
    return {
        "relpath": f"Material/{name}.docx",
        "folder": "Material",
        "modifiedAt": "2026-01-01T00:00:00+00:00",
        "chars": chars if chars is not None else len(text),
        "truncated": False,
        "text": text,
        "bucket": bucket,
    }


def _assert_valid_body(block: dict) -> None:
    body = block["body"]
    block_type = block["blockType"]
    if block_type == "exerciseAtom":
        assert isinstance(body.get("exerciseType"), str) and body["exerciseType"]
        assert isinstance(body.get("prompt"), str) and body["prompt"]
        answer_key = body.get("answerKey")
        assert (isinstance(answer_key, str) and answer_key) or isinstance(
            answer_key, (int, float)
        )
    elif block_type == "readingPassage":
        assert isinstance(body.get("text"), str) and body["text"]
        assert isinstance(body.get("questions"), list) and body["questions"]
    elif block_type == "grammarExplainer":
        assert isinstance(body.get("explanation"), str) and body["explanation"]
        assert isinstance(body.get("examples"), list) and body["examples"]
    elif block_type == "culturalNote":
        assert isinstance(body.get("note"), str) and body["note"]
    elif block_type == "offerLetter":
        assert isinstance(body.get("betreff"), str) and body["betreff"]
        assert isinstance(body.get("anschreiben"), str) and body["anschreiben"]
    elif block_type == "offerSection":
        assert isinstance(body.get("heading"), str) and body["heading"]
        assert isinstance(body.get("text"), str) and body["text"]
    else:
        raise AssertionError(f"unexpected block type: {block_type}")


def test_generated_content_blocks_match_convex_required_shapes(tmp_path):
    prose = (
        "This is a connected reading passage about sustainable travel. "
        "It contains complete sentences and enough detail for a learner to identify "
        "the main topic and supporting ideas. " * 3
    )
    rows = [
        _record("A2 gap quiz", "lesson_material", "Choose the correct answer. 1. ___\n" * 12),
        _record("B2 grammar", "lesson_material", "Grammar tense explanation. Example: I work.\n" * 8),
        _record("reading article", "lesson_material", prose),
        _record("evaluation rubric", "evaluation_rubric", "Evaluation criterion and note.\n" * 12),
    ]

    stats = build_training_outputs(rows, tmp_path)
    blocks = [json.loads(line) for line in (tmp_path / "content_blocks.jsonl").read_text().splitlines()]

    assert {block["blockType"] for block in blocks} == {
        "exerciseAtom",
        "grammarExplainer",
        "readingPassage",
        "culturalNote",
    }
    assert len(blocks) == 4
    assert stats["contentBlocks"]["total"] == 4
    for block in blocks:
        _assert_valid_body(block)
        assert block["companyId"] is None
        assert block["contentHash"] and len(block["contentHash"]) == 64
        assert block["title"] == block["topic"]
    exercise = next(block for block in blocks if block["blockType"] == "exerciseAtom")
    assert exercise["body"]["answerKey"] == "see full text"
    assert exercise["body"]["referenceText"]
    assert exercise["level"] == "A2"
    grammar = next(block for block in blocks if block["blockType"] == "grammarExplainer")
    assert grammar["level"] == "B2"


def test_sft_pairs_have_exact_roles_and_nonempty_content_for_all_non_other_buckets(tmp_path):
    rows = [
        _record("lesson", "lesson_material", "A useful worksheet sentence. " * 10),
        _record("services", "service_description", "A detailed service description. " * 10),
        _record("template", "template_brand", "A reusable company template. " * 10),
        _record("ignored", "other", "This must not become an SFT pair. " * 10),
    ]

    stats = build_training_outputs(rows, tmp_path)
    pairs = [json.loads(line) for line in (tmp_path / "sft_pairs.jsonl").read_text().splitlines()]

    assert len(pairs) == 3
    assert stats["sftPairs"] == 3
    for pair in pairs:
        assert [message["role"] for message in pair["messages"]] == [
            "system",
            "user",
            "assistant",
        ]
        assert pair["messages"][0]["content"] == SYSTEM
        assert all(message["content"].strip() for message in pair["messages"])


@pytest.mark.parametrize("length", [200, 4000])
def test_offer_document_from_200_through_4000_chars_becomes_one_letter(
    tmp_path, length
):
    text = "A" * length

    stats = build_training_outputs([_record("Angebot Vertrieb", "offer", text)], tmp_path)
    blocks = [json.loads(line) for line in (tmp_path / "content_blocks.jsonl").read_text().splitlines()]

    assert stats["contentBlocks"]["total"] == 1
    assert len(blocks) == 1
    block = blocks[0]
    assert block["blockType"] == "offerLetter"
    assert block["body"] == {
        "betreff": "Angebot Vertrieb",
        "anschreiben": text,
    }
    _assert_offer_metadata(block)


def test_offer_document_under_200_chars_is_skipped_as_too_short(tmp_path):
    text = "A" * 199

    stats = build_training_outputs([_record("Kurzes Angebot", "offer", text)], tmp_path)

    assert stats["contentBlocks"]["total"] == 0
    assert stats["skipped"]["contentBlocks"]["tooShort"] == 1
    assert (tmp_path / "content_blocks.jsonl").read_text(encoding="utf-8") == ""


def test_long_offer_subsplits_long_content_under_detected_headings(tmp_path):
    intro = (
        "Gern entwickeln wir ein maßgeschneidertes Kurskonzept für Ihr internationales Team. "
        * 18
    ).strip()
    services = "Wöchentliche Live-Einheiten und digitale Lernbegleitung. " * 28
    prices = "Die Preise richten sich nach Gruppengröße und Laufzeit. " * 28
    text = (
        f"{intro}\n\n"
        f"Leistungsumfang\n{services}\n\n"
        f"Preise und Konditionen\n{prices}"
    )
    assert len(text) >= 4000
    assert 1000 < len(intro) < 1800

    stats = build_training_outputs([_record("Kursangebot", "offer", text)], tmp_path)
    blocks = [json.loads(line) for line in (tmp_path / "content_blocks.jsonl").read_text().splitlines()]

    sections = blocks[1:]
    assert stats["contentBlocks"]["total"] == len(blocks)
    assert blocks[0]["blockType"] == "offerLetter"
    assert len(sections) >= 4
    assert all(block["blockType"] == "offerSection" for block in sections)
    assert blocks[0]["body"]["anschreiben"] == intro
    assert not blocks[0]["body"]["anschreiben"].endswith(" ")
    headings = [block["body"]["heading"] for block in sections]
    assert headings.count("Leistungsumfang") >= 2
    assert headings.count("Preise und Konditionen") >= 2
    assert all(len(block["body"]["text"]) <= 1500 for block in sections)
    for block in blocks:
        _assert_valid_body(block)
        _assert_offer_metadata(block)


def test_long_offer_without_headings_produces_multiple_numbered_sections(tmp_path):
    intro = ("Dies ist die Einleitung des individuellen Kursangebots. " * 24).strip()
    paragraphs = [
        (f"In Absatz {index} beschreiben wir Leistungen, Ablauf und Lernziele. " * 8).strip()
        for index in range(1, 9)
    ]
    text = intro + "\n\n" + "\n\n".join(paragraphs)
    assert len(text) > 4000

    stats = build_training_outputs([_record("Kursangebot", "offer", text)], tmp_path)
    blocks = [
        json.loads(line)
        for line in (tmp_path / "content_blocks.jsonl").read_text().splitlines()
    ]
    sections = blocks[1:]

    assert stats["contentBlocks"]["total"] == len(blocks)
    assert len(sections) > 1
    assert [block["body"]["heading"] for block in sections] == [
        f"Abschnitt {index}" for index in range(1, len(sections) + 1)
    ]
    assert all(len(block["body"]["text"]) <= 1500 for block in sections)


def _assert_offer_metadata(block: dict) -> None:
    assert block["level"] == "B1"
    assert block["source"] == "human"
    assert block["rightsStatus"] == "proprietary"
    assert block["attribution"] == "Simmonds Angebotsarchiv"
