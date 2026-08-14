#!/usr/bin/env python3
"""Report whether a Convex snapshot meets the fine-tuning pair gate."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from export_dataset import build_dataset, gate_exit_code, print_gate_message


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Check a Convex export without writing dataset files."
    )
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--min-pairs", type=int, default=500)
    parser.add_argument("--include-seed", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    stats = build_dataset(args.snapshot, include_seed=args.include_seed).stats(
        args.min_pairs
    )
    print(json.dumps(stats, ensure_ascii=False))
    print_gate_message(stats)
    return gate_exit_code(stats)


if __name__ == "__main__":
    raise SystemExit(main())
