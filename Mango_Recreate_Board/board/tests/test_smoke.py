"""Mango_Recreate_Board — 버전·REPO 스모크."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "board"))

from self_update import REPO, local_version, parse_version  # noqa: E402


def test_repo_name() -> None:
    assert REPO == "waterstar21g-png/Mango_Recreate_Board"


def test_version_file() -> None:
    text = (ROOT / "VERSION.txt").read_text(encoding="utf-8")
    assert parse_version(text) == "1.0.0"
    assert local_version(ROOT) == "1.0.0"


def test_app_title_constant() -> None:
    src = (ROOT / "board" / "app.py").read_text(encoding="utf-8")
    assert 'APP_TITLE = "Mango_Recreate_Board"' in src
    assert "P1" not in src or "추가 예정" in src
    # 메인 셸만 — 기존 프로그램 버튼 문구 없음
    assert "카테고리 URL 추출" not in src
    assert "더망고 대량수집" not in src


def test_parse_version_variants() -> None:
    assert parse_version("버전 1.2.3") == "1.2.3"
    assert parse_version("version 9.0.1") == "9.0.1"
    assert re.search(r"1\.0\.0", "버전 1.0.0 (Python B안)")
