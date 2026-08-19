"""비즈 보드 — Playwright로 사전 정의 ID/PW 자동 로그인."""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
SITES_LOCAL = ROOT / "sites.local.json"
SITES_EXAMPLE = ROOT / "sites.example.json"

_KEEPALIVE_LOCK = threading.Lock()
_KEEPALIVE_THREADS: list[threading.Thread] = []


def load_sites() -> list[dict[str, Any]]:
    path = SITES_LOCAL if SITES_LOCAL.is_file() else SITES_EXAMPLE
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("sites JSON must be a list")
    return data


def save_sites(sites: list[dict[str, Any]]) -> Path:
    SITES_LOCAL.write_text(
        json.dumps(sites, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return SITES_LOCAL


def find_site(site_id: str) -> dict[str, Any] | None:
    sid = (site_id or "").strip()
    for row in load_sites():
        if str(row.get("id", "")).strip() == sid:
            return row
    return None


def _first_visible(page, selectors: str):
    for part in (selectors or "").split(","):
        sel = part.strip()
        if not sel:
            continue
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            if loc.is_visible(timeout=1200):
                return loc
        except Exception:
            continue
    return None


def _login_in_browser(site: dict[str, Any], *, headless: bool) -> dict[str, Any]:
    from playwright.sync_api import sync_playwright

    url = str(site.get("url") or "").strip()
    user = str(site.get("user") or "").strip()
    password = str(site.get("password") or "")
    name = str(site.get("name") or site.get("id") or "site")

    if not url:
        return {"ok": False, "error": "URL이 비어 있습니다.", "site": name}
    if not user or not password:
        return {
            "ok": False,
            "error": "sites.local.json 에 user/password 를 먼저 입력하세요.",
            "site": name,
            "url": url,
        }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(900)

        user_el = _first_visible(page, str(site.get("user_selector") or "input[type='text'], input[type='email']"))
        pw_el = _first_visible(page, str(site.get("password_selector") or "input[type='password']"))
        if user_el is None or pw_el is None:
            if headless:
                browser.close()
            else:
                # keep open so user can log in manually
                while browser.is_connected():
                    time.sleep(2)
            return {
                "ok": False,
                "error": "로그인 입력란을 찾지 못했습니다. selector를 확인하세요.",
                "site": name,
                "url": page.url,
            }

        user_el.click()
        user_el.fill(user)
        pw_el.click()
        pw_el.fill(password)

        submit = _first_visible(
            page,
            str(site.get("submit_selector") or "button[type='submit'], input[type='submit']"),
        )
        if submit is not None:
            submit.click()
        else:
            pw_el.press("Enter")

        page.wait_for_timeout(2200)
        final_url = page.url

        if headless:
            browser.close()
            return {
                "ok": True,
                "site": name,
                "url": final_url,
                "message": "로그인 입력·제출을 수행했습니다.",
                "browser_left_open": False,
            }

        # headed: keep Chromium open until user closes it
        while browser.is_connected():
            time.sleep(2)
        return {
            "ok": True,
            "site": name,
            "url": final_url,
            "message": "로그인 입력·제출을 수행했습니다. (브라우저 유지)",
            "browser_left_open": True,
        }


def run_login(site: dict[str, Any], *, headless: bool = False, background: bool = True) -> dict[str, Any]:
    """로그인을 실행한다. headed+background면 별도 스레드에서 브라우저를 유지한다."""
    if headless or not background:
        return _login_in_browser(site, headless=headless)

    result_box: dict[str, Any] = {"ok": True, "pending": True}

    def worker() -> None:
        try:
            out = _login_in_browser(site, headless=False)
            result_box.clear()
            result_box.update(out)
        except Exception as exc:  # noqa: BLE001
            result_box.clear()
            result_box.update({"ok": False, "error": str(exc), "site": site.get("name")})

    t = threading.Thread(target=worker, daemon=True, name=f"biz-login-{site.get('id')}")
    with _KEEPALIVE_LOCK:
        _KEEPALIVE_THREADS.append(t)
    t.start()
    # give the thread a moment to start / fail fast on import errors
    t.join(timeout=1.5)
    if not t.is_alive() and result_box.get("ok") is False:
        return dict(result_box)
    return {
        "ok": True,
        "site": site.get("name") or site.get("id"),
        "url": site.get("url"),
        "message": "PC 브라우저에서 자동 로그인을 시작했습니다.",
        "browser_left_open": True,
        "started": True,
    }


if __name__ == "__main__":
    import sys

    sid = sys.argv[1] if len(sys.argv) > 1 else ""
    site = find_site(sid) if sid else None
    if not site:
        print(json.dumps({"ok": False, "error": f"site not found: {sid}"}, ensure_ascii=False))
        raise SystemExit(1)
    print(json.dumps(run_login(site, headless=False, background=False), ensure_ascii=False, indent=2))
