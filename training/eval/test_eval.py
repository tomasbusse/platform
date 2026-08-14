"""pytest suite for the eval harness. No network calls -- uses mock judges
and hand-built result fixtures throughout."""

from __future__ import annotations

import json
import random

import pytest

import build_evalset
import judge_pairwise
import run_candidates


# ---------------------------------------------------------------------------
# build_evalset.py
# ---------------------------------------------------------------------------


def test_evalset_has_20_tasks():
    tasks = build_evalset.build_evalset()
    assert len(tasks) == 20


def test_evalset_covers_all_levels_and_block_types():
    tasks = build_evalset.build_evalset()
    levels_seen = {t["level"] for t in tasks}
    block_types_seen = {t["blockType"] for t in tasks}
    assert levels_seen == set(build_evalset.LEVELS)
    assert block_types_seen == set(build_evalset.BLOCK_TYPES)


def test_evalset_userprompt_matches_production_shape():
    tasks = build_evalset.build_evalset()
    for t in tasks:
        assert "Return ONLY JSON" in t["userPrompt"]
        assert '"title"' in t["userPrompt"]
        assert '"topic"' in t["userPrompt"]
        assert '"body"' in t["userPrompt"]
        assert "German-L1" in t["userPrompt"]
        assert t["level"] in t["userPrompt"]
        assert t["blockType"] in t["userPrompt"]


def test_evalset_is_deterministic_same_file_twice():
    """Running build_evalset() twice, or serializing it twice, must produce
    byte-identical output -- no randomness, no unstable ordering."""
    tasks_1 = build_evalset.build_evalset()
    tasks_2 = build_evalset.build_evalset()
    serialized_1 = json.dumps(tasks_1, sort_keys=True)
    serialized_2 = json.dumps(tasks_2, sort_keys=True)
    assert serialized_1 == serialized_2
    assert tasks_1 == tasks_2


def test_evalset_ids_are_unique():
    tasks = build_evalset.build_evalset()
    ids = [t["id"] for t in tasks]
    assert len(ids) == len(set(ids))


def test_evalset_has_at_least_15_distinct_topics():
    tasks = build_evalset.build_evalset()
    topics = {t["topic"] for t in tasks}
    assert len(topics) >= 15


# ---------------------------------------------------------------------------
# run_candidates.py: parsing (no network)
# ---------------------------------------------------------------------------


def test_parse_block_json_single_object():
    result = run_candidates.parse_block_json(
        '{"title": "T", "topic": "Top", "body": {"x": 1}}'
    )
    assert result == {"title": "T", "topic": "Top", "body": {"x": 1}}


def test_parse_block_json_single_element_array_is_unwrapped():
    result = run_candidates.parse_block_json(
        '[{"title": "T", "topic": "Top", "body": {"x": 1}}]'
    )
    assert result == {"title": "T", "topic": "Top", "body": {"x": 1}}


def test_parse_block_json_multi_element_array_rejected():
    with pytest.raises(ValueError):
        run_candidates.parse_block_json(
            '[{"title": "A", "topic": "t", "body": {}}, {"title": "B", "topic": "t", "body": {}}]'
        )


def test_parse_block_json_missing_keys_rejected():
    with pytest.raises(ValueError):
        run_candidates.parse_block_json('{"title": "T"}')


def test_parse_block_json_strips_code_fence():
    result = run_candidates.parse_block_json(
        '```json\n{"title": "T", "topic": "Top", "body": {}}\n```'
    )
    assert result == {"title": "T", "topic": "Top", "body": {}}


def test_parse_block_json_invalid_json_raises():
    with pytest.raises((ValueError, json.JSONDecodeError)):
        run_candidates.parse_block_json("not json at all")


def test_parse_candidate_arg():
    candidate = run_candidates.parse_candidate_arg(
        "name=ft,base_url=https://api.example.com/v1,model=org/model-x,key_env=FT_KEY"
    )
    assert candidate.name == "ft"
    assert candidate.base_url == "https://api.example.com/v1"
    assert candidate.model == "org/model-x"
    assert candidate.key_env == "FT_KEY"


def test_parse_candidate_arg_missing_field_raises():
    with pytest.raises(ValueError):
        run_candidates.parse_candidate_arg("name=ft,base_url=https://x")


