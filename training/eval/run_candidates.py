"""Call each candidate endpoint for every eval task and store raw + parsed
results per candidate.

Candidates are described on the CLI as:
    --candidate name=A,base_url=https://...,model=some/model,key_env=SOME_KEY_ENV

The API key itself is never passed on the CLI: it is read at call time from
the environment variable named by key_env. This avoids keys landing in shell
history or process listings.

Endpoints must be OpenAI-compatible chat completions
(POST {base_url}/chat/completions with {model, messages, temperature}).
Temperature is fixed at 0.2 for every candidate and every retry, so no
candidate gets an accidental sampling advantage.

Each task is attempted once; if the response body does not parse as JSON
with the required keys (title, topic, body), exactly one retry is made
(same temperature). If the retry also fails to parse, it is recorded as a
parse failure (an automatic loss downstream in judge_pairwise.py) rather
than silently dropped or skipped.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

TEMPERATURE = 0.2
REQUIRED_KEYS = ("title", "topic", "body")


@dataclass
class Candidate:
    name: str
    base_url: str
    model: str
    key_env: str


def parse_candidate_arg(raw: str) -> Candidate:
    """Parse `name=A,base_url=...,model=...,key_env=ENVVAR` into a Candidate."""
    fields: dict[str, str] = {}
    for part in raw.split(","):
        if "=" not in part:
            raise ValueError(f"invalid --candidate segment (expected key=value): {part!r}")
        key, _, value = part.partition("=")
        fields[key.strip()] = value.strip()
    missing = [k for k in ("name", "base_url", "model", "key_env") if k not in fields]
    if missing:
        raise ValueError(f"--candidate missing required fields: {missing} in {raw!r}")
    return Candidate(
        name=fields["name"],
        base_url=fields["base_url"].rstrip("/"),
        model=fields["model"],
        key_env=fields["key_env"],
    )


def _extract_content_from_response(response_json: dict) -> str:
    """Pull the assistant message text out of an OpenAI-style chat completion."""
    choices = response_json.get("choices") or []
    if not choices:
        raise ValueError("no choices in response")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("no string content in first choice message")
    return content


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


def parse_block_json(raw_text: str) -> dict:
    """Parse a candidate's raw text into a block dict with title/topic/body.

    Accepts either a single JSON object {"title":..., "topic":..., "body":...}
    (the shape requested by the eval prompt) or a single-element JSON array
    containing that object (the production block-generation endpoint returns
    an array of {{count}} objects; when count=1 some models still emit the
    array wrapper out of habit). The array form is unwrapped before
    validation. Raises ValueError if the required keys are not all present
    after unwrapping.
    """
    text = _strip_code_fence(raw_text)
    parsed = json.loads(text)  # raises json.JSONDecodeError (subclass of ValueError) on failure
    if isinstance(parsed, list):
        if len(parsed) != 1:
            raise ValueError(f"expected single-element array, got {len(parsed)} elements")
        parsed = parsed[0]
    if not isinstance(parsed, dict):
        raise ValueError(f"expected a JSON object, got {type(parsed).__name__}")
    missing = [k for k in REQUIRED_KEYS if k not in parsed]
    if missing:
        raise ValueError(f"missing required keys: {missing}")
    return parsed


def call_candidate(candidate: Candidate, user_prompt: str, *, timeout: int = 60) -> dict:
    """POST one chat-completion request to the candidate's endpoint.

    Returns a dict with keys: ok (bool), content (str, raw model text) or
    error (str) on transport failure.
    """
    api_key = os.environ.get(candidate.key_env)
    if not api_key:
        return {"ok": False, "error": f"env var {candidate.key_env} is not set"}

    payload = {
        "model": candidate.model,
        "messages": [{"role": "user", "content": user_prompt}],
        "temperature": TEMPERATURE,
    }
    req = urllib.request.Request(
        url=f"{candidate.base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = _extract_content_from_response(body)
        return {"ok": True, "content": content}
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        return {"ok": False, "error": f"transport error: {exc}"}
    except (ValueError, json.JSONDecodeError) as exc:
        return {"ok": False, "error": f"malformed response envelope: {exc}"}


def run_task_for_candidate(candidate: Candidate, task: dict) -> dict:
    """Run one task against one candidate, with exactly one retry on parse
    failure. Returns a result record (never raises)."""
    attempts: list[dict] = []

    for attempt_num in (1, 2):
        call_result = call_candidate(candidate, task["userPrompt"])
        attempt_record: dict = {"attempt": attempt_num, "call": call_result}
        if not call_result["ok"]:
            attempt_record["parsed"] = None
            attempt_record["parse_error"] = call_result.get("error", "transport failure")
            attempts.append(attempt_record)
            if attempt_num == 1:
                continue
            break

        raw_content = call_result["content"]
        try:
            parsed = parse_block_json(raw_content)
            attempt_record["parsed"] = parsed
            attempt_record["parse_error"] = None
            attempts.append(attempt_record)
            break  # success, no retry needed
        except (ValueError, json.JSONDecodeError) as exc:
            attempt_record["parsed"] = None
            attempt_record["parse_error"] = str(exc)
            attempts.append(attempt_record)
            if attempt_num == 1:
                continue
            break  # second failure recorded, no further retry

    final = attempts[-1]
    parse_failed = final["parsed"] is None

    # Distinguish WHY the final attempt has no parsed output, because
    # downstream (judge_pairwise.py) treats these very differently:
    #   - "transport": we never received a usable response from the model
    #     (network/HTTP/timeout/malformed envelope) -- this is an
    #     infrastructure failure, not evidence the candidate produced bad
    #     output, and must NOT be scored as a format-validity loss or a
    #     content auto-loss to the other candidate.
    #   - "format": the HTTP call succeeded but the model's own text did not
    #     parse as a valid block -- this IS a genuine format-validity
    #     failure and is what the one-sided adoption veto is meant to catch.
    #   - None: parsed successfully.
    if not parse_failed:
        failure_kind = None
    elif not final["call"]["ok"]:
        failure_kind = "transport"
    else:
        failure_kind = "format"

    return {
        "task_id": task["id"],
        "candidate": candidate.name,
        "model": candidate.model,
        "attempts": len(attempts),
        "parse_failed": parse_failed,
        "failure_kind": failure_kind,
        "final_error": final.get("parse_error"),
        "output": final["parsed"],
        "raw_content": final["call"].get("content") if final["call"]["ok"] else None,
    }


def run_all(candidates: list[Candidate], tasks: list[dict]) -> dict[str, list[dict]]:
    results: dict[str, list[dict]] = {c.name: [] for c in candidates}
    for candidate in candidates:
        for task in tasks:
            results[candidate.name].append(run_task_for_candidate(candidate, task))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evalset", required=True, help="path to evalset.json")
    parser.add_argument("--out", required=True, help="output directory for per-candidate results")
    parser.add_argument(
        "--candidate",
        action="append",
        required=True,
        dest="candidates",
        help="name=NAME,base_url=URL,model=MODEL,key_env=ENVVAR (repeatable, 2+ required)",
    )
    args = parser.parse_args()

    if len(args.candidates) < 2:
        raise SystemExit("at least 2 --candidate entries are required for a bake-off")

    candidates = [parse_candidate_arg(raw) for raw in args.candidates]
    names = [c.name for c in candidates]
    if len(set(names)) != len(names):
        raise SystemExit(f"duplicate candidate names: {names}")

    tasks = json.loads(Path(args.evalset).read_text(encoding="utf-8"))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = run_all(candidates, tasks)
    for name, records in results.items():
        out_path = out_dir / f"{name}.json"
        out_path.write_text(
            json.dumps(records, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        n_failed = sum(1 for r in records if r["parse_failed"])
        print(f"{name}: {len(records)} tasks, {n_failed} parse failures -> {out_path}")


if __name__ == "__main__":
    main()
