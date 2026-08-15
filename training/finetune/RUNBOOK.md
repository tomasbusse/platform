# RUNBOOK — LoRA fine-tune on RunPod (English-school lesson model)

Two configs, one kit. Everything below was verified against live sources on
2026-08-14 (citations inline). Total owner credit: **$15** — this kit keeps ONE
full run under **$10 worst case, enforced in code**, not by operator memory.

| | config-gemma4-12b.yaml | config-qwen35-9b.yaml |
|---|---|---|
| Base model | `unsloth/gemma-4-12b-it` (mirror of gated `google/gemma-4-12B-it`) | `unsloth/Qwen3.5-9B` (mirror of `Qwen/Qwen3.5-9B`) |
| Method | QLoRA 4-bit, r=16, α=32, lr 2e-4 cosine | bf16 LoRA, r=16, α=32, lr 2e-4 cosine |
| Why | spec default for Gemma | Unsloth: *"It is not recommended to do QLoRA (4-bit) training on the Qwen3.5 models, no matter MoE or dense, due to higher than normal quantization differences."* — [unsloth.ai/docs/models/qwen3.5/fine-tune](https://unsloth.ai/docs/models/qwen3.5/fine-tune) |
| VRAM needed | ~10–14GB (UNVERIFIED estimate; Unsloth cites E4B LoRA 17GB, 31B QLoRA 22GB) | 22GB (Unsloth-cited, same page) |

---

## 1. Pod setup

- **Template/image:** `runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04`
  (tag verified on Docker Hub 2026-08-14). Ships torch 2.8.0 + CUDA 12.8 — required
  by `causal_conv1d==1.6.0` for Qwen3.5 and within unsloth's `torch>=2.4.0,<2.12.0`.
- **GPU:** **L40S 48GB — $0.99/hr** ([runpod.io/pricing](https://www.runpod.io/pricing),
  "Updated July 27, 2026": `L40S $0.99/hr 48 GB VRAM`). Cheapest GPU that fits both
  configs. Fallback: A100 PCIe 80GB @ **$1.39/hr** (same page) — if you use it, set
  `max_hours: 7.0` in the config first (see §3).
- **Container disk:** ≥ 60GB (9B bf16 weights ≈ 18GB; 12B 4-bit ≈ 8GB; outputs +
  optional merged model on top). No network volume needed for a single run.
- Deploy pod → open web terminal (or SSH). Pods bill per second **while running,
  even idle** — terminate the pod when done (§7).

## 2. Install (on the pod)

Mirrors the official Unsloth notebooks `nb/Gemma4_(12B)_Text.ipynb` and
`nb/Qwen3_5_(4B)_Vision.ipynb` (github.com/unslothai/notebooks). Order matters —
`requirements.txt` documents the pins but cannot express ordering, so use these:

```bash
pip install unsloth==2026.8.16
pip install --no-deps transformers==5.10.1 "tokenizers>=0.22.0,<=0.23.0"
pip install "huggingface_hub>=1.5.0,<2.0" "trl==0.22.2" "peft>=0.18.0" \
    "accelerate>=0.34.1" "datasets==4.3.0" \
    "bitsandbytes>=0.45.5,!=0.46.0,!=0.48.0" "xformers==0.0.32.post2" \
    sentencepiece protobuf torchcodec
pip install --no-deps --upgrade timm
# Qwen3.5 config ONLY (Gated DeltaNet kernels; source build, takes a few min):
pip install --no-build-isolation flash-linear-attention causal_conv1d==1.6.0
```

Why `--no-deps` on transformers: unsloth's PyPI metadata (2026.8.16) still caps
`transformers<=5.5.0`, but Unsloth's own current Gemma 4 notebook force-installs
`transformers==5.10.1 --no-deps`, and the Qwen3.5 guide says *"Please use
transformers v5 for Qwen3.5. Older versions will not work."* We follow the
notebook (the newer artifact). If `5.10.1` ever misbehaves for Qwen3.5, the
Qwen3.5 notebook's known-good pin is `transformers==5.2.0`.

## 3. Budget (hard limits, code-enforced)

Guards in `train.py`: **(a)** `check_budget()` refuses to start if
`max_hours × gpu_usd_per_hour > budget_usd` (exit 5, before any GPU work);
**(b)** a wall-clock callback aborts the run at `max_hours` and **saves the LoRA
adapter before exiting** (exit 3); **(c)** `max_steps` is an absolute step
ceiling on top of the 2-epoch cap (train.py runs `min(2-epoch plan, max_steps)`).

| Config | GPU | $/hr | max_hours derivation | Worst case | Expected wall @ ~1000 ex. | Expected cost |
|---|---|---|---|---|---|---|
| gemma4-12b (QLoRA) | L40S 48GB | $0.99 | $10 ÷ $0.99 = 10.10h → **10.0h** | 10.0 × 0.99 = **$9.90** ✅ | ~0.5–1.0h (125 steps @ eff. batch 16 + download/compile) | ~$0.50–$1.00 |
| qwen35-9b (bf16) | L40S 48GB | $0.99 | $10 ÷ $0.99 = 10.10h → **10.0h** | 10.0 × 0.99 = **$9.90** ✅ | ~0.5–1.2h (same; first run adds FLA/causal-conv kernel compile) | ~$0.50–$1.20 |
| either (fallback) | A100 PCIe 80GB | $1.39 | $10 ÷ $1.39 = 7.19h → **7.0h** | 7.0 × 1.39 = **$9.73** ✅ | similar (A100 ≈ L40S-class for LoRA) | ~$0.70–$1.40 |

Expected-time figures are planning estimates, not measurements. The worst case is
what's enforced. With $15 total credit: run configs **one at a time**, download
the adapter before starting the next run — two back-to-back worst-case runs
($19.80) would exceed the credit.

## 4. Get code + data onto the pod

The pod needs `training/finetune/` (this kit) and `training/data/{train,val}.jsonl`
(schema: `{"messages":[{"role":"system"|"user"|"assistant","content":"..."}]}` per line).

Option A — `runpodctl` (no SSH setup; sender runs `send`, receiver runs `receive`
with the printed code — [docs.runpod.io/runpodctl/reference/runpodctl-send](https://docs.runpod.io/runpodctl/reference/runpodctl-send)):

```bash
# local machine (runpodctl: https://www.runpod.io/console/apps or brew install runpodctl)
cd <repo root>
tar czf /tmp/ft-kit.tgz training/finetune training/data
runpodctl send /tmp/ft-kit.tgz
#   -> prints a code, e.g. 8338-galaxy-fibers-twelve

# pod web terminal
cd /workspace
runpodctl receive 8338-galaxy-fibers-twelve
tar xzf ft-kit.tgz
```

Option B — `scp` (pod "Connect" dialog shows the public IP/port):

```bash
scp -P <pod_port> /tmp/ft-kit.tgz root@<pod_ip>:/workspace/
# pod: cd /workspace && tar xzf ft-kit.tgz
```

Option C — if the repo is git-reachable from the pod: `git clone <url>` and check
out the branch; the data pipeline writes `training/data/*.jsonl` separately.

## 5. Train

```bash
cd /workspace            # repo root: training/ must be directly below CWD
python -c "import torch; print(torch.cuda.is_available())"   # sanity: True

tmux new -s train        # survive SSH drops
python training/finetune/train.py training/finetune/config-gemma4-12b.yaml
# or: python training/finetune/train.py training/finetune/config-qwen35-9b.yaml
```

Exit codes: `0` done · `3` wall-clock cap hit (adapter saved) · `4` OOM (adapter
save attempted) · `5` budget refusal (nothing ran) · `130` Ctrl-C (adapter saved).
Final train/eval loss and estimated cost print at the end; per-epoch eval loss
prints during the run (eval on `val.jsonl` every epoch).

## 6. Download the adapter

Adapter lands in `outputs/gemma4-12b-lora/` (or `outputs/qwen35-9b-lora/`):
`adapter_model.safetensors` + `adapter_config.json` + tokenizer files (a few
hundred MB at r=16).

```bash
# pod: send the whole folder (runpodctl supports folders)
cd /workspace && runpodctl send outputs/gemma4-12b-lora
# local: runpodctl receive <code>

# or scp:  scp -r -P <pod_port> root@<pod_ip>:/workspace/outputs/gemma4-12b-lora .
```

**Then terminate the pod** (console → Stop/Terminate). Idling pods keep billing.

## 7. Post-training: host the adapter

1. **Upload to a private HF repo** (from anywhere with the adapter folder):

   ```bash
   pip install -U "huggingface_hub>=1.5.0,<2.0"
   huggingface-cli login            # token with write access
   huggingface-cli repo create gemma4-12b-lesson-lora --private
   huggingface-cli upload gemma4-12b-lesson-lora outputs/gemma4-12b-lora .
   ```

2. **Together AI pointer:** Together supports uploading your own LoRA adapter and
   deploying it — current docs (updated 2026-08-03):
   [docs.together.ai/docs/dedicated-endpoints/adapter](https://docs.together.ai/docs/dedicated-endpoints/adapter)
   ("Run inference on your own LoRA adapters by uploading them to Together AI and
   deploying them for dedicated model inference"). Note: that page is for
   **dedicated** endpoints; Together's *serverless* multi-LoRA applies to adapters
   trained via Together's own fine-tuning API
   ([together.ai blog, 2024-12-18](https://www.together.ai/blog/serverless-multi-lora-fine-tune-and-deploy-hundreds-of-adapters-for-model-customization-at-scale)).
   Whether Together's adapter hosting currently accepts gemma-4 / qwen3.5 base
   models is **UNVERIFIED** — check their supported-base-model list before paying.

3. **Modal fallback pointer:** serve the adapter yourself with vLLM on Modal —
   [modal.com/docs/examples/vllm_inference](https://modal.com/docs/examples/vllm_inference)
   (OpenAI-compatible vLLM server example) + vLLM's `--lora-modules name=path`
   flag for adapters. Works with any base model vLLM supports; gemma-4 and
   qwen3.5 support exists in current vLLM per each model card's serving section.

## 8. Local pre-flight (no GPU needed)

`python3 training/finetune/smoke_test.py` — validates both configs, the JSONL
schema, the budget guard, and the step planner on a bare CPU machine (stdlib +
pyyaml only). Run this before spending anything.

---

## 9. FIELD-VERIFIED PINS (v0 run, 2026-08-14, L40S)

The §2 install order hit three real conflicts on the run. Working combination:

```bash
pip install unsloth==2026.8.16
pip install --no-deps transformers==5.10.1 "tokenizers>=0.22.0,<=0.23.0"
pip install "huggingface_hub>=1.5.0,<2.0" "peft>=0.18.0" "accelerate>=0.34.1" \
    "datasets==4.3.0" "bitsandbytes>=0.45.5,!=0.46.0,!=0.48.0" \
    "xformers==0.0.32.post2" sentencepiece protobuf
pip install --no-deps --upgrade timm
pip install --no-deps torchao==0.14.1 trl==0.23.1        # NOT trl 0.22.2 (breaks vs tf 5.10.1); NOT default torchao (needs torch 2.9)
pip install --no-deps --force-reinstall --index-url https://download.pytorch.org/whl/cu128 torchvision==0.23.0
# do NOT install torchcodec (needs torch 2.9; text-only training doesn't use it)
```

Notes: transformers 5.9.x does not exist on PyPI; 5.5.x lacks Gemma 4. trl>=0.23
renamed SFTTrainer's `tokenizer=` to `processing_class=` (train.py updated).
Pod SSH: pass `--env PUBLIC_KEY="$(cat ~/.runpod/ssh/runpodctl-ssh-key.pub)"` at
`runpodctl create pod` — account-level key injection alone did not start sshd.
v0 actuals: 400 steps, 43 min wall, train loss 1.01 / eval 0.686, total ≈ $2.9
including all retries. Bake-off v0: KEEP BASELINE (37–42% win rate, 6 format
losses, all vocabSet-heavy — expected from the sentence-pair-skewed v0 dataset).