# ---------------------------------------------------------------------------
# run_candidates.py: retry-exactly-once behavior, using a stubbed call_candidate
# ---------------------------------------------------------------------------


def test_retry_exactly_once_on_parse_failure(monkeypatch):
    call_count = {"n": 0}

    def fake_call_candidate(candidate, prompt, timeout=60):
        call_count["n"] += 1
        return {"ok": True, "content": "not valid json"}

    monkeypatch.setattr(run_candidates, "call_candidate", fake_call_candidate)

    candidate = run_candidates.Candidate(name="ft", base_url="http://x", model="m", key_env="K")
    task = {"id": "t1", "userPrompt": "prompt"}
    result = run_candidates.run_task_for_candidate(candidate, task)

    assert call_count["n"] == 2, "must retry exactly once (2 total attempts) on parse failure"
    assert result["parse_failed"] is True
    assert result["attempts"] == 2


def test_no_retry_when_first_attempt_succeeds(monkeypatch):
    call_count = {"n": 0}

    def fake_call_candidate(candidate, prompt, timeout=60):
        call_count["n"] += 1
        return {"ok": True, "content": '{"title": "T", "topic": "top", "body": {}}'}

    monkeypatch.setattr(run_candidates, "call_candidate", fake_call_candidate)

    candidate = run_candidates.Candidate(name="ft", base_url="http://x", model="m", key_env="K")
    task = {"id": "t1", "userPrompt": "prompt"}
    result = run_candidates.run_task_for_candidate(candidate, task)

    assert call_count["n"] == 1
    assert result["parse_failed"] is False
    assert result["attempts"] == 1


def test_retry_success_on_second_attempt_records_success(monkeypatch):
    call_count = {"n": 0}

    def fake_call_candidate(candidate, prompt, timeout=60):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return {"ok": True, "content": "garbage"}
        return {"ok": True, "content": '{"title": "T", "topic": "top", "body": {}}'}

    monkeypatch.setattr(run_candidates, "call_candidate", fake_call_candidate)

    candidate = run_candidates.Candidate(name="ft", base_url="http://x", model="m", key_env="K")
    task = {"id": "t1", "userPrompt": "prompt"}
    result = run_candidates.run_task_for_candidate(candidate, task)

    assert call_count["n"] == 2
    assert result["parse_failed"] is False
    assert result["output"] == {"title": "T", "topic": "top", "body": {}}


def test_temperature_applied_to_every_call():
    """Every candidate call must use TEMPERATURE=0.2, so no candidate gets a
    sampling advantage over another."""
    assert run_candidates.TEMPERATURE == 0.2
    assert judge_pairwise.TEMPERATURE == 0.2


# ---------------------------------------------------------------------------
# judge_pairwise.py: blind slot shuffling + reproducibility
# ---------------------------------------------------------------------------


def _make_result(candidate_name, task_id, parse_failed=False, output=None):
    return {
        "task_id": task_id,
        "candidate": candidate_name,
        "model": f"{candidate_name}-model",
        "attempts": 1,
        "parse_failed": parse_failed,
        "final_error": None,
        "output": output or {"title": "T", "topic": "top", "body": {}},
        "raw_content": "{}",
    }


def _fake_judge_always_A(judge, prompt, timeout=60):
    return {"ok": True, "content": json.dumps({"winner": "A", "reasons": "slot A is better"})}


