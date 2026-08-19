# 비즈보드 — 사이트 정의 스모크
import ast
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sites_js = (ROOT / "js" / "sites.js").read_text(encoding="utf-8")

# BIZ_BOARD_SITES 배열 길이: id: 출현 수로 카운트
ids = re.findall(r'^\s*id:\s*"([^"]+)"', sites_js, flags=re.M)
assert len(ids) >= 20, f"사이트 20개 이상 필요, 현재 {len(ids)}"
assert len(ids) == len(set(ids)), "사이트 id 중복"

for name in ("index.html", "auth.html", "settings.html", "manifest.webmanifest", "sw.js"):
    assert (ROOT / name).is_file(), name

print(f"OK sites={len(ids)}")
sys.exit(0)
