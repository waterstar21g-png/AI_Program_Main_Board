"""망고보드 바탕화면 아이콘 생성 테스트."""

from __future__ import annotations

import base64
import sys
from pathlib import Path

BOARD_DIR = Path(__file__).resolve().parents[1]
ROOT = BOARD_DIR.parent
sys.path.insert(0, str(BOARD_DIR))
sys.path.insert(0, str(ROOT / "scripts"))

import desktop_icon  # noqa: E402
import launch  # noqa: E402


def _fake_desktops(tmp_path: Path) -> dict[str, str]:
    home = tmp_path / "user"
    (home / "Desktop").mkdir(parents=True)
    (home / "OneDrive" / "바탕 화면").mkdir(parents=True)
    return {"USERPROFILE": str(home), "OneDrive": str(home / "OneDrive")}


def test_desktop_dirs_collects_existing_only(tmp_path):
    env = _fake_desktops(tmp_path)
    dirs = desktop_icon.desktop_dirs(env)
    names = [d.name for d in dirs]
    assert "Desktop" in names
    assert "바탕 화면" in names
    assert len(dirs) == len(set(dirs))  # 중복 없음
    assert all(d.is_dir() for d in dirs)


def test_desktop_dirs_empty_env_is_safe():
    assert desktop_icon.desktop_dirs({}) == []


def test_shortcut_paths_include_desktops_and_project_folder(tmp_path):
    env = _fake_desktops(tmp_path)
    paths = desktop_icon.shortcut_paths(ROOT, env)
    assert all(p.name == "망고보드.lnk" for p in paths)
    assert paths[-1] == ROOT / "망고보드.lnk"  # 드래그용 사본
    assert len(paths) == len(desktop_icon.desktop_dirs(env)) + 1


def test_build_powershell_points_at_run_bat(tmp_path):
    targets = [tmp_path / "a" / "망고보드.lnk", tmp_path / "b" / "망고보드.lnk"]
    script = desktop_icon.build_powershell(ROOT, targets)
    assert str(ROOT / "run.bat") in script
    assert script.count("CreateShortcut") == len(targets)
    assert script.count("$sc.Save()") == len(targets)
    assert "imageres.dll,171" in script
    assert "shell32.dll,44" in script  # 폴백
    for t in targets:
        assert str(t) in script


def test_build_powershell_escapes_single_quote(tmp_path):
    odd = tmp_path / "it's" / "망고보드.lnk"
    script = desktop_icon.build_powershell(ROOT, [odd])
    assert "it''s" in script


def test_powershell_command_is_utf16_encoded(tmp_path):
    script = desktop_icon.build_powershell(ROOT, [tmp_path / "망고보드.lnk"])
    cmd = desktop_icon.powershell_command(script)
    assert cmd[0] == "powershell"
    assert "-EncodedCommand" in cmd
    decoded = base64.b64decode(cmd[-1]).decode("utf-16-le")
    assert decoded == script


def test_create_without_run_bat_reports_folder(tmp_path):
    result = desktop_icon.create(tmp_path)
    assert result["ok"] is False
    assert "run.bat" in result["message"]
    assert result["created"] == []


def test_create_on_non_windows_is_reported_not_raised(monkeypatch, tmp_path):
    (tmp_path / "run.bat").write_text("@echo off\n", encoding="utf-8")
    monkeypatch.setattr(desktop_icon, "is_windows", lambda: False)
    result = desktop_icon.create(tmp_path)
    assert result["ok"] is False
    assert "Windows" in result["message"]


def test_icon_module_uses_own_root_only():
    assert desktop_icon.board_root() == ROOT
    assert (desktop_icon.board_root() / "board" / "desktop_icon.py").is_file()


def test_launch_build_command_by_suffix(tmp_path):
    assert launch.build_command(tmp_path / "a.py", ["x"])[0] == sys.executable
    assert launch.build_command(tmp_path / "a.ps1", [])[0] == "powershell"
    assert "-File" in launch.build_command(tmp_path / "a.ps1", [])
    assert launch.build_command(tmp_path / "a.bat", [])[:2] == ["cmd", "/c"]


def test_installers_delegate_icon_creation():
    """바로가기 생성 구현이 갈라지지 않도록 — 설치 스크립트는 desktop_icon.py 만 호출."""
    for name in ("scripts/install-all.ps1", "scripts/setup-pc.ps1"):
        text = (ROOT / name).read_text(encoding="utf-8")
        assert "desktop_icon.py" in text, f"{name} 이 아이콘 생성을 위임하지 않음"
        assert "CreateShortcut" not in text, f"{name} 에 별도 바로가기 생성 구현 남음"


def test_registry_has_desktop_icon_entry():
    data = launch.load_registry()
    entry = next(p for p in data["programs"] if p["id"] == "desktop_icon")
    assert (ROOT / entry["script"]).is_file()
    assert (ROOT / entry["launcher"]).is_file()
