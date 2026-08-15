import pytest

from training.ingest.anonymize import anonymize_records, collect_relpath_names
from training.ingest.classify import BUCKETS


def _record(
    text: str,
    relpath: str = "Material/fixture.docx",
    bucket: str | None = "lesson_material",
    source_relpath: str | None = None,
) -> dict:
    record = {
        "relpath": relpath,
        "sourceRelpath": source_relpath or relpath,
        "folder": "Material",
        "modifiedAt": "2026-01-01T00:00:00+00:00",
        "chars": len(text),
        "truncated": False,
        "text": text,
    }
    if bucket is not None:
        record["bucket"] = bucket
    return record


def test_seed_names_salutations_signatures_and_personal_simmonds_are_replaced():
    text = """James spoke with Julia, Ellen, Jane, Tomas, and Busse.
Dear James,
Hallo Herr Busse
Hallo Frau Julia
Liebe Ellen
Lieber Tomas
Please reply soon.
Kind regards,
James Simmonds
"""

    rows, audit = anonymize_records([_record(text)])
    anonymized = rows[0]["text"]

    for name in ("James", "Julia", "Ellen", "Jane", "Tomas", "Busse"):
        assert name.casefold() not in anonymized.casefold()
    assert "Dear [PERSON]" in anonymized
    assert "Hallo Herr [PERSON]" in anonymized
    assert "Hallo Frau [PERSON]" in anonymized
    assert "Liebe [PERSON]" in anonymized
    assert "Lieber [PERSON]" in anonymized
    assert anonymized.rstrip().endswith("[PERSON]")
    assert audit["PERSON"] >= 11


def test_explicit_brand_simmonds_is_kept_but_personal_surname_is_removed():
    text = """Simmonds English School supports the Simmonds team.
Simmonds Language Services works with Simmonds Sprachdienste GmbH.
Sprachschule Simmonds and Firma Simmonds Sprachdienste are company references.
Visit g.page/Simmonds-Business-English or google.com/maps/Simmonds-Berlin.
Herr Simmonds called James Simmonds Language Services.
Julia A. Simmonds English School signed the letter.
James I. Simmonds Language Services is a personal-name-attached use.
"""

    rows, audit = anonymize_records([_record(text)])
    anonymized = rows[0]["text"]

    assert "Simmonds English School" in anonymized
    assert "Simmonds team" in anonymized
    assert "Simmonds Language Services" in anonymized
    assert "Simmonds Sprachdienste GmbH" in anonymized
    assert "Sprachschule Simmonds" in anonymized
    assert "Firma Simmonds Sprachdienste" in anonymized
    assert "g.page/Simmonds-Business-English" in anonymized
    assert "google.com/maps/Simmonds-Berlin" in anonymized
    assert "Herr [PERSON]" in anonymized
    assert "[PERSON] [PERSON] Language Services" in anonymized
    assert "[PERSON] A. [PERSON] English School" in anonymized
    assert "[PERSON] I. [PERSON] Language Services" in anonymized
    assert audit["SIMMONDS_BRAND_KEPT"] == 8
    assert audit["SIMMONDS_PERSON_STRIPPED"] == 4


def test_email_phone_and_german_street_address_are_replaced():
    text = (
        "Email info@simmonds.online or call +49 (30) 1234-5678. "
        "Our office is Musterstraße 12."
    )

    rows, audit = anonymize_records([_record(text)])
    anonymized = rows[0]["text"]

    assert "[EMAIL]" in anonymized
    assert "[PHONE]" in anonymized
    assert "[ADDRESS]" in anonymized
    assert "simmonds.online" not in anonymized
    assert audit["EMAIL"] == 1
    assert audit["PHONE"] == 1
    assert audit["ADDRESS"] == 1


def test_person_shaped_name_from_relpath_becomes_a_run_seed():
    rows, audit = anonymize_records(
        [_record("Please contact Friedrich tomorrow.", "Material/Friedrich_Notes.docx")]
    )

    assert "Friedrich" not in rows[0]["text"]
    assert "[PERSON]" in rows[0]["text"]
    assert audit["PERSON"] == 2


def test_seed_names_are_removed_from_folder_metadata_and_ocr_digit_boundaries():
    record = _record("Where is Jane7?", "James' shared material/quiz.docx")
    record["folder"] = "James' shared material"

    rows, audit = anonymize_records([record])

    assert "James" not in rows[0]["folder"]
    assert rows[0]["folder"] == "[PERSON]' shared material"
    assert "Jane" not in rows[0]["text"]
    assert "[PERSON]7" in rows[0]["text"]
    assert audit["PERSON"] == 3


def test_common_capitalized_filename_topic_words_are_not_treated_as_people():
    text = "The present verb belongs in an English grammar lesson."

    rows, audit = anonymize_records(
        [_record(text, "Material/The_Present_Verb_Lesson.docx")]
    )

    assert rows[0]["text"] == text
    assert audit["PERSON"] == 0


