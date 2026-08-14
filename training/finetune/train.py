#!/usr/bin/env python3
"""Config-driven LoRA fine-tuning for the English-school lesson model (RunPod + Unsloth).

Usage:
    python training/finetune/train.py training/finetune/config-gemma4-12b.yaml
    python training/finetune/train.py training/finetune/config-qwen35-9b.yaml

DESIGN CONSTRAINT (hard requirement): the MODULE TOP LEVEL of this file imports
ONLY the Python standard library plus `yaml` (pyyaml). Every heavy ML import
(unsloth / torch / trl / transformers / datasets / peft) is deferred INSIDE
`train()`, so `import train` succeeds on a bare CPU-only machine with just
pyyaml installed. smoke_test.py depends on this.

Training data: chat-format JSONL, one JSON object per line:
    {"messages":[{"role":"system"|"user"|"assistant","content":"..."}]}

Live sources verified 2026-08-14 (see RUNBOOK.md for the full citation list):
  * Model ids exist on HF: google/gemma-4-12B-it (mirror unsloth/gemma-4-12b-it),
    Qwen/Qwen3.5-9B (mirror unsloth/Qwen3.5-9B).
  * Unsloth Qwen3.5 guide: "It is not recommended to do QLoRA (4-bit) training on
    the Qwen3.5 models ... due to higher than normal quantization differences" and
    "Qwen3.5 bf16 LoRA VRAM use: ... 9B: 22GB" and "Please use transformers v5".
    https://unsloth.ai/docs/models/qwen3.5/fine-tune
  * Unsloth Gemma 4 guide: chat_template = "gemma-4" (non-thinking) via
    get_chat_template(). https://unsloth.ai/docs/models/gemma-4/train
  * train_on_responses_only(trainer, instruction_part=..., response_part=...):
    unsloth_zoo/dataset_utils.py (explicit markers allowed; auto-detect exists but
    we pass the live-verified markers from the config instead).
  * Code pattern follows the official notebook Gemma4_(12B)_Text.ipynb
    (github.com/unslothai/notebooks, nb/): FastModel.from_pretrained ->
    FastModel.get_peft_model -> get_chat_template -> apply_chat_template into a
    "text" field -> SFTTrainer -> train_on_responses_only -> save_pretrained.
"""

import json
import math
import os
import sys
import time

import yaml  # pyyaml — the ONLY third-party import allowed at module top level

# ---------------------------------------------------------------------------
# Config loading / validation (pure stdlib+yaml — exercised by smoke_test.py)
# ---------------------------------------------------------------------------

ALLOWED_FAMILIES = ("gemma4", "qwen35")
ALLOWED_ROLES = ("system", "user", "assistant")

_REQUIRED = {
    "model_name": str,
    "model_family": str,
    "max_seq_length": int,
    "load_in_4bit": bool,
    "lora": dict,
    "training": dict,
    "data": dict,
    "chat": dict,
    "budget": dict,
    "output": dict,
}
_REQUIRED_LORA = {"r": int, "lora_alpha": int, "lora_dropout": (int, float)}
_REQUIRED_TRAINING = {
    "num_train_epochs": (int, float),
    "max_steps": int,
    "per_device_train_batch_size": int,
    "gradient_accumulation_steps": int,
    "learning_rate": (int, float),
    "lr_scheduler_type": str,
    "warmup_steps": int,
    "weight_decay": (int, float),
    "optim": str,
    "logging_steps": int,
    "seed": int,
}
_REQUIRED_DATA = {"train_path": str, "val_path": str}
_REQUIRED_CHAT = {"instruction_part": str, "response_part": str}  # template_name optional (str|null)
_REQUIRED_BUDGET = {"max_hours": (int, float), "gpu_usd_per_hour": (int, float), "budget_usd": (int, float)}
_REQUIRED_OUTPUT = {"output_dir": str, "save_merged_16bit": bool}


class ConfigError(ValueError):
    """Raised when a config file is missing keys or has invalid values."""


class BudgetError(RuntimeError):
    """Raised when max_hours * gpu_usd_per_hour would exceed budget_usd."""


