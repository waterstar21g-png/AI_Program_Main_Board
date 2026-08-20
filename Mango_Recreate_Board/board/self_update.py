"""메인보드 좌측 하단 '머지반영 업데이트' — GitHub main 반영 + 재시작."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from pathlib import Path

REPO = "waterstar21g-png/Mango_Recreate_Board"
DEFAULT_BRANCH = "main"


def root_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def parse_version(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"(?:버전|version)\s*([0-9]+(?:\.[0-9]+)+)", text, re.I)
    if m:
        return m.group(1)
    m = re.search(r"([0-9]+\.[0-9]+\.[0-9]+)", text)
    return m.group(1) if m else ""


def local_version(root: Path | None = None) -> str:
    p = (root or root_dir()) / "VERSION.txt"
    try:
        return parse_version(p.read_text(encoding="utf-8"))
    except OSError:
        return ""


def _run(
    args: list[str],
    *,
    cwd: Path,
    timeout: int = 180,
) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            args,
            cwd=str(cwd),
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)
    out = (proc.stdout or b"") + b"\n" + (proc.stderr or b"")
    for enc in ("utf-8", "cp949", "mbcs"):
        try:
            text = out.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = out.decode("utf-8", errors="replace")
    return int(proc.returncode or 0), text.strip()


def remote_version_git(root: Path) -> str:
    code, _ = _run(["git", "fetch", "origin", DEFAULT_BRANCH, "--prune"], cwd=root)
    code2, text = _run(
        ["git", "show", f"origin/{DEFAULT_BRANCH}:VERSION.txt"],
        cwd=root,
    )
    if code2 != 0:
        return ""
    return parse_version(text)


def pull_main(root: Path) -> tuple[bool, str]:
    """origin/main 을 현재 워크트리에 반영. (ok, message)"""
    if not (root / ".git").is_dir():
        return False, ".git 없음 — ZIP/클론 후 다시 시도하세요."

    _run(["git", "fetch", "origin", DEFAULT_BRANCH, "--prune"], cwd=root, timeout=120)
    _run(["git", "checkout", DEFAULT_BRANCH], cwd=root, timeout=60)
    code_p, out_p = _run(
        ["git", "pull", "origin", DEFAULT_BRANCH],
        cwd=root,
        timeout=180,
    )
    if code_p == 0:
        return True, out_p or "git pull OK"

    code_r, out_r = _run(
        ["git", "reset", "--hard", f"origin/{DEFAULT_BRANCH}"],
        cwd=root,
        timeout=120,
    )
    if code_r == 0:
        return True, (out_r or "git reset --hard OK") + "\n(pull 실패 → hard reset)"
    return False, f"git 갱신 실패\npull: {out_p}\nreset: {out_r}"


def update_via_powershell(root: Path) -> tuple[bool, str]:
    """Windows: 기존 update-if-newer.ps1 호출 (ZIP 폴백 포함)."""
    ps1 = root / "update-if-newer.ps1"
    if not ps1.is_file():
        return False, "update-if-newer.ps1 없음"
    code, out = _run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps1),
        ],
        cwd=root,
        timeout=300,
    )
    return code == 0, out or f"exit={code}"


def apply_update(root: Path | None = None) -> dict:
    root = root or root_dir()
    before = local_version(root)
    remote = remote_version_git(root)
    messages: list[str] = []

    method = "git"
    ok = False
    if os.name == "nt":
        ok_ps, msg_ps = update_via_powershell(root)
        messages.append(msg_ps)
        if ok_ps:
            ok = True
            method = "powershell"
        else:
            ok_g, msg_g = pull_main(root)
            messages.append(msg_g)
            ok = ok_g
            method = "git-fallback"
    else:
        ok_g, msg_g = pull_main(root)
        messages.append(msg_g)
        ok = ok_g

    after = local_version(root)
    if not remote:
        remote = after
    return {
        "ok": ok,
        "local_before": before,
        "local_after": after,
        "remote": remote,
        "message": "\n".join(m for m in messages if m).strip(),
        "method": method,
        "changed": bool(before and after and before != after) or (ok and before != after),
    }


def latest_open_pr_url() -> str:
    """가능하면 최신 open PR URL. 실패 시 저장소 PR 목록."""
    root = root_dir()
    code, out = _run(
        [
            "gh",
            "pr",
            "list",
            "--repo",
            REPO,
            "--state",
            "open",
            "--limit",
            "1",
            "--json",
            "url",
            "--jq",
            ".[0].url // empty",
        ],
        cwd=root,
        timeout=30,
    )
    if code == 0 and out.strip().startswith("http"):
        return out.strip().splitlines()[0].strip()
    return f"https://github.com/{REPO}/pulls"


def restart_board(root: Path | None = None) -> None:
    root = root or root_dir()
    app = root / "board" / "app.py"
    args = [sys.executable, str(app)]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    kwargs: dict = {
        "cwd": str(root),
        "env": env,
        "close_fds": True,
    }
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "DETACHED_PROCESS", 0x00000008) | getattr(
            subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200
        )
    subprocess.Popen(args, **kwargs)
    time.sleep(0.8)


def launch_external_updater(root: Path | None = None, *, wait_pid: int | None = None) -> tuple[bool, str]:
    """보드 종료 후 강제 갱신·재시작을 외부 스크립트에 맡긴다."""
    root = root or root_dir()
    pid = int(wait_pid if wait_pid is not None else os.getpid())
    ps1 = root / "update-and-restart.ps1"
    bat = root / "버전갱신.bat"
    bat_en = root / "update-version.bat"

    if os.name == "nt" and ps1.is_file():
        args = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps1),
            "-WaitPid",
            str(pid),
        ]
        try:
            flags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0x00000010)
            subprocess.Popen(args, cwd=str(root), creationflags=flags)
            return True, f"update-and-restart.ps1 WaitPid={pid}"
        except Exception as e:  # noqa: BLE001
            return False, f"updater launch fail: {e}"

    ok, msg = pull_main(root)
    if ok:
        try:
            restart_board(root)
        except Exception as e:  # noqa: BLE001
            return False, f"pull ok but restart fail: {e}\n{msg}"
        return True, msg
    if bat.is_file() or bat_en.is_file():
        return False, f"git 갱신 실패 — 바탕화면 '망고보드_버전갱신' 아이콘을 사용하세요.\n{msg}"
    return False, msg
