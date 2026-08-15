#!/usr/bin/env python3
"""Anonymize extracted local teaching documents without cloud services."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

DEFAULT_IN = Path(__file__).resolve().parent / "output" / "classified.jsonl"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "output"
SEED_NAMES = ("James", "Julia", "Ellen", "Jane", "Tomas", "Busse")
AUDIT_KEYS = (
    "PERSON",
    "PRICE",
    "EMAIL",
    "PHONE",
    "ADDRESS",
    "SIMMONDS_BRAND_KEPT",
    "SIMMONDS_PERSON_STRIPPED",
    "KUNDE",
)

EMAIL_RE = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?!\w)")
PHONE_RE = re.compile(r"(?<!\w)\+?\d[\d ()/-]{5,}\d(?!\w)")
GERMAN_ADDRESS_RE = re.compile(
    r"\b(?:[A-ZÄÖÜ][\wÄÖÜäöüß.'’-]*[ \t]+){0,3}"
    r"(?:[A-ZÄÖÜ][\wÄÖÜäöüß.'’-]*?(?:straße|str\.?|weg|allee)|"
    r"Straße|Str\.?|Weg|Allee)[ \t]+\d+[A-Za-z]?\b",
)
UK_ADDRESS_RE = re.compile(
    r"\b\d+\s+(?:[A-Z][\w'’-]*\s+){0,3}(?:Street|Road|Lane|Avenue)\b",
    re.IGNORECASE,
)
SALUTATION_RES = (
    re.compile(
        r"((?i:\bDear)[ \t]+)([A-ZÄÖÜ][\wÄÖÜäöüß'’-]+"
        r"(?:[ \t]+[A-ZÄÖÜ][\wÄÖÜäöüß'’-]+){0,2})"
    ),
    re.compile(
        r"((?i:\bHallo[ \t]+(?:Herr|Frau))[ \t]+)"
        r"([A-ZÄÖÜ][\wÄÖÜäöüß'’-]+(?:[ \t]+[A-ZÄÖÜ][\wÄÖÜäöüß'’-]+){0,2})"
    ),
    re.compile(
        r"((?i:\b(?:Liebe|Lieber))[ \t]+)"
        r"([A-ZÄÖÜ][\wÄÖÜäöüß'’-]+(?:[ \t]+[A-ZÄÖÜ][\wÄÖÜäöüß'’-]+){0,2})"
    ),
)
SIGNATURE_RE = re.compile(
    r"^[A-ZÄÖÜ][\wÄÖÜäöüß'’-]*(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß'’-]*){0,2}$"
)
CAPITALIZED_TOKEN_RE = re.compile(
    r"(?<![^\W\d_])([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’]*[A-Za-zÄÖÜäöüß])"
    r"(?![^\W\d_])"
)
RELATIVE_NAME_STOPWORDS = {
    "Abschlussbericht",
    "Agreement",
    "Allgemeine",
    "Angebot",
    "Attendance",
    "Beginner",
    "Bedingungen",
    "Business",
    "Cambridge",
    "Complete",
    "Contents",
    "Copy",
    "Course",
    "English",
    "Englisch",
    "Einstufung",
    "Einstufungstest",
    "Evaluation",
    "Evaluierung",
    "Evaluierungsbogen",
    "Exercise",
    "Final",
    "Form",
    "Formula",
    "Grammar",
    "Honorar",
    "Impressum",
    "Invoice",
    "Lesson",
    "Material",
    "Muster",
    "Notes",
    "Overview",
    "Placement",
    "Price",
    "Preisübersicht",
    "Proficiency",
    "Reading",
    "Report",
    "School",
    "Service",
    "Services",
    "Shared",
    "Short",
    "Simmonds",
    "Simplify",
    "Structure",
    "Teacher",
    "Teachers",
    "Template",
    "Templates",
    "Tense",
    "Test",
    "Tests",
    "Translations",
    "Worksheet",
}
# Corpus filenames contain many title-cased topics and administrative labels.  They
# are explicit non-person terms so the privacy-biased filename heuristic does not
# destroy common teaching language throughout the extracted text.
RELATIVE_NAME_STOPWORDS.update(
    line
    for line in """ActivePassive