def test_names_from_nested_relpath_all_caps_and_short_tokens_become_run_seeds():
    text = "Alice met SMITH and Li."

    rows, audit = anonymize_records(
        [_record(text, "Material/Alice/SMITH_Li_notes.docx")]
    )

    for name in ("Alice", "SMITH", "Li"):
        assert name.casefold() not in rows[0]["text"].casefold()
        assert name.casefold() not in rows[0]["relpath"].casefold()
    assert audit["PERSON"] == 6


def test_multi_token_salutation_replaces_the_complete_name():
    rows, audit = anonymize_records(
        [_record("Dear Anna Schmidt,\nPlease review this note.")]
    )

    assert rows[0]["text"].startswith("Dear [PERSON],")
    assert "Anna" not in rows[0]["text"]
    assert "Schmidt" not in rows[0]["text"]
    assert audit["PERSON"] == 1


def test_spaced_german_street_address_is_replaced_in_full():
    rows, audit = anonymize_records(
        [_record("Die Adresse ist Neue Straße 12 in Berlin.")]
    )

    assert "Neue Straße 12" not in rows[0]["text"]
    assert "[ADDRESS]" in rows[0]["text"]
    assert audit["ADDRESS"] == 1


def test_month_filename_token_does_not_destroy_month_or_modal_uses():
    text = "The course starts in May 2018; you may contact us."
    records = [_record(text, "Material/Report_May_2018.pdf")]

    assert "May" not in collect_relpath_names(records)
    rows, audit = anonymize_records(records)

    assert rows[0]["text"] == text
    assert "Report_May_2018.pdf" in rows[0]["relpath"]
    assert audit["PERSON"] == 0


@pytest.mark.parametrize(
    ("company", "suffix"),
    [
        ("Acme Solutions", "GmbH"),
        ("Müller & Partner", "AG"),
        ("Acme Solutions", "KG"),
        ("Acme Solutions", "GbR"),
        ("Acme Solutions", "mbH"),
        ("Acme Solutions", "e.V."),
    ],
)
def test_offer_bucket_replaces_client_company_names_for_every_supported_suffix(
    company, suffix
):
    text = f"Wir erstellen das Kurskonzept für {company} {suffix} ab September."

    rows, audit = anonymize_records([_record(text, bucket="offer")])

    assert f"{company} {suffix}" not in rows[0]["text"]
    assert "[KUNDE]" in rows[0]["text"]
    assert audit["KUNDE"] == 1


def test_offer_bucket_preserves_simmonds_company_entity():
    text = "Das Angebot wird von Simmonds Sprachschule GmbH erstellt."

    rows, audit = anonymize_records([_record(text, bucket="offer")])

    assert "Simmonds Sprachschule GmbH" in rows[0]["text"]
    assert "[KUNDE]" not in rows[0]["text"]
    assert audit["KUNDE"] == 0


def test_company_name_like_text_is_byte_for_byte_unchanged_outside_offer_bucket():
    text = "Wir arbeiten seit Jahren mit Acme Solutions GmbH zusammen."

    rows, audit = anonymize_records([_record(text, bucket="lesson_material")])

    assert rows[0]["text"] == text
    assert audit["KUNDE"] == 0


def test_offer_prices_masked_except_canonical():
    canonical = _record(
        "72 €/Zeitstunde. Gesamt 1.440 Euro. Paket: 68,50€. Alt: 99.-€.",
        relpath="[PERSON]/Preisübersicht_26.pdf",
        source_relpath="pricing DOCUMENT 26/Preisübersicht_26.pdf",
        bucket="offer",
    )
    noncanonical = _record(
        "72 €/Zeitstunde. Gesamt 1.440 Euro. Paket: 68,50€. Alt: 99.-€.",
        relpath="Templates+AGB/Pricing document_2025/preise.pdf",
        source_relpath="Templates+AGB/Pricing document_2025/preise.pdf",
        bucket="offer",
    )

    out, audit = anonymize_records([canonical, noncanonical])

    for price in ("72", "1.440", "68,50", "99"):
        assert price in out[0]["text"]
        assert price not in out[1]["text"]
    assert "[XX] Euro" in out[1]["text"]
    assert out[1]["text"].count("[XX] €") == 3
    assert audit["PRICE"] == 4


def test_source_relpath_survives_unchanged_while_display_relpath_is_anonymized():
    source_relpath = "Material/James_Notes.txt"

    rows, _ = anonymize_records(
        [_record("General content.", relpath=source_relpath)]
    )

    assert rows[0]["sourceRelpath"] == source_relpath
    assert rows[0]["relpath"] == "Material/[PERSON]_Notes.txt"


@pytest.mark.parametrize("bucket", BUCKETS)
def test_anonymize_preserves_every_persisted_bucket(bucket):
    rows, _ = anonymize_records([_record("General content.", bucket=bucket)])

    assert rows[0]["bucket"] == bucket


def test_anonymize_rejects_records_without_a_persisted_bucket():
    record = _record("General content.", bucket=None)

    with pytest.raises(ValueError, match="bucket"):
        anonymize_records([record])
