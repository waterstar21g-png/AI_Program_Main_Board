#!/usr/bin/env bash
# Cloud Agent 개발환경 설치 스크립트 (idempotent).
#
# 이 저장소는 Tkinter 데스크톱 보드(board/app.py)와 Playwright 기반
# 크롤러(P1/P1_101/P1_102/P1_ZARA_DE/P2/P3_필터_갱신)로 구성된다.
# 헤드리스 리눅스에서 GUI 를 띄우려면 python3-tk + Xvfb 가, 크롤러에는
# Playwright(Chromium) 가, 한글 UI 렌더링에는 CJK 폰트가 필요하다.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[install] apt 시스템 패키지 설치..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  python3 python3-pip python3-tk python3-venv \
  xvfb x11-utils imagemagick xdotool \
  fonts-nanum fonts-noto-cjk

echo "[install] Python 패키지 설치 (requirements.txt + pytest)..."
python3 -m pip install --break-system-packages --upgrade pip
python3 -m pip install --break-system-packages -r requirements.txt pytest

echo "[install] Playwright Chromium + 브라우저 시스템 의존성 설치..."
python3 -m playwright install --with-deps chromium

echo "[install] 완료."
