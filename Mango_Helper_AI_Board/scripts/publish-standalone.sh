#!/usr/bin/env bash
# 망고보드 → 독립 GitHub 저장소 publish (bash)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_URL="https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git"
TMP="${TMPDIR:-/tmp}/Mango_Helper_AI_Board_publish"

echo "망고보드 독립 저장소 publish"
echo "대상: $REPO_URL"

rm -rf "$TMP"
mkdir -p "$TMP"
rsync -a --exclude='.git' --exclude='__pycache__' --exclude='.chrome-profile' \
  --exclude='output' --exclude='run-logs' --exclude='*.pyc' \
  "$ROOT/" "$TMP/"

cd "$TMP"
git init -b main
git add -A
git commit -m "feat: Mango_Helper_AI_Board 망고보드 독립 저장소 publish"

if ! git remote get-url origin &>/dev/null; then
  git remote add origin "$REPO_URL"
fi

echo "push 시도..."
if git push -u origin main; then
  echo "[OK] publish 완료: $REPO_URL"
else
  echo "[안내] push 실패"
  echo "  1) https://github.com/new → Repository name: Mango_Helper_AI_Board (README 없이 생성)"
  echo "  2) 다시: bash scripts/publish-standalone.sh"
  exit 1
fi
