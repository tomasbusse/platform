# Blind pairwise eval harness

Decides whether a LoRA fine-tune of Gemma/Qwen actually beats the current
production approach (stock model + retrieved exemplars) before adoption,
using a blind pairwise judge and a fixed decision rule.

**Decision rule:** ADOPT the fine-tune only if it wins **>= 60%** of
non-tie comparisons AND has **zero format-validity (parse) losses** of its
own. Otherwise: **KEEP BASELINE**. The 60% threshold is inclusive (exactly
60% passes). The format-validity veto is **one-sided**: it only fires on
the treatment's (fine-tune's) own genuine parse failures (`failure_kind ==
"format"`) — a baseline parse failure never blocks adoption by itself, and
neither candidate's transport/network failures (`failure_kind ==
"transport"`) count as a format loss for either side.

If any task could not be judged at all — a candidate call never got a usable
response (network/HTTP/timeout), or the judge call itself failed or returned
an unparseable verdict — that task is recorded as `error`, not `tie`, and is
excluded from both the win/tie tally. **If any error tasks exist, the
decision is forced to `INCOMPLETE`** regardless of the win rate on the tasks
that did complete: `report.json`'s `error_task_ids` lists which tasks to
rerun. This exists specifically so a run with a flaky judge endpoint can't
quietly report `ADOPT` off a handful of tasks that happened to succeed.

Python 3.12, stdlib only (`urllib.request` for HTTP — no `requests`
dependency required, though the code would work unchanged if you swap it
in). No heavy deps, no GPU needed to run the harness itself.

## Files

- `build_evalset.py` — generates `evalset.json`: 20 fixed, hand-curated
  eval tasks spanning all 5 CEFR levels (A1–C1) and all 5 block types
  (`vocabSet`, `dialogue`, `grammarExplainer`, `exerciseAtom`,
  `readingPassage`), with realistic adult/business topics (booking travel,
  negotiating contracts, giving feedback, requesting deadline extensions,
  etc.). Fully deterministic — no `random`, stable JSON serialization,
  running it twice produces byte-identical output.
- `run_candidates.py` — calls each candidate's OpenAI-compatible
  `/chat/completions` endpoint for every task at `temperature=0.2`, with
  exactly one retry on a parse failure. Validates each output as JSON with
  `title`/`topic`/`body` (also accepts a single-element array wrapper,
  unwrapped before validation — see **Deviations** below). Persists raw +
  parsed results per candidate to `results/<candidate-name>.json`.
- `judge_pairwise.py` — takes two candidates' results files, blindly
  shuffles A/B slot order per task (seeded, reproducible), calls a third
  judge endpoint with a strict rubric, and aggregates win/loss/tie counts
  (overall, per-level, per-blockType) into the final `ADOPT` /
  `KEEP BASELINE` decision.
- `test_eval.py` — pytest suite, no network. Mocks the judge and candidate
  calls; covers blind-shuffle randomization + seed-reproducibility,
  slot→candidate mapping correctness, parse-failure auto-loss, decision-rule
  edges (60% boundary, all-tie, format-loss veto asymmetry), and evalset
  determinism.
- `results/` — output directory for `run_candidates.py` (git-ignored
  contents recommended; only the harness code is meant to be checked in).

## End-to-end bake-off procedure

### 1. Build the eval set (once; it's fixed/deterministic)

```bash
cd training/eval
python3 build_evalset.py --out evalset.json
```

### 2. Run each candidate

Example: LoRA fine-tune served on Together, baseline (stock model +
exemplar retrieval) served via Cerebras. Each candidate needs its own API
key in an environment variable named by `key_env` — the key itself is never
passed on the CLI.

```bash
export TOGETHER_API_KEY=...
export CEREBRAS_API_KEY=...

python3 run_candidates.py \
  --evalset evalset.json \
  --out results/ \
  --candidate "name=finetune,base_url=https://api.together.xyz/v1,model=your-org/gemma-simmonds-lora,key_env=TOGETHER_API_KEY" \
  --candidate "name=baseline,base_url=https://api.cerebras.ai/v1,model=llama-3.3-70b,key_env=CEREBRAS_API_KEY"
```

This writes `results/finetune.json` and `results/baseline.json`, each with
one record per task: raw output, parsed `title`/`topic`/`body` (or `None`
on parse failure), and how many attempts it took.

### 3. Judge, blind, with a third model family

**Use a judge from a different model family than either candidate.** Here,
judge with `openai/gpt-5-mini` via OpenRouter — never GLM/Qwen judging a
Qwen fine-tune, never Gemini judging a Gemini-family candidate. See
"Judge-family bias" below for why, and note `judge_pairwise.py` will
**refuse to run** (unless you pass `--allow-same-vendor-judge`) if the
judge's vendor prefix matches either candidate's model string.

```bash
export OPENROUTER_API_KEY=...

