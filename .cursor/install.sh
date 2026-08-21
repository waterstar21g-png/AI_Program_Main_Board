#!/usr/bin/env bash
# Cloud Agent install for AI_Program_Main_Board (Python B안 보드).
# Idempotent: safe to run repeatedly and against cached/snapshot state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Prefer sudo when available and needed for system packages.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
fi

# 1) System packages: Tkinter (board GUI) + venv support.
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -qq
$SUDO apt-get install -y --no-install-recommends python3-tk python3-venv

# 2) Python virtual environment (created once, reused thereafter).
if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi
VENV_PY=".venv/bin/python"

# 3) Python dependencies (pinned via requirements.txt) + test runner.
"$VENV_PY" -m pip install --upgrade pip
"$VENV_PY" -m pip install -r requirements.txt pytest

# 4) Playwright browser + its OS libraries (P2 collector / tests use Chromium).
$SUDO "$VENV_PY" -m playwright install-deps chromium
"$VENV_PY" -m playwright install chromium

echo "[install] AI_Program_Main_Board environment ready."