def test_blind_shuffle_actually_randomizes_slot_assignment(monkeypatch):
    """With a mock judge that always says 'A' wins, the tally of real wins
    must still split across BOTH candidates once shuffled across many tasks
    -- otherwise the harness would just be reporting slot order, not a real
    comparison."""
    monkeypatch.setattr(judge_pairwise, "call_judge", _fake_judge_always_A)

    tasks = [
        {"id": f"t{i}", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
        for i in range(40)
    ]
    rng = random.Random(42)
    winners = []
    for task in tasks:
        result_ft = _make_result("finetune", task["id"])
        result_baseline = _make_result("baseline", task["id"])
        verdict = judge_pairwise.judge_task(
            {"model": "judge/x", "base_url": "http://x", "key_env": "K"},
            task,
            result_ft,
            result_baseline,
            rng,
        )
        winners.append(verdict["winner_candidate"])

    assert "finetune" in winners
    assert "baseline" in winners, "shuffle must be real -- not always the same candidate in slot A"


def test_blind_shuffle_is_seed_reproducible():
    tasks = [
        {"id": f"t{i}", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
        for i in range(10)
    ]

    def run_once(seed):
        rng = random.Random(seed)
        slots = []
        for task in tasks:
            result_ft = _make_result("finetune", task["id"])
            result_baseline = _make_result("baseline", task["id"])
            verdict = judge_pairwise.judge_task(
                {"model": "judge/x", "base_url": "http://x", "key_env": "K"},
                task,
                result_ft,
                result_baseline,
                rng,
            )
            slots.append(verdict["slot_a_candidate"])
        return slots

    slots_seed42_run1 = run_once(42)
    slots_seed42_run2 = run_once(42)
    slots_seed7 = run_once(7)

    assert slots_seed42_run1 == slots_seed42_run2, "same seed must reproduce identical slot assignment"
    assert slots_seed42_run1 != slots_seed7, "different seeds must (almost certainly) differ"
    assert set(slots_seed42_run1) == {"finetune", "baseline"}, "seed must not degenerate to all-one-slot"


def test_slot_to_candidate_mapping_resolves_correctly_with_mock_judge(monkeypatch):
    """The critical bug this guards against: a judge answer of 'A' means
    'whichever candidate occupies slot A on THIS task', not 'the candidate
    literally named A'. With a judge that always returns 'A', wins must be
    attributed per-task to whichever real candidate was shuffled into slot A
    -- not always to the same named candidate."""
    monkeypatch.setattr(judge_pairwise, "call_judge", _fake_judge_always_A)

    task = {"id": "t1", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
    result_ft = _make_result("finetune", "t1")
    result_baseline = _make_result("baseline", "t1")

    # Force finetune into slot B: rng.random() must return < 0.5 to trigger swap
    # (judge_task swaps when rng.random() < 0.5).
    class FixedRng:
        def random(self):
            return 0.1  # < 0.5 triggers swap in judge_task

    verdict = judge_pairwise.judge_task(
        {"model": "judge/x", "base_url": "http://x", "key_env": "K"},
        task,
        result_ft,
        result_baseline,
        FixedRng(),
    )

    assert verdict["slot_a_candidate"] == "baseline"
    assert verdict["slot_b_candidate"] == "finetune"
    # Judge said "A" -> slot A -> baseline, NOT finetune, even though finetune
    # is passed as result_a's counterpart in the function call ordering.
    assert verdict["winner_candidate"] == "baseline"


def test_slot_to_candidate_mapping_is_correct_end_to_end_with_distinguishable_payloads(monkeypatch):
    """Stronger than the mock-judge test above: that test used IDENTICAL
    fixture payloads for both candidates and a judge that ignores the prompt
    entirely, so it could not detect a bug where labels are swapped but
    payloads are not, where the "B" resolution path is broken, or where the
    prompt's Output A/B content is inverted independently of the recorded
    slot labels. Here the two candidates have distinguishable content
    ("FT-TITLE" vs "BL-TITLE"), and the fake judge actually reads the prompt
    to decide which slot the finetune's content landed in, then always votes
    for THAT slot. If slot assignment, prompt construction, or winner
    resolution were broken in any of those ways, this test would catch it
    where the identical-payload test could not."""

    def judge_that_finds_finetune_by_content(judge, prompt, timeout=60):
        # Find which slot (A or B) contains the finetune's distinctive title
        # by locating "Output A:" / "Output B:" and checking which block
        # contains "FT-TITLE".
        idx_a = prompt.index("Output A:")
        idx_b = prompt.index("Output B:")
        if idx_a < idx_b:
            block_a = prompt[idx_a:idx_b]
        else:
            block_a = prompt[idx_a:]
        winner = "A" if "FT-TITLE" in block_a else "B"
        return {"ok": True, "content": json.dumps({"winner": winner, "reasons": "content-based"})}

    monkeypatch.setattr(judge_pairwise, "call_judge", judge_that_finds_finetune_by_content)

    tasks = [
        {"id": f"t{i}", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
        for i in range(40)
    ]
    rng = random.Random(42)
    for task in tasks:
        result_ft = _make_result(
            "finetune", task["id"], output={"title": "FT-TITLE", "topic": "top", "body": {}}
        )
        result_baseline = _make_result(
            "baseline", task["id"], output={"title": "BL-TITLE", "topic": "top", "body": {}}
        )
        verdict = judge_pairwise.judge_task(
            {"model": "judge/x", "base_url": "http://x", "key_env": "K"},
            task,
            result_ft,
            result_baseline,
            rng,
        )
        # The judge always picks the slot containing "FT-TITLE" -- so the
        # resolved winner must always be "finetune", regardless of which
        # slot the shuffle happened to put it in on this task.
        assert verdict["winner_candidate"] == "finetune"
        # And whichever slot won must be the slot that actually held the
        # finetune's payload -- cross-check winner_slot against slot_a/b.
        if verdict["winner_slot"] == "A":
            assert verdict["slot_a_candidate"] == "finetune"
        else:
            assert verdict["slot_b_candidate"] == "finetune"


# ---------------------------------------------------------------------------
# judge_pairwise.py: parse-failure auto-loss
# ---------------------------------------------------------------------------


def test_parse_failure_is_automatic_loss_not_tie_or_skip():
    task = {"id": "t1", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
    result_ft = _make_result("finetune", "t1", parse_failed=True)
    result_baseline = _make_result("baseline", "t1", parse_failed=False)
    rng = random.Random(1)

    verdict = judge_pairwise.judge_task(
        {"model": "judge/x", "base_url": "http://x", "key_env": "K"}, task, result_ft, result_baseline, rng
    )

    assert verdict["auto"] is True
    assert verdict["winner_candidate"] == "baseline"
    assert verdict["winner_candidate"] != "tie"


def test_both_parse_failures_is_a_tie():
    task = {"id": "t1", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
    result_ft = _make_result("finetune", "t1", parse_failed=True)
    result_baseline = _make_result("baseline", "t1", parse_failed=True)
    rng = random.Random(1)

    verdict = judge_pairwise.judge_task(
        {"model": "judge/x", "base_url": "http://x", "key_env": "K"}, task, result_ft, result_baseline, rng
    )

    assert verdict["winner_candidate"] == "tie"


# ---------------------------------------------------------------------------
# judge_pairwise.py: aggregate() decision rule edges
# ---------------------------------------------------------------------------


def _verdict(task_id, winner_candidate):
    return {
        "task_id": task_id,
        "winner_candidate": winner_candidate,
        "reasons": "",
        "auto": False,
    }


def _tasks_by_id(n, level="B1", block_type="exerciseAtom"):
    return {f"t{i}": {"level": level, "blockType": block_type} for i in range(n)}


def test_decision_adopt_at_exactly_60_percent():
    # 6 finetune wins, 4 baseline wins => 60% exactly => must ADOPT (inclusive)
    verdicts = [_verdict(f"t{i}", "finetune") for i in range(6)] + [
        _verdict(f"t{i}", "baseline") for i in range(6, 10)
    ]
    report = judge_pairwise.aggregate(
        verdicts, _tasks_by_id(10), "finetune", "baseline", treatment_parse_failed_task_ids=set()
    )
    assert report["treatment_win_rate"] == pytest.approx(0.6)
    assert report["decision"] == "ADOPT"


def test_decision_keep_baseline_just_under_60_percent():
    # 5 finetune wins, 5 baseline wins => 50% => KEEP BASELINE
    verdicts = [_verdict(f"t{i}", "finetune") for i in range(5)] + [
        _verdict(f"t{i}", "baseline") for i in range(5, 10)
    ]
    report = judge_pairwise.aggregate(
        verdicts, _tasks_by_id(10), "finetune", "baseline", treatment_parse_failed_task_ids=set()
    )
    assert report["decision"] == "KEEP BASELINE"


def test_decision_all_tie_keeps_baseline_no_zero_division():
    verdicts = [_verdict(f"t{i}", "tie") for i in range(5)]
    report = judge_pairwise.aggregate(
        verdicts, _tasks_by_id(5), "finetune", "baseline", treatment_parse_failed_task_ids=set()
    )
    assert report["non_tie_total"] == 0
    assert report["treatment_win_rate"] == 0.0
    assert report["decision"] == "KEEP BASELINE"


def test_decision_format_loss_vetoes_adoption_even_at_high_win_rate():
    # 10/10 finetune wins (100%) but 1 format loss -> must still KEEP BASELINE
    verdicts = [_verdict(f"t{i}", "finetune") for i in range(10)]
    report = judge_pairwise.aggregate(
        verdicts,
        _tasks_by_id(10),
        "finetune",
        "baseline",
        treatment_parse_failed_task_ids={"t0"},
    )
    assert report["treatment_win_rate"] == pytest.approx(1.0)
    assert report["decision"] == "KEEP BASELINE"


def test_baseline_format_loss_does_not_veto_adoption():
    """The veto is one-sided: it only checks the TREATMENT's own parse
    failures. A baseline parse failure (already reflected as a treatment
    win via auto-loss) must not additionally block adoption."""
    verdicts = [_verdict(f"t{i}", "finetune") for i in range(10)]
    report = judge_pairwise.aggregate(
        verdicts,
        _tasks_by_id(10),
        "finetune",
        "baseline",
        treatment_parse_failed_task_ids=set(),  # baseline's failure is not the treatment's
    )
    assert report["decision"] == "ADOPT"


def test_by_level_and_by_block_type_breakdowns_present():
    verdicts = [_verdict("t0", "finetune"), _verdict("t1", "baseline"), _verdict("t2", "tie")]
    tasks_by_id = {
        "t0": {"level": "A1", "blockType": "vocabSet"},
        "t1": {"level": "B1", "blockType": "dialogue"},
        "t2": {"level": "C1", "blockType": "readingPassage"},
    }
    report = judge_pairwise.aggregate(
        verdicts, tasks_by_id, "finetune", "baseline", treatment_parse_failed_task_ids=set()
    )
    assert report["by_level"]["A1"]["finetune"] == 1
    assert report["by_level"]["B1"]["baseline"] == 1
    assert report["by_level"]["C1"]["tie"] == 1
    assert report["by_block_type"]["vocabSet"]["finetune"] == 1


# ---------------------------------------------------------------------------
# judge_pairwise.py: judge-family independence check
# ---------------------------------------------------------------------------


def test_vendor_prefix_extraction():
    assert judge_pairwise.vendor_prefix("openai/gpt-5-mini") == "openai"
    assert judge_pairwise.vendor_prefix("z-ai/glm-5.2") == "z-ai"
    assert judge_pairwise.vendor_prefix("some-model-without-slash") == "some-model-without-slash"


def test_check_judge_independence_flags_same_vendor():
    warnings = judge_pairwise.check_judge_independence(
        "z-ai/glm-5.2", ["z-ai/glm-4.6-lora", "openai/gpt-5"]
    )
    assert len(warnings) == 1
    assert "glm-4.6-lora" in warnings[0]


def test_check_judge_independence_clean_when_different_vendors():
    warnings = judge_pairwise.check_judge_independence(
        "openai/gpt-5-mini", ["together/qwen-lora", "cerebras/gemma-baseline"]
    )
    assert warnings == []


# ---------------------------------------------------------------------------
# run_candidates.py: transport failures must be distinguishable from genuine
# model-output format/parse failures (they are NOT the same thing downstream)
# ---------------------------------------------------------------------------


def test_transport_failure_is_tagged_transport_not_format(monkeypatch):
    """A pure network/HTTP/timeout failure (call never succeeds) must be
    tagged failure_kind='transport', not conflated with a genuine
    format/parse failure -- judge_pairwise.py's one-sided format-validity
    veto must never fire because of a network blip."""

    def fake_call_transport_error(candidate, prompt, timeout=60):
        return {"ok": False, "error": "transport error: timed out"}

    monkeypatch.setattr(run_candidates, "call_candidate", fake_call_transport_error)

    candidate = run_candidates.Candidate(name="finetune", base_url="http://x", model="m", key_env="K")
    task = {"id": "t1", "userPrompt": "prompt"}
    result = run_candidates.run_task_for_candidate(candidate, task)

    assert result["parse_failed"] is True
    assert result["failure_kind"] == "transport"


def test_genuine_parse_failure_is_tagged_format(monkeypatch):
    def fake_call_bad_json(candidate, prompt, timeout=60):
        return {"ok": True, "content": "not valid json"}

    monkeypatch.setattr(run_candidates, "call_candidate", fake_call_bad_json)

    candidate = run_candidates.Candidate(name="finetune", base_url="http://x", model="m", key_env="K")
    task = {"id": "t1", "userPrompt": "prompt"}
    result = run_candidates.run_task_for_candidate(candidate, task)

    assert result["parse_failed"] is True
    assert result["failure_kind"] == "format"


def test_successful_call_has_no_failure_kind(monkeypatch):
    def fake_call_ok(candidate, prompt, timeout=60):
        return {"ok": True, "content": '{"title": "T", "topic": "top", "body": {}}'}

    monkeypatch.setattr(run_candidates, "call_candidate", fake_call_ok)

    candidate = run_candidates.Candidate(name="finetune", base_url="http://x", model="m", key_env="K")
    task = {"id": "t1", "userPrompt": "prompt"}
    result = run_candidates.run_task_for_candidate(candidate, task)

    assert result["parse_failed"] is False
    assert result["failure_kind"] is None


# ---------------------------------------------------------------------------
# judge_pairwise.py: transport failures and judge-call failures must be
# "error" (excluded, incomplete), never silently folded into "tie" or
# scored as an automatic win/loss
# ---------------------------------------------------------------------------


def test_transport_failure_on_either_side_is_error_not_auto_loss():
    """A candidate's own transport failure (network/HTTP/timeout) must not
    be scored as an automatic loss to the other side, and must not trigger
    the format-validity veto -- it produced no output to judge at all."""
    task = {"id": "t1", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
    result_ft = _make_result("finetune", "t1", parse_failed=True)
    result_ft["failure_kind"] = "transport"
    result_baseline = _make_result("baseline", "t1", parse_failed=False)
    rng = random.Random(1)

    verdict = judge_pairwise.judge_task(
        {"model": "judge/x", "base_url": "http://x", "key_env": "K"}, task, result_ft, result_baseline, rng
    )

    assert verdict["winner_candidate"] == "error"
    assert verdict["winner_candidate"] not in ("tie", "finetune", "baseline")


def test_judge_call_failure_is_error_not_a_tie(monkeypatch):
    """A failed judge call (timeout, bad response) must be recorded as
    'error' -- NOT silently folded into 'tie', which would be excluded from
    the win-rate denominator without flagging the run as incomplete."""

    def fake_judge_fails(judge, prompt, timeout=60):
        return {"ok": False, "error": "timeout"}

    monkeypatch.setattr(judge_pairwise, "call_judge", fake_judge_fails)

    task = {"id": "t1", "level": "B1", "skill": "grammar", "blockType": "exerciseAtom", "topic": "x"}
    result_ft = _make_result("finetune", "t1")
    result_baseline = _make_result("baseline", "t1")
    rng = random.Random(1)

    verdict = judge_pairwise.judge_task(
        {"model": "judge/x", "base_url": "http://x", "key_env": "K"}, task, result_ft, result_baseline, rng
    )

    assert verdict["winner_candidate"] == "error"


def test_aggregate_forces_incomplete_decision_when_errors_present():
    """The regression this guards against: a run where most judge calls
    failed (recorded as ties under the old behavior) could still report a
    100% win rate on the handful of tasks that completed, and ADOPT off an
    unrepresentative sample. Any error task must force decision=INCOMPLETE
    regardless of the win rate on the tasks that did complete."""
    verdicts = [_verdict("t0", "finetune")] + [
        {"task_id": f"t{i}", "winner_candidate": "error", "reasons": "", "auto": True}
        for i in range(1, 20)
    ]
    report = judge_pairwise.aggregate(
        verdicts, _tasks_by_id(20), "finetune", "baseline", treatment_parse_failed_task_ids=set()
    )
    assert report["errors"] == 19
    assert report["treatment_win_rate"] == pytest.approx(1.0)  # would look like a clean 100% win
    assert report["decision"] == "INCOMPLETE", "must not silently ADOPT off 1 real comparison"


def test_aggregate_clean_run_with_zero_errors_still_decides_normally():
    verdicts = [_verdict(f"t{i}", "finetune") for i in range(6)] + [
        _verdict(f"t{i}", "baseline") for i in range(6, 10)
    ]
    report = judge_pairwise.aggregate(
        verdicts, _tasks_by_id(10), "finetune", "baseline", treatment_parse_failed_task_ids=set()
    )
    assert report["errors"] == 0
    assert report["decision"] == "ADOPT"
