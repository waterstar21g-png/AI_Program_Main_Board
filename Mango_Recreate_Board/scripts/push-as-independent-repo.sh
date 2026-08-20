#!/usr/bin/env bash
# Push Mango_Recreate_Board/ as a brand-new independent GitHub repo.
# Usage (after empty repo exists on GitHub):
#   bash scripts/push-as-independent-repo.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/Mango_Recreate_Board_push_$$"
REMOTE_URL="${REMOTE_URL:-https://github.com/waterstar21g-png/Mango_Recreate_Board.git}"

echo "[INFO] source=$ROOT"
echo "[INFO] remote=$REMOTE_URL"
rm -rf "$TMP"
mkdir -p "$TMP"
# copy without nested .git
rsync -a --exclude '.git' --exclude '__pycache__' --exclude '*.pyc' "$ROOT/" "$TMP/"
cd "$TMP"
git init
git add .
git -c user.email="waterstar21g@gmail.com" -c user.name="택주 정" commit -m "chore: Mango_Recreate_Board v1.0.0 UI shell"
git branch -M main
git remote add origin "$REMOTE_URL"
git push -u origin main
echo "[OK] pushed to $REMOTE_URL"