def load_config(path):
    """Load a YAML config file into a dict. Pure stdlib+yaml."""
    with open(path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if not isinstance(cfg, dict):
        raise ConfigError(f"{path}: top level must be a mapping, got {type(cfg).__name__}")
    return cfg


def _check_section(cfg, section, required, path):
    if section not in cfg:
        raise ConfigError(f"{path}: missing required section '{section}'")
    val = cfg[section]
    if not isinstance(val, dict):
        raise ConfigError(f"{path}: '{section}' must be a mapping")
    for key, types in required.items():
        if key not in val:
            raise ConfigError(f"{path}: missing required key '{section}.{key}'")
        if not isinstance(val[key], types) or isinstance(val[key], bool) and bool not in (
            types if isinstance(types, tuple) else (types,)
        ):
            raise ConfigError(
                f"{path}: '{section}.{key}' must be of type {types}, got {type(val[key]).__name__}"
            )


def validate_config(cfg, path="<config>"):
    """Validate structure and value ranges of a loaded config. Raises ConfigError."""
    for key, typ in _REQUIRED.items():
        if key not in cfg:
            raise ConfigError(f"{path}: missing required key '{key}'")
        if not isinstance(cfg[key], typ):
            raise ConfigError(f"{path}: '{key}' must be {typ.__name__}, got {type(cfg[key]).__name__}")

    if cfg["model_family"] not in ALLOWED_FAMILIES:
        raise ConfigError(f"{path}: model_family must be one of {ALLOWED_FAMILIES}")
    if not cfg["model_name"].strip():
        raise ConfigError(f"{path}: model_name must be non-empty")
    if cfg["max_seq_length"] < 128:
        raise ConfigError(f"{path}: max_seq_length looks too small ({cfg['max_seq_length']})")

    _check_section(cfg, "lora", _REQUIRED_LORA, path)
    if not (1 <= cfg["lora"]["r"] <= 256):
        raise ConfigError(f"{path}: lora.r out of sane range")

    _check_section(cfg, "training", _REQUIRED_TRAINING, path)
    t = cfg["training"]
    if t["num_train_epochs"] <= 0:
        raise ConfigError(f"{path}: training.num_train_epochs must be > 0")
    if t["max_steps"] <= 0:
        raise ConfigError(f"{path}: training.max_steps must be > 0 (hard step ceiling)")
    if t["per_device_train_batch_size"] < 1 or t["gradient_accumulation_steps"] < 1:
        raise ConfigError(f"{path}: batch size / grad accumulation must be >= 1")
    if not (0 < t["learning_rate"] < 1):
        raise ConfigError(f"{path}: training.learning_rate out of sane range")

    _check_section(cfg, "data", _REQUIRED_DATA, path)
    _check_section(cfg, "chat", _REQUIRED_CHAT, path)
    if not cfg["chat"]["instruction_part"] or not cfg["chat"]["response_part"]:
        raise ConfigError(f"{path}: chat markers must be non-empty strings")
    tmpl = cfg["chat"].get("template_name")
    if tmpl is not None and not isinstance(tmpl, str):
        raise ConfigError(f"{path}: chat.template_name must be a string or null")

    _check_section(cfg, "budget", _REQUIRED_BUDGET, path)
    b = cfg["budget"]
    if b["max_hours"] <= 0 or b["gpu_usd_per_hour"] <= 0 or b["budget_usd"] <= 0:
        raise ConfigError(f"{path}: budget values must all be > 0")

    _check_section(cfg, "output", _REQUIRED_OUTPUT, path)
    return cfg


def compute_worst_case_cost(cfg):
    """Worst-case run cost in USD: max_hours * gpu_usd_per_hour."""
    b = cfg["budget"]
    return float(b["max_hours"]) * float(b["gpu_usd_per_hour"])


def check_budget(cfg):
    """Hard, code-enforced budget guard: refuse to start if the wall-clock cap
    could cost more than budget_usd. This runs BEFORE any GPU work starts."""
    worst = compute_worst_case_cost(cfg)
    budget = float(cfg["budget"]["budget_usd"])
    if worst > budget + 1e-9:
        raise BudgetError(
            f"Refusing to start: max_hours ({cfg['budget']['max_hours']}) x "
            f"gpu_usd_per_hour (${cfg['budget']['gpu_usd_per_hour']}) = ${worst:.2f} "
            f"exceeds budget_usd (${budget:.2f}). Lower max_hours in the config."
        )
    return worst


def compute_total_steps(num_examples, per_device_batch, grad_accum, num_epochs, max_steps):
    """Steps the run will actually execute: the SMALLER of the epoch plan and the
    max_steps ceiling (both caps enforced, per spec). Returns a detail dict."""
    eff_batch = per_device_batch * grad_accum
    steps_per_epoch = max(1, math.ceil(num_examples / eff_batch))
    epoch_steps = math.ceil(steps_per_epoch * num_epochs)
    total = min(int(max_steps), int(epoch_steps))
    return {
        "effective_batch": eff_batch,
        "steps_per_epoch": steps_per_epoch,
        "epoch_plan_steps": epoch_steps,
        "max_steps_ceiling": int(max_steps),
        "total_steps": total,
        "capped_by": "max_steps" if total < epoch_steps else "epochs",
    }


def validate_messages(obj):
    """Validate one parsed JSONL line against the documented schema:
    {"messages":[{"role":"system"|"user"|"assistant","content":"..."}]}
    Returns (ok, error_message)."""
    if not isinstance(obj, dict):
        return False, "line is not a JSON object"
    msgs = obj.get("messages")
    if not isinstance(msgs, list) or not msgs:
        return False, "'messages' must be a non-empty list"
    has_assistant = False
    for i, m in enumerate(msgs):
        if not isinstance(m, dict):
            return False, f"messages[{i}] is not an object"
        role, content = m.get("role"), m.get("content")
        if role not in ALLOWED_ROLES:
            return False, f"messages[{i}].role must be one of {ALLOWED_ROLES}, got {role!r}"
        if not isinstance(content, str) or not content.strip():
            return False, f"messages[{i}].content must be a non-empty string"
        if role == "assistant":
            has_assistant = True
    if not has_assistant:
        return False, "no assistant turn present — nothing to train on"
    return True, ""


def load_jsonl(path):
    """Load and schema-validate a chat JSONL file. Returns list[dict].
    Raises ValueError on the first invalid line (fail fast on bad data)."""
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{lineno}: invalid JSON: {e}") from e
            ok, err = validate_messages(obj)
            if not ok:
                raise ValueError(f"{path}:{lineno}: schema error: {err}")
            records.append(obj)
    if not records:
        raise ValueError(f"{path}: no usable examples found")
    return records


def resolve_data_path(path):
    """Config data paths are written relative to the repo root (e.g.
    training/data/train.jsonl). Resolve against CWD first, then against the repo
    root (this file's parent's parent)."""
    if os.path.isabs(path) or os.path.exists(path):
        return path
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidate = os.path.join(repo_root, path)
    return candidate if os.path.exists(candidate) else path  # fall back: let open() raise a clear error


class WallClockAbort(Exception):
    """Raised by the wall-clock callback when max_hours is exceeded mid-run."""


# ---------------------------------------------------------------------------
# Training (heavy imports deferred inside this function — see module docstring)
# ---------------------------------------------------------------------------

def train(cfg):
    """Run the fine-tune. All unsloth/torch/trl/transformers/datasets imports
    happen HERE, never at module top level."""
    validate_config(cfg)
    worst = check_budget(cfg)  # belt-and-braces: main() already ran this

    t0 = time.time()
    max_seconds = float(cfg["budget"]["max_hours"]) * 3600.0
    print(f"[budget] worst case = ${worst:.2f} "
          f"({cfg['budget']['max_hours']}h x ${cfg['budget']['gpu_usd_per_hour']}/hr); "
          f"hard wall-clock abort at {max_seconds/3600:.2f}h", flush=True)

    import torch  # noqa: F401
    from datasets import Dataset
    from trl import SFTConfig, SFTTrainer
    from unsloth import FastModel
    from unsloth.chat_templates import get_chat_template, train_on_responses_only

    fam = cfg["model_family"]
    seq_len = int(cfg["max_seq_length"])
    out_dir = cfg["output"]["output_dir"]
    os.makedirs(out_dir, exist_ok=True)

    # --- model ---------------------------------------------------------------
    # Pattern per official nb/Gemma4_(12B)_Text.ipynb: FastModel (alias of
    # FastLanguageModel in current unsloth) handles both archs; vision layers
    # stay frozen for this text-only task.
    model, tokenizer = FastModel.from_pretrained(
        model_name=cfg["model_name"],
        dtype=None,                              # auto-detect
        max_seq_length=seq_len,
        load_in_4bit=bool(cfg["load_in_4bit"]),  # True = QLoRA (gemma), False = bf16 LoRA (qwen)
        full_finetuning=False,
    )
    model = FastModel.get_peft_model(
        model,
        finetune_vision_layers=False,    # text-only task
        finetune_language_layers=True,
        finetune_attention_modules=True,
        finetune_mlp_modules=True,
        r=int(cfg["lora"]["r"]),
        lora_alpha=int(cfg["lora"]["lora_alpha"]),
        lora_dropout=float(cfg["lora"]["lora_dropout"]),
        bias="none",
        random_state=int(cfg["training"]["seed"]),
    )

    # --- chat template ---------------------------------------------------------
    # gemma4: override with unsloth's "gemma-4" (non-thinking) template.
    # qwen35: keep the model's own template (Qwen/Qwen3.5-9B ships one; its
    #         assistant turns render as <|im_start|>assistant\n...).
    template_name = cfg["chat"].get("template_name")
    if template_name:
        tokenizer = get_chat_template(tokenizer, chat_template=template_name)
        print(f"[chat] applied unsloth chat template '{template_name}'", flush=True)
    else:
        print("[chat] using the model's built-in chat template", flush=True)

    # --- data ------------------------------------------------------------------
    train_records = load_jsonl(resolve_data_path(cfg["data"]["train_path"]))
    val_records = load_jsonl(resolve_data_path(cfg["data"]["val_path"]))
    print(f"[data] train={len(train_records)} val={len(val_records)} examples", flush=True)

    def to_text(batch):
        texts = []
        for msgs in batch["messages"]:
            rendered = tokenizer.apply_chat_template(
                msgs, tokenize=False, add_generation_prompt=False
            )
            # Official notebook strips a literal '<bos>' prefix (tokenizer re-adds
            # BOS at tokenize time). No-op for templates that do not emit one.
            texts.append(rendered.removeprefix("<bos>"))
        return {"text": texts}

    train_ds = Dataset.from_list(train_records).map(to_text, batched=True)
    val_ds = Dataset.from_list(val_records).map(to_text, batched=True)

    # --- assistant-only loss masking -------------------------------------------
    # Markers are live-verified per family (see config comments + RUNBOOK):
    #   gemma4: "<|turn>user\n" / "<|turn>model\n"   (unsloth chat_templates.py)
    #   qwen35: "<|im_start|>user\n" / "<|im_start|>assistant\n" (Qwen3.5-9B template)
    # Wrong markers silently train on the whole sequence, so VERIFY they occur in
    # the rendered text first; if not, fall back to full-sequence loss, loudly.
    instruction_part = cfg["chat"]["instruction_part"]
    response_part = cfg["chat"]["response_part"]
    probe = train_ds[0]["text"]
    markers_ok = (instruction_part in probe) and (response_part in probe)
    if markers_ok:
        print(f"[mask] train_on_responses_only with verified markers "
              f"instruction={instruction_part!r} response={response_part!r}", flush=True)
    else:
        print("[mask][WARNING] verified markers NOT found in rendered text — "
              "falling back to FULL-SEQUENCE loss (no masking).", flush=True)

    # --- trainer ---------------------------------------------------------------
    t = cfg["training"]
    steps = compute_total_steps(
        len(train_records),
        int(t["per_device_train_batch_size"]),
        int(t["gradient_accumulation_steps"]),
        float(t["num_train_epochs"]),
        int(t["max_steps"]),
    )
    print(f"[plan] {steps}  (capped by {steps['capped_by']})", flush=True)

    sft_args = SFTConfig(
        output_dir=out_dir,
        dataset_text_field="text",
        max_length=seq_len,
        per_device_train_batch_size=int(t["per_device_train_batch_size"]),
        per_device_eval_batch_size=int(t["per_device_train_batch_size"]),
        gradient_accumulation_steps=int(t["gradient_accumulation_steps"]),
        warmup_steps=int(t["warmup_steps"]),
        max_steps=steps["total_steps"],       # min(epoch plan, config ceiling)
        learning_rate=float(t["learning_rate"]),
        lr_scheduler_type=t["lr_scheduler_type"],
        optim=t["optim"],
        weight_decay=float(t["weight_decay"]),
        logging_steps=int(t["logging_steps"]),
        seed=int(t["seed"]),
        eval_strategy="epoch",                # eval on val.jsonl each epoch
        save_strategy="no",                   # we save the adapter explicitly (end + abort paths)
        report_to="none",
    )
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        args=sft_args,
    )
    if markers_ok:
        trainer = train_on_responses_only(
            trainer,
            instruction_part=instruction_part,
            response_part=response_part,
        )

    # --- wall-clock guard: hard abort, adapter saved before exit ----------------
    from transformers import TrainerCallback

    class _WallClockCallback(TrainerCallback):
        def on_step_end(self, args, state, control, **kwargs):
            elapsed = time.time() - t0
            if elapsed > max_seconds:
                raise WallClockAbort(
                    f"wall-clock budget exceeded: {elapsed/3600:.2f}h > "
                    f"{max_seconds/3600:.2f}h at step {state.global_step}"
                )

    trainer.add_callback(_WallClockCallback())

    def save_adapter(tag):
        path = out_dir if tag == "final" else os.path.join(out_dir, f"adapter-{tag}")
        os.makedirs(path, exist_ok=True)
        model.save_pretrained(path)      # LoRA adapter only (peft format)
        tokenizer.save_pretrained(path)
        print(f"[save] LoRA adapter saved to {path}", flush=True)
        return path

    def maybe_save_merged():
        if cfg["output"]["save_merged_16bit"]:
            mdir = os.path.join(out_dir, "merged_16bit")
            print(f"[save] merging adapter into 16-bit base -> {mdir} (slow) ...", flush=True)
            model.save_pretrained_merged(mdir, tokenizer, save_method="merged_16bit")
            print(f"[save] merged model saved to {mdir}", flush=True)

    # --- run --------------------------------------------------------------------
    final_train_loss = None
    try:
        stats = trainer.train()
        final_train_loss = stats.metrics.get("train_loss")
    except WallClockAbort as e:
        print(f"[abort] {e} — saving adapter before exit.", flush=True)
        save_adapter("wallclock-abort")
        sys.exit(3)
    except KeyboardInterrupt:
        print("[abort] interrupted (SIGINT) — saving adapter before exit.", flush=True)
        save_adapter("interrupted")
        sys.exit(130)
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            print(f"[abort] CUDA OOM: {e} — attempting adapter save before exit.", flush=True)
            try:
                save_adapter("oom-partial")
            except Exception as save_err:  # saving can itself OOM; don't mask the root cause
                print(f"[abort][WARNING] adapter save after OOM failed: {save_err}", flush=True)
            sys.exit(4)
        raise

    # --- final eval + save -------------------------------------------------------
    eval_metrics = trainer.evaluate()
    final_eval_loss = eval_metrics.get("eval_loss")
    save_adapter("final")
    maybe_save_merged()

    elapsed_h = (time.time() - t0) / 3600.0
    est_cost = elapsed_h * float(cfg["budget"]["gpu_usd_per_hour"])
    print("=" * 70, flush=True)
    print(f"[done] final train loss : {final_train_loss}", flush=True)
    print(f"[done] final eval loss  : {final_eval_loss}", flush=True)
    print(f"[done] wall time        : {elapsed_h:.2f}h (cap {max_seconds/3600:.2f}h)", flush=True)
    print(f"[done] estimated cost   : ${est_cost:.2f} (worst-case cap ${worst:.2f})", flush=True)
    print(f"[done] adapter at       : {out_dir}", flush=True)
    print("=" * 70, flush=True)


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        print(f"ERROR: expected exactly one argument (path to config YAML), got {len(argv)-1}")
        return 2
    cfg = load_config(argv[1])
    validate_config(cfg)
    try:
        check_budget(cfg)  # hard stop BEFORE any GPU/torch import happens
    except BudgetError as e:
        print(f"[budget] {e}")
        return 5
    train(cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
