"""Blind pairwise judge: compare two candidates' run_candidates.py outputs,
task by task, via a third judge endpoint, and render the ADOPT / KEEP
BASELINE decision.

Decision rule (per project spec):
    ADOPT the fine-tune only if:
      - it wins >= 60% of NON-TIE comparisons (60% itself counts as a pass), AND
      - it has ZERO format-validity (parse) losses.
    Otherwise: KEEP BASELINE.

The format-validity veto is ONE-SIDED: it only fires on the *treatment*
(fine-tune) candidate's own parse failures. A baseline parse failure never
blocks adoption on its own -- it just costs the baseline that comparison
(automatic loss to whichever side produced valid output, or a tie if both
sides failed to parse).

Blinding: for each task, a random.Random(seed) instance (seeded once, at
harness start, from --seed) decides whether candidate A is presented to the
judge as "A" or as "B", so slot assignment is per-task and reproducible
across runs with the same seed. The judge is told only "Output A" / "Output
B" and never the candidate name or which one is the fine-tune.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import urllib.error
import urllib.request
from pathlib import Path

TEMPERATURE = 0.2
ADOPTION_WIN_RATE_THRESHOLD = 0.60


def parse_candidate_arg(raw: str) -> dict:
    fields: dict[str, str] = {}
    for part in raw.split(","):
        if "=" not in part:
            raise ValueError(f"invalid --judge segment (expected key=value): {part!r}")
        key, _, value = part.partition("=")
        fields[key.strip()] = value.strip()
    missing = [k for k in ("name", "base_url", "model", "key_env") if k not in fields]
    if missing:
        raise ValueError(f"--judge missing required fields: {missing} in {raw!r}")
    return fields


def vendor_prefix(model_name: str) -> str:
    """Best-effort vendor family from an OpenRouter-style 'vendor/model' string,
    or the whole string if there's no slash."""
    return model_name.split("/")[0].lower() if "/" in model_name else model_name.lower()


def check_judge_independence(judge_model: str, candidate_models: list[str]) -> list[str]:
    """Return a list of warning strings if the judge shares a vendor prefix
    with any candidate. Does not raise -- callers decide whether to abort."""
    warnings = []
    judge_vendor = vendor_prefix(judge_model)
    for model in candidate_models:
        if vendor_prefix(model) == judge_vendor:
            warnings.append(
                f"judge model '{judge_model}' shares vendor prefix '{judge_vendor}' "
                f"with candidate model '{model}' -- judge-family bias risk"
            )
    return warnings


def call_judge(judge: dict, prompt: str, *, timeout: int = 60) -> dict:
    api_key = os.environ.get(judge["key_env"])
    if not api_key:
        return {"ok": False, "error": f"env var {judge['key_env']} is not set"}
    payload = {
        "model": judge["model"],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": TEMPERATURE,
    }
    req = urllib.request.Request(
        url=f"{judge['base_url'].rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        return {"ok": True, "content": content}
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, KeyError, IndexError) as exc:
        return {"ok": False, "error": f"judge call failed: {exc}"}


def build_judge_prompt(task: dict, output_a: dict | None, output_b: dict | None) -> str:
    return f"""You are an independent, blind judge comparing two candidate content
blocks for an adult English-language corporate training platform (Simmonds).

You do NOT know which candidate produced which output, and you must not try
to guess -- judge only what is in front of you.

Task context:
- CEFR level: {task['level']}
- Skill: {task['skill']}
- Block type: {task['blockType']}
- Topic: {task['topic']}

Rubric (weigh all four equally):
1. CEFR fit for the stated level (not too easy, not too hard)
2. Pedagogy for adult German-L1 learners
3. Format validity (valid JSON, correct block-type shape, no markdown artifacts)
4. Professional Simmonds voice (business-appropriate, not childish)

Output A:
{json.dumps(output_a, ensure_ascii=False) if output_a is not None else "[PARSE FAILURE -- no valid output was produced]"}

Output B:
{json.dumps(output_b, ensure_ascii=False) if output_b is not None else "[PARSE FAILURE -- no valid output was produced]"}

Return ONLY strict JSON with this exact shape, no markdown, no commentary:
{{"winner": "A", "reasons": "one or two sentences"}}
(winner must be exactly "A", "B", or "tie")"""


