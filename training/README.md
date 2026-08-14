# Simmonds Model Training Kit

Everything needed to fine-tune the Simmonds lesson model, end to end. Built 2026-08-14
by Codex (export), Kimi K3 (finetune), and a Codex-adversarially-reviewed eval harness.
Nothing here spends money until step 3 launches a RunPod pod.

## The pipeline

```
convex export  →  export/   →  data/train.jsonl + val.jsonl   (rights-gated, deduped)
                  finetune/ →  LoRA adapter                    (RunPod, ≤ $9.90 hard cap)
                  eval/     →  blind bake-off vs baseline      (ADOPT / KEEP BASELINE / INCOMPLETE)
```

## Step 0 — is it time yet? (run any day, free)

```bash
npx convex export --prod --path /tmp/snapshot.zip
cd training/export && python3 gate_check.py --snapshot /tmp/snapshot.zip
```

Exit 0 = gate met (≥500 teacher-touched pairs) → proceed. Exit 2 = not yet; the report
shows the current count. Signals that fill the gate: teacher approvals in the
Inhaltsprüfung page + edited lessons saved in the lesson builder.

## Step 1 — export the dataset

```bash
cd training/export
python3 export_dataset.py --snapshot /tmp/snapshot.zip --out ../data
```

Hard rights gate: `cc_by_sa` and `unknown` records never enter the weights (share-alike
and unknown licenses cannot be honored inside a model). `--include-seed` exists for a
format-pretraining experiment but is OFF by default — seed data teaches format, not
Simmonds style. Output: `train.jsonl`, `val.jsonl`, `stats.json`.

## Step 2 — sanity check locally (free)

```bash
cd training/finetune && python3 smoke_test.py   # 8 checks, no GPU needed
```

## Step 3 — train on RunPod (~$1–2 expected, $9.90 worst-case hard cap)

Follow `finetune/RUNBOOK.md` exactly. Summary: L40S pod ($0.99/hr), upload
`training/data/`, `python train.py config-gemma4-12b.yaml`. In-script guards:
budget refusal before any GPU work, wall-clock abort at 10.0h that still saves the
adapter. Primary = Gemma 4 12B QLoRA; challenger = Qwen3.5-9B bf16 LoRA
(`config-qwen35-9b.yaml`). Watch the first run live — the transformers/unsloth
version pin is the known fragile point (see RUNBOOK).

## Step 4 — blind bake-off (the adoption gate)

Follow `eval/README.md`: serve the adapter (Together dedicated endpoint or Modal),
then 20 fixed tasks, fine-tune vs current production baseline, judged blind by a
third model family. Decision rule: **ADOPT only if the fine-tune wins ≥60% of
non-tie comparisons with zero format losses; any judge/transport errors force
INCOMPLETE — rerun, never adopt on a partial result.**

## Adjudicated policy decisions (chair rulings, 2026-08-14)

- Eval parser keeps production-matching tolerance (strips code fences, unwraps
  single-element arrays): the gate measures "usable by the production parser",
  not literal instruction-following. (Codex flagged; ruled intentional.)
- Model-generated content is `rightsStatus: proprietary` (school's own work product).

## Current status

Gate NOT met (0 teacher-touched pairs at build time — flywheel started 2026-08-14).
Everything above is tested and ready; the only missing input is teacher usage.
