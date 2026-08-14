#!/usr/bin/env python3
"""CPU-only smoke test for the fine-tuning kit. NO unsloth/torch/trl/transformers
needed — only stdlib + pyyaml.

    python3 training/finetune/smoke_test.py

Checks:
  1. Both config YAMLs parse and pass train.validate_config (required keys/types).
  2. Budget guard: worst case (max_hours x $/hr) <= budget for both configs, and
     check_budget actually RAISES when a config blows the budget (negative test).
  3. JSONL schema: a hand-written valid sample line passes; malformed ones fail
     (nothing is read from training/data/ — samples are constructed inline).
  4. import train works with no heavy ML libs installed, and importing it pulls in
     NO torch/unsloth/trl/transformers/datasets/peft modules.
  5. Step planner: 1000 examples, batch 2 x ga 8, 2 epochs, ceiling 400 -> 125 steps.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

RESULTS = []


def check(name, fn):
    try:
        fn()
    except Exception as e:  # noqa: BLE001 - report anything
        RESULTS.append((name, False, f"{type(e).__name__}: {e}"))
    else:
        RESULTS.append((name, True, ""))


CONFIGS = [
    os.path.join(HERE, "config-gemma4-12b.yaml"),
    os.path.join(HERE, "config-qwen35-9b.yaml"),
]

VALID_LINE = {
    "messages": [
        {"role": "system", "content": "You are an English tutor for B1 students."},
        {"role": "user", "content": "Explain the difference between 'say' and 'tell'."},
        {"role": "assistant", "content": "'Say' focuses on the words; 'tell' needs a person: 'tell me'."},
    ]
}
BAD_LINES = {
    "not an object": [1, 2, 3],
    "missing messages": {"text": "hello"},
    "empty messages": {"messages": []},
    "bad role": {"messages": [{"role": "tutor", "content": "hi"}]},
    "empty content": {"messages": [{"role": "user", "content": "  "},
                                   {"role": "assistant", "content": "x"}]},
    "no assistant turn": {"messages": [{"role": "user", "content": "hi"}]},
    "content not string": {"messages": [{"role": "user", "content": "hi"},
                                        {"role": "assistant", "content": ["x"]}]},
}


def t_import_train_clean():
    import train  # noqa: F401 - must import on a bare CPU box
    heavy = [m for m in ("unsloth", "torch", "trl", "transformers", "datasets", "peft")
             if m in sys.modules]
    assert not heavy, f"importing train pulled in heavy modules: {heavy}"


def t_configs_validate():
    import train
    for path in CONFIGS:
        cfg = train.load_config(path)
        train.validate_config(cfg, path=path)


def t_budget_guard_ok():
    import train
    for path in CONFIGS:
        cfg = train.load_config(path)
        worst = train.check_budget(cfg)
        assert worst <= float(cfg["budget"]["budget_usd"]) + 1e-9, f"{path}: ${worst:.2f} over budget"
        # back-derivation sanity: max_hours must not exceed the derived cap
        # floor(budget/rate*100)/100, and must leave >= $0.05 real headroom
        # (config comments document the deliberate round-down: 10.10h -> 10.0h)
        rate = float(cfg["budget"]["gpu_usd_per_hour"])
        budget = float(cfg["budget"]["budget_usd"])
        derived_cap = int(budget / rate * 100) / 100.0
        assert float(cfg["budget"]["max_hours"]) <= derived_cap + 1e-9, (
            f"{path}: max_hours {cfg['budget']['max_hours']} exceeds derived cap {derived_cap}"
        )
        assert budget - worst >= 0.05, f"{path}: headroom ${budget - worst:.3f} too thin"


def t_budget_guard_raises():
    import train
    cfg = train.load_config(CONFIGS[0])
    cfg["budget"]["max_hours"] = 999.0
    try:
        train.check_budget(cfg)
    except train.BudgetError:
        return
    raise AssertionError("check_budget did not raise for max_hours=999")


def t_schema_valid_sample():
    import train
    line = json.dumps(VALID_LINE)  # hand-written sample train.jsonl line
    ok, err = train.validate_messages(json.loads(line))
    assert ok, f"valid sample rejected: {err}"


def t_schema_rejects_bad():
    import train
    for label, obj in BAD_LINES.items():
        ok, _ = train.validate_messages(obj)
        assert not ok, f"bad sample accepted: {label}"


def t_load_jsonl_roundtrip(tmp_path=None):
    import tempfile
    import train
    fd, p = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, "w") as f:
        f.write(json.dumps(VALID_LINE) + "\n\n")  # blank lines tolerated
        f.write(json.dumps(VALID_LINE) + "\n")
    try:
        recs = train.load_jsonl(p)
        assert len(recs) == 2, f"expected 2 records, got {len(recs)}"
    finally:
        os.unlink(p)


def t_step_planner():
    import train
    r = train.compute_total_steps(1000, 2, 8, 2, 400)
    # eff batch 16 -> ceil(1000/16)=63 steps/epoch -> 2 epochs = 126 (< 400 ceiling)
    assert r["total_steps"] == 126, r
    assert r["capped_by"] == "epochs", r
    r2 = train.compute_total_steps(100000, 2, 8, 2, 400)
    assert r2["total_steps"] == 400 and r2["capped_by"] == "max_steps", r2


def main():
    checks = [
        ("import train (bare CPU, no heavy ML imports)", t_import_train_clean),
        ("configs parse + validate", t_configs_validate),
        ("budget guard: worst case <= $10 (both configs)", t_budget_guard_ok),
        ("budget guard raises on over-budget config", t_budget_guard_raises),
        ("schema: valid sample line accepted", t_schema_valid_sample),
        ("schema: malformed lines rejected", t_schema_rejects_bad),
        ("load_jsonl roundtrip", t_load_jsonl_roundtrip),
        ("step planner (epoch cap + max_steps ceiling)", t_step_planner),
    ]
    print("=" * 72)
    for name, fn in checks:
        check(name, fn)
    for name, ok, err in RESULTS:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  -- {err}" if err else ""))
    print("=" * 72)
    n_fail = sum(1 for _, ok, _ in RESULTS if not ok)
    print(f"SUMMARY: {len(RESULTS) - n_fail}/{len(RESULTS)} passed, {n_fail} failed")
    print("SMOKE TEST:", "PASS" if n_fail == 0 else "FAIL")
    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main())