python3 judge_pairwise.py \
  --evalset evalset.json \
  --results-a results/finetune.json \
  --results-b results/baseline.json \
  --treatment finetune \
  --judge "name=judge,base_url=https://openrouter.ai/api/v1,model=openai/gpt-5-mini,key_env=OPENROUTER_API_KEY" \
  --seed 20260814 \
  --out results/report.json
```

`--treatment` tells the harness which candidate is the fine-tune under
test — required because the decision rule is asymmetric (only the
treatment's win rate and format losses gate `ADOPT`). The judge never sees
which candidate is the treatment; it only sees "Output A" / "Output B" in a
per-task random order derived from `--seed`.

### 4. Read the decision

`run_candidates.py` and `judge_pairwise.py` both print a summary; the full
detail (win/loss/tie table, per-level and per-blockType breakdown, every
individual verdict with reasons) is in `results/report.json`. The line that
matters:

```
DECISION: ADOPT
```
or
```
DECISION: KEEP BASELINE
```

## Known failure modes

A bake-off can silently lie in several ways. Below, each is tagged
**defended in code** (the harness actively guards against it) or
**operator discipline** (the harness cannot enforce this — it's on whoever
runs the bake-off).

| Failure mode | Status | Notes |
|---|---|---|
| **Judge-family bias** (judge favors outputs stylistically closer to its own model family) | **Partially defended in code** | `judge_pairwise.py` compares the judge's vendor prefix (`vendor/model` string) against both candidates' recorded model names and **refuses to run** on a match unless `--allow-same-vendor-judge` is explicitly passed. This is a string-prefix heuristic, not a semantic guarantee — a judge and candidate from different vendor strings that are actually related (e.g. a fine-tune of the judge's own base model hosted under a different provider name) would slip through. Choosing a genuinely distinct third family (the README's own worked example: OpenRouter `openai/gpt-5-mini` judging a Together-hosted Gemma/Qwen LoRA vs. a Cerebras-hosted baseline) remains **operator discipline**. |
| **Prompt mismatch between candidates** (one candidate gets a subtly different prompt, or is used through a wrapper that adds system messages) | **Defended in code, with one caveat** | `run_candidates.py` sends the exact same `evalset.json` `userPrompt` string to every candidate as a single user message, no per-candidate templating. The caveat: whichever inference stack serves the fine-tune may prepend its own chat template / system prompt server-side (this is common for hosted LoRA endpoints) — the harness cannot see or control that, so verifying both endpoints receive a comparably "bare" prompt is **operator discipline**. |
| **Temperature asymmetry** | **Defended in code** | `TEMPERATURE = 0.2` is a hardcoded module constant used for every candidate call and every retry in `run_candidates.py`, and for the judge call in `judge_pairwise.py`. There is no per-candidate override in the CLI, so this cannot be misconfigured per-candidate short of editing the source. |
| **Eval-set leakage into training data** (the fine-tune was trained on data overlapping the 20 fixed eval tasks or their topics, inflating its apparent win rate) | **Operator discipline — not defended** | The harness has no visibility into the fine-tune's training set. `evalset.json` is deterministic and checked into the repo, which makes leakage *more* likely if training pipelines pull from this same directory carelessly — the mitigation is procedural: keep `training/eval/` excluded from any training-data assembly script, and treat a suspiciously high finetune win rate as a prompt to audit training data provenance, not just a green light. |
| **Blind-order leakage** (judge infers which slot is the fine-tune from stylistic tells, register, or ordering patterns across tasks) | **Partially defended in code** | Slot order is shuffled independently per task via a seeded RNG (`judge_pairwise.py::judge_task`), so there is no fixed "A is always the fine-tune" pattern within one run. The judge is also explicitly told not to try to guess which is which. This does not stop a judge from learning to recognize a specific model's writing style across many bake-offs — that residual risk is inherent to any LLM-as-judge setup and is not fully closable in code. |
| **Format-validity veto gaming** (a candidate could "win" pedagogically while quietly failing format on tasks that never reach the judge) | **Defended in code** | Parse failures are recorded as **automatic losses** before the judge is ever called (`judge_pairwise.py::judge_task`), not skipped, not tied (unless both sides fail), and the treatment's parse-failure count is tracked independently from judge verdicts (via `run_candidates.py`'s `parse_failed`/`failure_kind` flags, not by parsing judge-verdict text) so a single treatment format failure vetoes `ADOPT` even at a 100% win rate on the tasks that did parse. |
| **Judge/candidate infrastructure failures silently scored as a comparison** (a network blip or judge timeout gets counted as a "tie" or an automatic loss/win instead of "we didn't actually observe a result") | **Defended in code** | `run_candidates.py` tags every failed final attempt with `failure_kind`: `"transport"` (network/HTTP/timeout — no output was ever produced) vs. `"format"` (the call succeeded but the model's text didn't parse). `judge_pairwise.py::judge_task` treats a transport failure on either candidate, or a failed/unparseable judge call, as `winner_candidate == "error"` — excluded from both the win/loss and tie tallies. `aggregate()` forces `decision = "INCOMPLETE"` whenever any error tasks exist, listing them in `error_task_ids` for rerun, regardless of how the tasks that did complete scored. |
| **Stale or mismatched results files silently reused** (e.g. `--results-a`/`--results-b` point at an old run, a truncated file, or the same file twice) | **Partially defended in code** | `judge_pairwise.py`'s `main()` checks that both results files have exactly the evalset's task ids (no missing, no extra, no duplicates), that every record within a file shares one `candidate` name, and that `--results-a`/`--results-b` aren't the same candidate. It does **not** check that a results file was generated from the current `evalset.json` content (e.g. via a hash) or that both files come from the same run/timestamp — a results file that happens to have the right task ids but is stale from an earlier prompt version would still pass. |
| **Slot→candidate mislabeling** (the classic bug: tallying "Output A won" as a literal win for whichever candidate is *named* A, instead of whichever candidate the shuffle put in slot A on that specific task) | **Defended in code, test-covered** | `judge_task` resolves `winner_slot` ("A"/"B"/"tie") back to the real candidate name using that task's own shuffle assignment (`slot_a_candidate`/`slot_b_candidate`), not a fixed mapping. `test_eval.py::test_slot_to_candidate_mapping_resolves_correctly_with_mock_judge` uses a judge that always answers `"A"` and a forced-swap task, and asserts the win is attributed to whichever candidate actually sat in slot A — not to the candidate literally named `"A"`. |

## Deviations from the literal spec

- **Single-object vs. array-wrapped output.** The eval prompt (per spec)
  asks each candidate to return a single JSON object with keys
  `title`/`topic`/`body`. Production's real generator prompt
  (`convex/ai/lessonDbLogic.ts::DEFAULT_PROMPT_TEMPLATE`) asks for a JSON
  **array** of `{{count}}` objects (batch generation). Since eval calls
  request exactly one block per task, the single-object framing is the
  closer match to the eval's own per-task granularity — but if a model
  (especially the fine-tune, if it was trained against production's array
  shape) still emits a single-element array out of habit, penalizing that
  as a hard parse failure would unfairly measure prompt-following instead
  of content quality. `run_candidates.py::parse_block_json` therefore
  accepts a single-element array and unwraps it before validating
  `title`/`topic`/`body`; a multi-element array is still rejected as a
  parse failure. The prompt text itself was **not** changed to ask for an
  array — only the parser was made tolerant of that one alternate shape.
- **Eval-set coverage is not a full 5x5 grid.** `build_evalset.py`'s 20
  fixed tasks cover every CEFR level and every blockType *marginally*, but
  not every (level, blockType) pair: A1/A2/B1 each get a full row (all 5
  blockTypes), B2 gets 4/5 (missing `readingPassage`), and **C1 gets only
  1/5** (`vocabSet` only — missing `dialogue`, `grammarExplainer`,
  `exerciseAtom`, `readingPassage`). An early version of this file's
  comment incorrectly claimed "exactly a 5x5 grid"; that was a documentation
  bug, not a code bug — `_validate_coverage()` only ever asserted marginal
  coverage. Practical effect: a win rate computed from this evalset is much
  weaker evidence at C1 than at A1–B1, and an adoption decision does not
  meaningfully test most advanced-content generation modes. Expanding to a
  true 25-task grid (or otherwise rebalancing toward C1) is a product
  decision, not addressed by this harness.
- **GLM 5.2 was unavailable for this build.** See the top-level receipt:
  the z.ai coding-plan endpoint returned an insufficient-balance error for
  both `glm-5.2` and `glm-4.6`, so this harness (including this
  failure-modes analysis) was authored directly rather than delegated. The
  self-adversarial analysis above is a single model's pass, not an
  independent cross-model review — treat it accordingly.
