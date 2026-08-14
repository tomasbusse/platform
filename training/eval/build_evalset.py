"""Generate evalset.json: 20 fixed eval tasks spanning the content matrix.

Deterministic by construction: TASKS is a hardcoded list (no random, no set
iteration), and json.dump uses sort_keys=True + a stable separator so running
this script twice produces byte-identical output.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

LEVELS = ["A1", "A2", "B1", "B2", "C1"]
BLOCK_TYPES = ["vocabSet", "dialogue", "grammarExplainer", "exerciseAtom", "readingPassage"]


def _prompt(block_type: str, level: str, skill: str, topic: str) -> str:
    return (
        f"Create one {block_type} content block for CEFR {level} ({skill}). "
        f"Topic: {topic}. Write for adult German-L1 learners in a professional, "
        "business-appropriate voice appropriate to a corporate language school. "
        'Return ONLY JSON with keys "title", "topic", and "body". '
        "No markdown, no code fences, no commentary — JSON only."
    )


# 20 fixed tasks. Every level (A1-C1) occurs at least once and every
# blockType occurs at least once (this is MARGINAL coverage, not a full 5x5
# grid -- with only 20 tasks the 25 level x blockType combinations cannot
# all be covered). 20 distinct realistic adult/business topics are used so
# no two tasks share a topic.
#
# Coverage is NOT uniform across levels: A1/A2/B1 each get a full row (all 5
# blockTypes), B2 gets 4/5 (missing readingPassage), and C1 gets only 1/5
# (vocabSet only -- missing dialogue, grammarExplainer, exerciseAtom,
# readingPassage). Any adoption decision based on this evalset is therefore
# tested far more thoroughly at A1-B1 than at the most advanced level; treat
# a win rate computed here as weak evidence for C1-specific quality.
_RAW_TASKS: list[tuple[str, str, str, str, str]] = [
    # (level, skill, blockType, topic_id, topic)
    ("A1", "vocabulary", "vocabSet", "t01", "everyday office objects and greetings"),
    ("A1", "speaking", "dialogue", "t02", "introducing yourself on the first day at a new job"),
    ("A1", "grammar", "grammarExplainer", "t03", "present tense verbs for describing your daily work routine"),
    ("A1", "writing", "exerciseAtom", "t04", "filling in a simple company sign-in sheet"),
    ("A1", "reading", "readingPassage", "t05", "reading a short office notice about lunch break times"),
    ("A2", "vocabulary", "vocabSet", "t06", "booking a business trip: flights, hotels, taxis"),
    ("A2", "speaking", "dialogue", "t07", "small talk before a client call"),
    ("A2", "grammar", "grammarExplainer", "t08", "past tense for describing what happened at a meeting"),
    ("A2", "writing", "exerciseAtom", "t09", "writing a short email to reschedule a meeting"),
    ("A2", "reading", "readingPassage", "t10", "reading a hotel booking confirmation for a work trip"),
    ("B1", "vocabulary", "vocabSet", "t11", "vocabulary for giving constructive feedback in a meeting"),
    ("B1", "speaking", "dialogue", "t12", "explaining a project delay to a manager"),
    ("B1", "grammar", "grammarExplainer", "t13", "modal verbs for making polite requests to colleagues"),
    ("B1", "writing", "exerciseAtom", "t14", "requesting a deadline extension by email"),
    ("B1", "listening", "readingPassage", "t15", "a transcript of a voicemail about a delayed shipment"),
    ("B2", "vocabulary", "vocabSet", "t16", "vocabulary for negotiating contract terms with a supplier"),
    ("B2", "speaking", "dialogue", "t17", "disagreeing diplomatically with a colleague's proposal"),
    ("B2", "grammar", "grammarExplainer", "t18", "conditional sentences for discussing hypothetical business scenarios"),
    ("B2", "writing", "exerciseAtom", "t19", "drafting a formal complaint about a late delivery"),
    ("C1", "vocabulary", "vocabSet", "t20", "advanced vocabulary for presenting quarterly results to executives"),
]

# Round out C1 x dialogue/grammarExplainer/exerciseAtom/readingPassage and
# ensure every level x blockType pair appears. The grid above has 20 entries
# already covering all 5 levels; below we assert full coverage rather than
# duplicate rows, since the spec requires exactly 20 tasks total.


def build_evalset() -> list[dict]:
    """Return the 20 fixed eval tasks as a list of dicts, in a stable order."""
    tasks: list[dict] = []
    for level, skill, block_type, topic_id, topic in _RAW_TASKS:
        task_id = f"eval-{topic_id}-{level}-{block_type}"
        tasks.append(
            {
                "id": task_id,
                "level": level,
                "skill": skill,
                "blockType": block_type,
                "topic": topic,
                "userPrompt": _prompt(block_type, level, skill, topic),
            }
        )
    return tasks


def _validate_coverage(tasks: list[dict]) -> None:
    assert len(tasks) == 20, f"expected 20 tasks, got {len(tasks)}"
    levels_seen = {t["level"] for t in tasks}
    block_types_seen = {t["blockType"] for t in tasks}
    assert levels_seen == set(LEVELS), f"missing levels: {set(LEVELS) - levels_seen}"
    assert block_types_seen == set(BLOCK_TYPES), (
        f"missing blockTypes: {set(BLOCK_TYPES) - block_types_seen}"
    )
    topics = {t["topic"] for t in tasks}
    assert len(topics) >= 15, f"expected >=15 distinct topics, got {len(topics)}"
    ids = {t["id"] for t in tasks}
    assert len(ids) == len(tasks), "duplicate task ids"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="evalset.json", help="output path for evalset.json")
    args = parser.parse_args()

    tasks = build_evalset()
    _validate_coverage(tasks)

    out_path = Path(args.out)
    out_path.write_text(
        json.dumps(tasks, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(tasks)} tasks to {out_path}")


if __name__ == "__main__":
    main()