Adjectives
Adverbs
AG
Air
AGB
Audatex
Be
Beginners
BEGU
BloodPharm
BusinessBuilder
CEFR
ChristmasCard
CSF
CustomTopics
DE
Designs
Do
Drucksachen
EL
Emphelungsschreiben
EN
EnglishEvaluation
Ex
FreelanceVertrag
GA
GasMixtures
German
GMBH
If
IJK
ILASS
ILS
JobCenter
JS
Ku
LBH
Leistungs
Lo
MacBook
MANAGEMENT
MCQ
Miet
MS
My
NewSource
Neu
OVCF
REGU
RockCity
RVG
RVT
RZ
Seminar
ServiceRep
Set
SLS
TECE
TechTalk
Texte
Untervermietung
Vocab
WinterSemester
WISTA
WK
Warm
Work
Abschluss
Abstract
Academic
Adjective
Adobe
Adverbs
Air's
Answer
Applying
April
Apr
Aspects
Aug
August
Autumn
Beauftragung
Berlin
Besta
Body
Bonn
Brits
Cheat
Choice
Clinic
Coastlab
Computacenter
Concept
Conditionals
Conditions
Correct
Database
Dativ
Degrees
Deutsch
Diagnostic
Dokument
Donnerstag
Draft
December
Dec
Dez
Dezember
Effect
Email
Emailing
Empfehlungsschreiben
Englisch-
Englischtraining
Englischunterricht
Erwachsene
Essay
Evaluierungsbo
Example
Expressing
Extended
Feb
February
Februar
Finished
Firmen
Flyer
Freiberuflicher
Futures
Game
Gemeinschaft
Germany
Gerund
Giving
Grammer
Group
Gruppe
Guest
Gutschein
Hannover
Have
Header
Helaba
Hyphen
I-neither
Infinitve
Info
Inversion
Irregular
It's
Jan
Januar
January
Jul
Juli
July
Jun
Juni
June
Komplett
Konflikt
Kopie
Kuendigung
Kundenschutz
Kundenunterschrift
Labor
Language
Lego
Leibniz
Leistungs-
Letterhead
List
Mahnung
Mai
Mail
Manuscript
Marketing
Mar
March
Master
May
Maze
Mär
März
Mrz
Miet-
Mieterho
Mietvertrag
Modals
Modellsatz
Multiple
Musterrahmenvertrag
Neuer
Neues
New
Noun
Nov
November
Offers
Oct
October
Okt
Oktober
Online
Order
Pakete
Pankow
Part
Participle
Passiv
Passive
Past
Phrasal
Position
Possessivartikel
Possessives
Postponing
Practice
Preisu
Prep
Present
Pricing
Profiles
Pronouns
Proofread
Qual
Question
Questions
Rahmenvertrag
Raw
Real
Scan
Schluessel
Script
Sep
Sept
September
Servicevertrags
Sheet
Should
Simple
Simplifyit
Skills
Sleep
Sprachdienste
Sprachschule
State
Student
Tables
Talk
Targeted
Tech
Technisches
Teilnahmebescheinigung
Teilnehmer
Telephoning
Terminbesta
Testimonial
Text
Texts
The
Three
Training
Types
Unit
Units
Unterschrift
Ustd
Verb
Verben
Verbs
Verkehr
Verneinung
Vertrag
Vier
Vokalwechsel
Vorschlag
Warm-up
Water
Way
What
Wiederhergestelltes
Wine
Word
Words
Work-through
Working
Workshop
Workshop-
Writing
Your""".splitlines()
    if line
)
BRAND_TOKEN = "__BRAND_KEEP__"
SIMMONDS_RE = re.compile(
    r"(?<![^\W\d_])Simmonds(?![^\W\d_])", re.IGNORECASE
)
BRAND_PREFIX_RE = re.compile(
    r"(?:\b(?:Sprachschule|Firma|Language|Business|at|website)\s+)$",
    re.IGNORECASE,
)
BRAND_SUFFIX_RE = re.compile(
    r"^(?:\s+(?:Language\s+Services|Sprachdienste|English\s+School|"
    r"Ltd\.?|GmbH|team|website|englisch-lehrer|Sprachschule)\b|-Business-)",
    re.IGNORECASE,
)
BRAND_URL_PREFIX_RE = re.compile(
    r"(?:g\.page|google\.com)/[^\s]*$", re.IGNORECASE
)
CLIENT_COMPANY_RE = re.compile(
    r"(?<![\wÄÖÜäöüß])"
    r"[A-ZÄÖÜ][\wÄÖÜäöüß.'’/-]*"
    r"(?:[ \t]+(?:&[ \t]+)?[A-ZÄÖÜ][\wÄÖÜäöüß.'’/-]*)+"
    r"[ \t]+(?:GmbH|AG|KG|GbR|mbH|e\.V\.)"
    r"(?![\wÄÖÜäöüß])"
)


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


def collect_relpath_names(records: Iterable[dict]) -> set[str]:
    """Collect conservative person-shaped name candidates from source filenames."""

    names: set[str] = set()
    stopwords = {word.casefold() for word in RELATIVE_NAME_STOPWORDS}
    folder_words = {
        "james",
        "shared",
        "material",
        "einstufung",
        "evaluation",
        "services",
        "templates",
        "agb",
    }
    for record in records:
        relpath = Path(
            str(record.get("sourceRelpath", record.get("relpath", "")))
        )
        for part in relpath.parts:
            component = Path(part).stem
            for match in CAPITALIZED_TOKEN_RE.finditer(component):
                token = match.group(1)
                if (
                    token.casefold() not in stopwords
                    and token.casefold() not in folder_words
                ):
                    names.add(token)
    return names


def _replace_counted(
    pattern: re.Pattern[str], text: str, replacement: str, audit: Counter[str], key: str
) -> str:
    text, count = pattern.subn(replacement, text)
    audit[key] += count
    return text


def _has_personal_simmonds_prefix(before: str, names: Iterable[str]) -> bool:
    personal_tokens = {
        "James",
        "Herr",
        "Frau",
        "Mr",
        "Mrs",
        "Ms",
        *(name for name in names if name and name.casefold() != "simmonds"),
    }
    alternatives = "|".join(
        re.escape(name)
        for name in sorted(personal_tokens, key=lambda name: (-len(name), name.casefold()))
    )
    return bool(
        re.search(
            r"(?<![^\W\d_])(?:"
            + alternatives
            + r")(?:\.)?(?:\s+[A-ZÄÖÜ]\.)?\s+$",
            before,
            re.IGNORECASE,
        )
    )


def _protect_brand_contexts(
    text: str, names: Iterable[str], audit: Counter[str]
) -> str:
    """Protect company uses of Simmonds while leaving personal uses exposed."""

    def replacement(match: re.Match[str]) -> str:
        before = text[: match.start()]
        after = text[match.end() :]
        if _has_personal_simmonds_prefix(before, names):
            return match.group(0)
        url_slug = before.endswith("/") and after.startswith("-")
        brand_context = (
            bool(BRAND_PREFIX_RE.search(before))
            or bool(BRAND_SUFFIX_RE.match(after))
            or bool(BRAND_URL_PREFIX_RE.search(before))
            or url_slug
        )
        if not brand_context:
            return match.group(0)
        audit["SIMMONDS_BRAND_KEPT"] += 1
        return BRAND_TOKEN

    return SIMMONDS_RE.sub(replacement, text)


def _replace_phones(text: str, audit: Counter[str]) -> str:
    def replacement(match: re.Match[str]) -> str:
        if sum(character.isdigit() for character in match.group(0)) < 7:
            return match.group(0)
        audit["PHONE"] += 1
        return "[PHONE]"

    return PHONE_RE.sub(replacement, text)


def _replace_salutations(text: str, audit: Counter[str]) -> str:
    for pattern in SALUTATION_RES:
        def replacement(match: re.Match[str]) -> str:
            audit["SIMMONDS_PERSON_STRIPPED"] += len(
                SIMMONDS_RE.findall(match.group(2))
            )
            return match.group(1) + "[PERSON]"

        text, count = pattern.subn(replacement, text)
        audit["PERSON"] += count
    return text


def _replace_signature_lines(text: str, audit: Counter[str]) -> str:
    lines = text.splitlines(keepends=True)
    nonempty_indexes = [index for index, line in enumerate(lines) if line.strip()]
    for index in nonempty_indexes[-5:]:
        raw = lines[index]
        content = raw.rstrip("\r\n")
        ending = raw[len(content) :]
        if SIGNATURE_RE.fullmatch(content.strip()):
            audit["SIMMONDS_PERSON_STRIPPED"] += len(
                SIMMONDS_RE.findall(content)
            )
            lines[index] = "[PERSON]" + ending
            audit["PERSON"] += 1
    return "".join(lines)


# Canonical pricing rule (PRICING-CANONICAL.md): only documents under the marker
# folder keep real euro amounts; other offer-bucket documents get prices masked
# so outdated prices can never resurface in generated offers.
CANONICAL_PRICING_MARKER = "Pricing document 26"
PRICE_EURO_WORD_RE = re.compile(r"\d[\d.,]*\s*(?:Euro|EUR)\b")
PRICE_SYMBOL_RE = re.compile(r"(?:\d[\d.,]*\s*(?:\.?-)?\s*€|€\s*\d[\d.,]*)")


def anonymize_value(
    text: str,
    names: Iterable[str],
    audit: Counter[str],
    *,
    detect_signature: bool = True,
    redact_client_companies: bool = False,
    mask_prices: bool = False,
    protect_brand_contexts: bool = True,
) -> str:
    """Return anonymized text and update aggregate replacement counters."""

    if protect_brand_contexts:
        text = _protect_brand_contexts(text, names, audit)
    if redact_client_companies:
        text = _replace_counted(CLIENT_COMPANY_RE, text, "[KUNDE]", audit, "KUNDE")
    if mask_prices:
        text = _replace_counted(PRICE_EURO_WORD_RE, text, "[XX] Euro", audit, "PRICE")
        text = _replace_counted(PRICE_SYMBOL_RE, text, "[XX] €", audit, "PRICE")
    text = _replace_counted(EMAIL_RE, text, "[EMAIL]", audit, "EMAIL")
    text = _replace_counted(GERMAN_ADDRESS_RE, text, "[ADDRESS]", audit, "ADDRESS")
    text = _replace_counted(UK_ADDRESS_RE, text, "[ADDRESS]", audit, "ADDRESS")
    text = _replace_phones(text, audit)
    text = _replace_salutations(text, audit)
    if detect_signature:
        text = _replace_signature_lines(text, audit)

    all_names = sorted(
        {name for name in names if name and name.casefold() != "simmonds"},
        key=lambda name: (-len(name), name.casefold()),
    )
    if all_names:
        names_pattern = re.compile(
            r"(?<![^\W\d_])(?:"
            + "|".join(re.escape(name) for name in all_names)
            + r")(?![^\W\d_])",
            re.IGNORECASE,
        )
        text = _replace_counted(names_pattern, text, "[PERSON]", audit, "PERSON")

    text, simmonds_count = SIMMONDS_RE.subn("[PERSON]", text)
    audit["PERSON"] += simmonds_count
    audit["SIMMONDS_PERSON_STRIPPED"] += simmonds_count
    return text.replace(BRAND_TOKEN, "Simmonds")


def anonymize_records(records: Iterable[dict]) -> tuple[list[dict], dict[str, int]]:
    """Anonymize record text and relpaths with one corpus-wide name seed set."""

    source_records = list(records)
    names = set(SEED_NAMES) | collect_relpath_names(source_records)
    audit: Counter[str] = Counter({key: 0 for key in AUDIT_KEYS})
    anonymized: list[dict] = []
    for record in source_records:
        result = dict(record)
        if not record.get("bucket"):
            raise ValueError(
                "Each record must contain a persisted bucket before anonymization"
            )
        bucket = str(record["bucket"])
        source_relpath = str(record.get("sourceRelpath", ""))
        is_canonical_pricing = (
            CANONICAL_PRICING_MARKER.casefold() in source_relpath.casefold()
        )
        result["text"] = anonymize_value(
            str(record.get("text", "")),
            names,
            audit,
            redact_client_companies=bucket == "offer",
            mask_prices=bucket == "offer" and not is_canonical_pricing,
        )
        result["relpath"] = anonymize_value(
            str(record.get("relpath", "")),
            names,
            audit,
            detect_signature=False,
        )
        result["folder"] = anonymize_value(
            str(record.get("folder", "")),
            names,
            audit,
            detect_signature=False,
        )
        anonymized.append(result)
    return anonymized, {key: audit[key] for key in AUDIT_KEYS}


def write_anonymized(in_path: Path, out_dir: Path) -> dict[str, int]:
    records = read_jsonl(in_path)
    anonymized, audit = anonymize_records(records)
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "anonymized.jsonl").open("w", encoding="utf-8") as output:
        for record in anonymized:
            output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    (out_dir / "anonymize_audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(audit, ensure_ascii=False, indent=2, sort_keys=True))
    return audit


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="in_path", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    write_anonymized(args.in_path, args.out_dir)


if __name__ == "__main__":
    main()
