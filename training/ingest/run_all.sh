#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${1:-/Users/tomas/apps/simmonds-teaching-import/}"
OUT_DIR="${2:-${SCRIPT_DIR}/output}"
PYTHON_BIN="${PYTHON_BIN:-python3.12}"

mkdir -p "${OUT_DIR}"

echo "[1/4] Extracting local source documents"
"${PYTHON_BIN}" "${SCRIPT_DIR}/extract.py" --source "${SOURCE_DIR}" --out-dir "${OUT_DIR}"

echo "[2/4] Classifying original extracted documents"
"${PYTHON_BIN}" "${SCRIPT_DIR}/classify.py" --in "${OUT_DIR}/extracted.jsonl" --out-dir "${OUT_DIR}"

echo "[3/4] Anonymizing classified text and display paths"
"${PYTHON_BIN}" "${SCRIPT_DIR}/anonymize.py" --in "${OUT_DIR}/classified.jsonl" --out-dir "${OUT_DIR}"

echo "[4/4] Building content-block and SFT candidates"
"${PYTHON_BIN}" "${SCRIPT_DIR}/to_training.py" --in "${OUT_DIR}/anonymized.jsonl" --out-dir "${OUT_DIR}"

echo "Pipeline complete: ${OUT_DIR}"