def parse_judge_verdict(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    parsed = json.loads(text)
    if parsed.get("winner") not in ("A", "B", "tie"):
        raise ValueError(f"invalid winner value: {parsed.get('winner')!r}")
    return {"winner": parsed["winner"], "reasons": parsed.get("reasons", "")}


def judge_task(
    judge: dict,
    task: dict,
    result_a: dict,
    result_b: dict,
    rng: random.Random,
) -> dict:
    """Judge one task. Handles automatic losses for parse failures WITHOUT
    calling the judge model (nothing meaningful to compare), and blindly
    shuffles slot order for tasks where the judge is actually called.

    Returns a record with:
        task_id, slot_a_candidate, slot_b_candidate (which real candidate sat
        in which blind slot), winner_slot ("A"/"B"/"tie"/"error"),
        winner_candidate (resolved real candidate name, "tie", or "error"),
        reasons, auto (bool: True if decided without calling the judge
        because of a parse failure or infrastructure error).

    winner_candidate == "error" means this task produced NO usable signal --
    either an infrastructure failure (network/HTTP/timeout on a candidate
    call, or a failed/unparseable judge call), not evidence about candidate
    quality. Error tasks are excluded from both the win/loss tally and the
    tie tally in aggregate() (they are neither a comparison nor a tie), and
    aggregate() refuses to render a decision while any exist -- silently
    folding them into "tie" would let a run with mostly-failed judge calls
    still reach a 60%+ win rate on the handful of tasks that did complete.
    """
    a_failed = result_a["parse_failed"]
    b_failed = result_b["parse_failed"]
    # failure_kind is only present on results produced by the current
    # run_candidates.py; older result files default to "format" so existing
    # behavior (parse failure -> auto-loss) is preserved for them.
    a_kind = result_a.get("failure_kind", "format" if a_failed else None)
    b_kind = result_b.get("failure_kind", "format" if b_failed else None)
    a_transport = a_failed and a_kind == "transport"
    b_transport = b_failed and b_kind == "transport"

    # Per-task blind shuffle: decide (independently of who "is" the treatment)
    # whether candidate_a's result sits in slot A or slot B.
    swap = rng.random() < 0.5
    if not swap:
        slot_a_result, slot_b_result = result_a, result_b
        slot_a_name, slot_b_name = result_a["candidate"], result_b["candidate"]
    else:
        slot_a_result, slot_b_result = result_b, result_a
        slot_a_name, slot_b_name = result_b["candidate"], result_a["candidate"]

    if a_transport or b_transport:
        # An infrastructure failure (network/HTTP/timeout) on either side
        # means we never actually observed that candidate's output for this
        # task. This is NOT evidence of bad content and must not be scored
        # as a format-validity loss or an automatic win/loss for the other
        # side -- it is simply an incomplete comparison.
        failed_names = [
            name for name, transport in (
                (result_a["candidate"], a_transport),
                (result_b["candidate"], b_transport),
            ) if transport
        ]
        return {
            "task_id": task["id"],
            "slot_a_candidate": slot_a_name,
            "slot_b_candidate": slot_b_name,
            "winner_slot": "error",
            "winner_candidate": "error",
            "reasons": f"infrastructure/transport failure for {', '.join(failed_names)} -- task incomplete, not scored",
            "auto": True,
        }

    if a_failed or b_failed:
        # Automatic loss(es) for a genuine format/parse failure (the model
        # responded but its content didn't parse) -- no judge call needed.
        if a_failed and b_failed:
            return {
                "task_id": task["id"],
                "slot_a_candidate": slot_a_name,
                "slot_b_candidate": slot_b_name,
                "winner_slot": "tie",
                "winner_candidate": "tie",
                "reasons": "both candidates failed to parse",
                "auto": True,
            }
        loser_name = result_a["candidate"] if a_failed else result_b["candidate"]
        winner_name = result_b["candidate"] if a_failed else result_a["candidate"]
        winner_slot = "A" if slot_a_name == winner_name else "B"
        return {
            "task_id": task["id"],
            "slot_a_candidate": slot_a_name,
            "slot_b_candidate": slot_b_name,
            "winner_slot": winner_slot,
            "winner_candidate": winner_name,
            "reasons": f"{loser_name} failed to parse output (automatic loss)",
            "auto": True,
        }

    prompt = build_judge_prompt(task, slot_a_result["output"], slot_b_result["output"])
    call = call_judge(judge, prompt)
    if not call["ok"]:
        return {
            "task_id": task["id"],
            "slot_a_candidate": slot_a_name,
            "slot_b_candidate": slot_b_name,
            "winner_slot": "error",
            "winner_candidate": "error",
            "reasons": f"judge call failed: {call['error']} -- task incomplete, not scored",
            "auto": True,
        }
    try:
        verdict = parse_judge_verdict(call["content"])
    except (ValueError, json.JSONDecodeError) as exc:
        return {
            "task_id": task["id"],
            "slot_a_candidate": slot_a_name,
            "slot_b_candidate": slot_b_name,
            "winner_slot": "error",
            "winner_candidate": "error",
            "reasons": f"judge returned unparseable verdict: {exc} -- task incomplete, not scored",
            "auto": True,
        }

    winner_slot = verdict["winner"]
    if winner_slot == "tie":
        winner_candidate = "tie"
    elif winner_slot == "A":
        winner_candidate = slot_a_name
    else:
        winner_candidate = slot_b_name

    return {
        "task_id": task["id"],
        "slot_a_candidate": slot_a_name,
        "slot_b_candidate": slot_b_name,
        "winner_slot": winner_slot,
        "winner_candidate": winner_candidate,
        "reasons": verdict["reasons"],
        "auto": False,
    }


def aggregate(
    verdicts: list[dict],
    tasks_by_id: dict[str, dict],
    treatment: str,
    baseline: str,
    treatment_parse_failed_task_ids: set[str],
) -> dict:
    """Roll verdicts up into win/loss/tie counts, per-level and per-blockType
    breakdowns, and the final ADOPT / KEEP BASELINE decision.

    treatment_parse_failed_task_ids is the set of task ids where the
    TREATMENT candidate's own output failed to *parse* -- i.e. its
    failure_kind is "format", not "transport" (derived directly from
    run_candidates.py's flags, not from judge verdict text -- string-matching
    judge reasons would be fragile). The format-validity veto is one-sided:
    baseline parse failures never veto adoption on their own.

    A verdict with winner_candidate == "error" (infrastructure failure on a
    candidate call or the judge call -- see judge_task()) carries NO signal
    about quality and is excluded from both wins and ties. If any error
    tasks exist, the run is incomplete and the decision is forced to
    "INCOMPLETE" regardless of the win rate on the tasks that did complete
    -- otherwise a mostly-failed judge run could still report ADOPT off a
    tiny, unrepresentative sample of the 20 tasks."""
    wins = {treatment: 0, baseline: 0}
    ties = 0
    errors = 0
    error_task_ids: list[str] = []
    by_level: dict[str, dict[str, int]] = {}
    by_block_type: dict[str, dict[str, int]] = {}

    for verdict in verdicts:
        task = tasks_by_id[verdict["task_id"]]
        level = task["level"]
        block_type = task["blockType"]
        by_level.setdefault(level, {treatment: 0, baseline: 0, "tie": 0, "error": 0})
        by_block_type.setdefault(block_type, {treatment: 0, baseline: 0, "tie": 0, "error": 0})

        winner = verdict["winner_candidate"]
        if winner == "error":
            errors += 1
            error_task_ids.append(verdict["task_id"])
            by_level[level]["error"] += 1
            by_block_type[block_type]["error"] += 1
        elif winner == "tie":
            ties += 1
            by_level[level]["tie"] += 1
            by_block_type[block_type]["tie"] += 1
        else:
            wins[winner] += 1
            by_level[level][winner] += 1
            by_block_type[block_type][winner] += 1

    treatment_format_losses = len(treatment_parse_failed_task_ids)

    non_tie_total = wins[treatment] + wins[baseline]
    treatment_win_rate = (wins[treatment] / non_tie_total) if non_tie_total > 0 else 0.0

    meets_win_rate = non_tie_total > 0 and treatment_win_rate >= ADOPTION_WIN_RATE_THRESHOLD
    zero_format_losses = treatment_format_losses == 0
    if errors > 0:
        decision = "INCOMPLETE"
    elif meets_win_rate and zero_format_losses:
        decision = "ADOPT"
    else:
        decision = "KEEP BASELINE"

    return {
        "treatment": treatment,
        "baseline": baseline,
        "wins": wins,
        "ties": ties,
        "errors": errors,
        "error_task_ids": error_task_ids,
        "non_tie_total": non_tie_total,
        "treatment_win_rate": treatment_win_rate,
        "treatment_format_losses": treatment_format_losses,
        "by_level": by_level,
        "by_block_type": by_block_type,
        "decision": decision,
    }


def load_results(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evalset", required=True, help="path to evalset.json")
    parser.add_argument("--results-a", required=True, help="path to candidate A's results json")
    parser.add_argument("--results-b", required=True, help="path to candidate B's results json")
    parser.add_argument(
        "--treatment",
        required=True,
        help="candidate NAME (as used in run_candidates.py --candidate name=...) "
        "that is the fine-tune under evaluation. Required because the "
        "decision rule is asymmetric: only the treatment's win rate and "
        "format losses gate ADOPT.",
    )
    parser.add_argument(
        "--judge",
        required=True,
        help="name=NAME,base_url=URL,model=MODEL,key_env=ENVVAR for the judge endpoint",
    )
    parser.add_argument("--seed", type=int, required=True, help="seed for blind A/B slot shuffling")
    parser.add_argument("--out", required=True, help="output path for the judged report json")
    parser.add_argument(
        "--allow-same-vendor-judge",
        action="store_true",
        help="proceed even if the judge shares a vendor prefix with a candidate (default: abort)",
    )
    args = parser.parse_args()

    tasks = json.loads(Path(args.evalset).read_text(encoding="utf-8"))
    tasks_by_id = {t["id"]: t for t in tasks}

    results_a = load_results(Path(args.results_a))
    results_b = load_results(Path(args.results_b))
    if len(results_a) != len(results_b):
        raise SystemExit("results-a and results-b have different task counts")

    # File-integrity checks. Equal length alone (the old check) does not
    # catch a stale/mismatched results file being silently reused: two files
    # with the same length but different or duplicate task ids, or a file
    # whose records don't all belong to the same candidate, would previously
    # be aggregated as if they were a matched, complete pair.
    evalset_ids = {t["id"] for t in tasks}
    for label, records in (("results-a", results_a), ("results-b", results_b)):
        record_ids = [r["task_id"] for r in records]
        if len(set(record_ids)) != len(record_ids):
            raise SystemExit(f"{label} contains duplicate task_id entries")
        if set(record_ids) != evalset_ids:
            raise SystemExit(
                f"{label} task ids do not match evalset.json exactly "
                f"(missing: {sorted(evalset_ids - set(record_ids))}, "
                f"extra: {sorted(set(record_ids) - evalset_ids)})"
            )
        record_candidates = {r["candidate"] for r in records}
        if len(record_candidates) != 1:
            raise SystemExit(
                f"{label} mixes records from multiple candidates: {sorted(record_candidates)} "
                "-- results file may be stale or corrupted"
            )

    candidate_a_name = results_a[0]["candidate"]
    candidate_b_name = results_b[0]["candidate"]
    if candidate_a_name == candidate_b_name:
        raise SystemExit(
            f"--results-a and --results-b are both candidate {candidate_a_name!r} "
            "-- did you pass the same file twice?"
        )
    if args.treatment not in (candidate_a_name, candidate_b_name):
        raise SystemExit(
            f"--treatment {args.treatment!r} matches neither results file "
            f"({candidate_a_name!r}, {candidate_b_name!r})"
        )
    baseline_name = candidate_b_name if args.treatment == candidate_a_name else candidate_a_name

    judge = parse_candidate_arg(args.judge)
    candidate_models = [
        results_a[0].get("model", ""),
        results_b[0].get("model", ""),
    ]
    warnings = check_judge_independence(judge["model"], [m for m in candidate_models if m])
    if warnings and not args.allow_same_vendor_judge:
        raise SystemExit(
            "judge-family bias check failed:\n" + "\n".join(warnings) +
            "\nPass --allow-same-vendor-judge to override."
        )
    for w in warnings:
        print(f"WARNING: {w}")

    results_a_by_id = {r["task_id"]: r for r in results_a}
    results_b_by_id = {r["task_id"]: r for r in results_b}

    rng = random.Random(args.seed)
    verdicts = []
    for task in tasks:
        result_a = results_a_by_id[task["id"]]
        result_b = results_b_by_id[task["id"]]
        verdicts.append(judge_task(judge, task, result_a, result_b, rng))

    treatment_results_by_id = results_a_by_id if args.treatment == candidate_a_name else results_b_by_id
    # Only genuine format/parse failures veto adoption -- a transport
    # failure (network/HTTP/timeout) is not evidence the candidate produced
    # bad output. Results predating the failure_kind field default to
    # "format" for parse_failed=True records, preserving old behavior.
    treatment_parse_failed_task_ids = {
        task_id
        for task_id, r in treatment_results_by_id.items()
        if r["parse_failed"] and r.get("failure_kind", "format") == "format"
    }

    report = aggregate(
        verdicts, tasks_by_id, args.treatment, baseline_name, treatment_parse_failed_task_ids
    )
    report["verdicts"] = verdicts
    report["seed"] = args.seed

    out_path = Path(args.out)
    out_path.write_text(
        json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Treatment: {args.treatment} | Baseline: {baseline_name}")
    print(f"Wins: {report['wins']} | Ties: {report['ties']} | Errors (incomplete): {report['errors']}")
    print(f"Treatment win rate (non-tie): {report['treatment_win_rate']:.1%}")
    print(f"Treatment format losses: {report['treatment_format_losses']}")
    if report["errors"] > 0:
        print(f"Incomplete task ids (rerun these): {report['error_task_ids']}")
    print(f"DECISION: {report['decision']}")


if __name__ == "__main__":
    main()
