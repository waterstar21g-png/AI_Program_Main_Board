"""self_update 버전 파싱 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from self_update import parse_version, root_dir  # noqa: E402


def test_parse_version_korean():
    assert parse_version("버전 2.0.87 (Python B안)\n업데이트: x") == "2.0.87"


def test_parse_version_plain():
    assert parse_version("version 1.2.3") == "1.2.3"
    assert parse_version("no version here") == ""


def test_force_update_scripts_exist():
    root = root_dir()
    assert (root / "force-update-main.ps1").is_file()
    assert (root / "update-and-restart.ps1").is_file()
    assert (root / "update-version.bat").is_file()


if __name__ == "__main__":
    test_parse_version_korean()
    test_parse_version_plain()
    test_force_update_scripts_exist()
    print("PASS test_self_update")
