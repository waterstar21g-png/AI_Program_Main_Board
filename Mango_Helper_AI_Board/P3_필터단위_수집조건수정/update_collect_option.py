"""
P3_필터단위_수집조건수정 — 더망고 필터 목록의 수집조건(번역옵션) 일괄 변경.

`P2_필터단위_상품수변경` 을 복제해, 입력값을 「적용상품수(숫자)」 대신
「번역옵션(목록에서 선택)」 으로 바꾼 프로그램이다.

1) 필터 목록(검색필터 화면) 행을 읽음
2) 각 행에서 수집조건수정 → **번역옵션 적용** → 저장하기 → 확인

번역옵션은 망고 수정화면의 실제 컨트롤(select · 라디오 · 체크박스)에서 읽어오므로,
보드 리스트박스 목록도 `--list-options` 로 망고에서 그대로 가져온다.

사용법:
  python update_collect_option.py --list-options
  python update_collect_option.py --translate-option "번역후저장"
  python update_collect_option.py --translate-option "번역후저장" --mango-url "https://..."
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
P3_DIR = ROOT / "P3_필터_갱신"
P2_DIR = ROOT / "P2"
for p in (P3_DIR, P2_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import update_filters as p3  # noqa: E402

ProgressFn = Callable[[str], None]

STOP_FLAG_PATH = Path(__file__).resolve().parent / ".option_stop"
OPTIONS_CACHE_PATH = Path(__file__).resolve().parent / ".translate_options.json"

# 망고 수집조건수정 화면의 「번역 후 저장」 컨트롤
#   <tr id="layer_tr_limit_count">
#     <td>번역 후 저장</td>
#     <td><select name="translate_method" onchange="trans_change(this.value);"> …
TRANSLATE_SELECT_NAME = "translate_method"

# 보드 리스트박스 목록 — 망고 화면의 실제 옵션 순서 그대로
DEFAULT_TRANSLATE_OPTIONS = (
    "번역안함",
    "더망고 무료 번역기 사용",
    "구글 번역기 사용",
    "DeepL 번역기 사용",
    "네이버(클라우드) 번역기 사용",
)

# 번역 관련 컨트롤을 찾을 때 쓰는 라벨 키워드 (공백 무시 비교)
LABEL_KEYWORDS = ("번역 후 저장", "번역후저장", "번역옵션", "번역")

OPTION_LINE_PREFIX = "##OPTION##"


@dataclass
class RunResult:
    ok: bool
    total_rows: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class TranslateControl:
    """망고 수정화면의 번역옵션 컨트롤."""

    kind: str  # "select" | "radio" | "checkbox"
    options: list[str]
    locator: object | None = None
    choices: list[tuple[str, object]] = field(default_factory=list)  # (라벨, 로케이터)
    values: list[str] = field(default_factory=list)  # select 의 option value


def clear_stop_flag() -> None:
    try:
        STOP_FLAG_PATH.unlink(missing_ok=True)  # type: ignore[call-arg]
    except Exception:
        pass


def stop_requested() -> bool:
    return STOP_FLAG_PATH.is_file()


def _log(progress: ProgressFn | None, message: str, *, major: bool = False) -> None:
    line = message or ""
    if major:
        line = f"##MAIN##{line}"
    print(line, flush=True)
    if progress:
        progress(line)


def _patch_p3_stop() -> Path:
    old = p3.STOP_FLAG_PATH
    p3.STOP_FLAG_PATH = STOP_FLAG_PATH
    return old


def _restore_p3_stop(old: Path) -> None:
    p3.STOP_FLAG_PATH = old


# ── 옵션 이름 매칭 · 캐시 ─────────────────────────────────────────


def normalize(text: str) -> str:
    return "".join(str(text or "").split())


def match_option(options: list[str], wanted: str) -> str | None:
    """리스트박스에서 고른 값을 실제 컨트롤 옵션에 맞춘다.

    정확 일치 → 공백 무시 일치 → 부분 포함 순서.
    """
    want = str(wanted or "").strip()
    if not want:
        return None
    for o in options:
        if o == want:
            return o
    nw = normalize(want)
    for o in options:
        if normalize(o) == nw:
            return o
    for o in options:
        if nw and (nw in normalize(o) or normalize(o) in nw):
            return o
    return None


def load_cached_options() -> list[str]:
    """보드 리스트박스용 — 마지막으로 망고에서 읽은 목록."""
    try:
        data = json.loads(OPTIONS_CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return list(DEFAULT_TRANSLATE_OPTIONS)
    opts = [str(o).strip() for o in data.get("options", []) if str(o).strip()]
    return opts or list(DEFAULT_TRANSLATE_OPTIONS)


def save_cached_options(options: list[str]) -> None:
    payload = {"options": [str(o).strip() for o in options if str(o).strip()]}
    try:
        OPTIONS_CACHE_PATH.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    except OSError:
        pass


def format_option_lines(options: list[str]) -> str:
    """--list-options 출력 (보드가 파싱)."""
    return "\n".join(f"{OPTION_LINE_PREFIX}{o}" for o in options)


def parse_option_lines(text: str) -> list[str]:
    out: list[str] = []
    for line in (text or "").splitlines():
        line = line.strip()
        if not line.startswith(OPTION_LINE_PREFIX):
            continue
        value = line[len(OPTION_LINE_PREFIX) :].strip()
        if value and value not in out:
            out.append(value)
    return out


# ── 망고 수정화면의 번역옵션 컨트롤 ──────────────────────────────

_CONTROL_JS = """
(keywords) => {
  const norm = (s) => (s || '').replace(/\\s+/g, '');
  const hit = (s) => keywords.some(k => norm(s).includes(norm(k)));
  const scopeText = (el) => {
    const tr = el.closest('tr');
    const box = tr || el.closest('td,div,label,fieldset') || el.parentElement;
    return (box && box.innerText) || '';
  };
  const labelOf = (inp) => {
    if (inp.id) {
      const lb = document.querySelector(`label[for="${inp.id}"]`);
      if (lb && lb.innerText.trim()) return lb.innerText.trim();
    }
    const wrap = inp.closest('label');
    if (wrap && wrap.innerText.trim()) return wrap.innerText.trim();
    const sib = inp.nextElementSibling;
    if (sib && sib.innerText && sib.innerText.trim()) return sib.innerText.trim();
    return (inp.value || '').trim();
  };

  for (const sel of Array.from(document.querySelectorAll('select'))) {
    if (sel.disabled) continue;
    if (!hit(scopeText(sel)) && !hit(sel.name || '') && !hit(sel.id || '')) continue;
    const options = Array.from(sel.options)
      .map(o => (o.textContent || '').trim())
      .filter(Boolean);
    if (!options.length) continue;
    return {kind: 'select', options, name: sel.name || '', id: sel.id || ''};
  }

  const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
    .filter(r => !r.disabled && (hit(scopeText(r)) || hit(r.name || '')));
  if (radios.length > 1) {
    return {
      kind: 'radio',
      options: radios.map(labelOf),
      name: radios[0].name || '',
      values: radios.map(r => r.value || ''),
    };
  }

  const checks = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    .filter(c => !c.disabled && (hit(scopeText(c)) || hit(c.name || '') || hit(labelOf(c))));
  if (checks.length === 1) {
    return {
      kind: 'checkbox',
      options: ['사용', '미사용'],
      name: checks[0].name || '',
      id: checks[0].id || '',
      label: labelOf(checks[0]),
    };
  }
  return null;
}
"""


_SELECT_OPTIONS_JS = """
(el) => Array.from(el.options).map(o => ({
  text: (o.textContent || '').trim(),
  value: o.value || '',
})).filter(o => o.text)
"""

_SELECTED_LABEL_JS = """
(el) => {
  const o = el.options[el.selectedIndex];
  return o ? (o.textContent || '').trim() : '';
}
"""


def find_translate_select(page):
    """`select[name="translate_method"]` — 망고 화면의 번역 후 저장 드롭다운."""
    try:
        loc = page.locator(f'select[name="{TRANSLATE_SELECT_NAME}"]').first
        if loc.count() > 0:
            return loc
    except Exception:
        pass
    return None


def detect_translate_control(page) -> TranslateControl | None:
    """수정화면에서 번역옵션 컨트롤을 찾는다.

    1) 망고 실제 DOM: `select[name="translate_method"]`
    2) 폴백: 「번역 후 저장」 라벨 주변의 select · 라디오 · 체크박스
    """
    loc = find_translate_select(page)
    if loc is not None:
        try:
            raw = loc.evaluate(_SELECT_OPTIONS_JS)
        except Exception:
            raw = []
        options = [str(o.get("text") or "").strip() for o in raw if str(o.get("text") or "").strip()]
        if options:
            values = [str(o.get("value") or "") for o in raw]
            return TranslateControl(
                kind="select", options=options, locator=loc, values=values
            )

    try:
        info = page.evaluate(_CONTROL_JS, list(LABEL_KEYWORDS))
    except Exception:
        info = None
    if not info:
        return None

    kind = str(info.get("kind") or "")
    options = [str(o).strip() for o in (info.get("options") or []) if str(o).strip()]
    if not kind or not options:
        return None

    name = str(info.get("name") or "")
    el_id = str(info.get("id") or "")

    if kind == "select":
        loc = None
        if name:
            loc = page.locator(f'select[name="{name}"]').first
        elif el_id:
            loc = page.locator(f"select#{el_id}").first
        else:
            loc = page.locator("select").first
        return TranslateControl(kind="select", options=options, locator=loc)

    if kind == "radio":
        values = [str(v) for v in (info.get("values") or [])]
        choices: list[tuple[str, object]] = []
        for idx, label in enumerate(options):
            if name and idx < len(values) and values[idx]:
                loc = page.locator(
                    f'input[type="radio"][name="{name}"][value="{values[idx]}"]'
                ).first
            elif name:
                loc = page.locator(f'input[type="radio"][name="{name}"]').nth(idx)
            else:
                loc = page.locator('input[type="radio"]').nth(idx)
            choices.append((label, loc))
        return TranslateControl(kind="radio", options=options, choices=choices)

    # checkbox
    if el_id:
        loc = page.locator(f"input#{el_id}").first
    elif name:
        loc = page.locator(f'input[type="checkbox"][name="{name}"]').first
    else:
        loc = page.locator('input[type="checkbox"]').first
    return TranslateControl(kind="checkbox", options=options, locator=loc)


def read_current_option(control: TranslateControl) -> str:
    """현재 선택값 — select 는 **표시 라벨**(value 아님) 로 읽는다."""
    try:
        if control.kind == "select":
            return (control.locator.evaluate(_SELECTED_LABEL_JS) or "").strip()  # type: ignore[union-attr]
        if control.kind == "radio":
            for label, loc in control.choices:
                try:
                    if loc.is_checked(timeout=400):
                        return label
                except Exception:
                    continue
            return ""
        if control.kind == "checkbox":
            checked = bool(control.locator.is_checked(timeout=400))  # type: ignore[union-attr]
            return control.options[0] if checked else control.options[-1]
    except Exception:
        return ""
    return ""


ON_WORDS = ("사용", "적용", "켜", "체크", "on", "yes", "true", "저장")


def wants_on(option: str) -> bool:
    """체크박스용 — 선택값이 '켜기' 계열인지."""
    text = normalize(option).lower()
    if any(w in text for w in ("미사용", "안함", "해제", "off", "no", "false")):
        return False
    return any(normalize(w).lower() in text for w in ON_WORDS)


def apply_option(
    control: TranslateControl,
    option: str,
    *,
    progress: ProgressFn | None = None,
) -> bool:
    """번역옵션을 컨트롤에 적용. 적용 후 값을 다시 읽어 확인한다."""
    target = match_option(control.options, option)
    if target is None:
        _log(
            progress,
            f"오류: 번역옵션 미검출 · 선택={option!r} · 망고옵션={control.options}",
            major=True,
        )
        return False

    before = read_current_option(control)

    try:
        if control.kind == "select":
            # 라벨로 선택 (onchange="trans_change(this.value)" 는 select_option 이 발생시킨다)
            try:
                control.locator.select_option(label=target, timeout=3_000)  # type: ignore[union-attr]
            except Exception:
                value = ""
                if target in control.options:
                    idx = control.options.index(target)
                    if idx < len(control.values):
                        value = control.values[idx]
                control.locator.select_option(  # type: ignore[union-attr]
                    value or target, timeout=3_000
                )
        elif control.kind == "radio":
            loc = next((l for lab, l in control.choices if lab == target), None)
            if loc is None:
                return False
            try:
                loc.check(timeout=3_000)
            except Exception:
                loc.click(timeout=3_000)
        else:  # checkbox
            if wants_on(target):
                control.locator.check(timeout=3_000)  # type: ignore[union-attr]
            else:
                control.locator.uncheck(timeout=3_000)  # type: ignore[union-attr]
    except Exception as e:  # noqa: BLE001
        _log(progress, f"오류: 번역옵션 적용 실패 · {target} · {e}", major=True)
        return False

    after = read_current_option(control)
    ok = normalize(after) == normalize(target) if after else True
    _log(
        progress,
        f"번역옵션 {before or '?'} → {after or target} (선택={target})",
        major=True,
    )
    if not ok:
        _log(progress, f"오류: 적용 확인 실패 · 기대={target} · 현재={after}", major=True)
    return ok


def set_translate_option(page, option: str, *, progress: ProgressFn | None = None) -> bool:
    """수정화면을 찾아 번역옵션을 적용."""
    work, _kind = p3.resolve_modify_target(page)
    if work is None:
        _log(progress, "오류: 수정 화면(수집조건수정) 미검출", major=True)
        return False

    control = detect_translate_control(work)
    if control is None:
        _log(progress, "오류: 번역옵션 컨트롤 미검출", major=True)
        return False

    return apply_option(control, option, progress=progress)


# ── 실행 ─────────────────────────────────────────────────────────


def _open_mango(pw, mango_url: str, progress: ProgressFn | None):
    import collect as p2  # noqa: WPS433

    _browser, page = p2.connect_browser(pw)
    url = (mango_url or "").strip() or p3.DEFAULT_MANGO_URL
    page = p3.navigate_mango_url(page, url, progress=progress, p2=p2)
    return page, url


def fetch_translate_options(
    *,
    mango_url: str = "",
    progress: ProgressFn | None = None,
) -> list[str]:
    """망고 수정화면을 한 번 열어 번역옵션 목록을 읽어온다 (보드 리스트박스용)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        _log(progress, f"의존성 로드 실패: {e}", major=True)
        return []

    options: list[str] = []
    try:
        with sync_playwright() as pw:
            page, url = _open_mango(pw, mango_url, progress)
            rows = [r for r in p3.list_demango_rows(page) if r.get("hasEdit")]
            if not rows:
                _log(progress, "필터 목록에서 수정 가능한 행이 없습니다.", major=True)
                return []

            first = rows[0]
            if not p3.click_edit_on_row(
                page,
                int(first.get("index") or 0),
                row_url=(first.get("url") or "").strip(),
                filter_hint=(first.get("filterName") or "").strip(),
                fuid_hint=str(first.get("fuid") or "").strip(),
                progress=progress,
            ) or not p3.wait_modify_page(page):
                _log(progress, "수집조건수정 화면을 열지 못했습니다.", major=True)
                return []

            work, _kind = p3.resolve_modify_target(page)
            control = detect_translate_control(work) if work is not None else None
            if control is None:
                _log(progress, "번역옵션 컨트롤 미검출", major=True)
            else:
                options = list(control.options)
                _log(progress, f"번역옵션 {len(options)}개: {options}", major=True)
            p3._return_to_list(page, url)
    except Exception as e:  # noqa: BLE001
        _log(progress, f"옵션 읽기 오류: {e}", major=True)
        return []

    if options:
        save_cached_options(options)
    return options


def run_update_collect_option(
    translate_option: str,
    *,
    mango_url: str = "",
    progress: ProgressFn | None = None,
) -> RunResult:
    option = str(translate_option or "").strip()
    if not option:
        return RunResult(ok=False, errors=["번역옵션을 리스트에서 선택하세요."])

    result = RunResult(ok=False)
    clear_stop_flag()
    old_stop = _patch_p3_stop()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        _restore_p3_stop(old_stop)
        result.errors.append(f"의존성 로드 실패: {e}")
        _log(progress, result.errors[0], major=True)
        return result

    _log(progress, f"번역옵션: {option}", major=True)

    try:
        with sync_playwright() as pw:
            page, url = _open_mango(pw, mango_url, progress)

            rows = p3.list_demango_rows(page)
            editable = [r for r in rows if r.get("hasEdit")]
            result.total_rows = len(editable)
            if not editable:
                result.errors.append("필터 목록에서 수정 가능한 행이 없습니다.")
                _log(progress, result.errors[0], major=True)
                return result

            _log(progress, f"필터 {len(editable)}행 — 순차 수집조건수정", major=True)

            for i, drow in enumerate(editable, start=1):
                if stop_requested():
                    _log(progress, "사용자 중단", major=True)
                    break

                row_idx = int(drow.get("index") or 0)
                d_filter = (drow.get("filterName") or "").strip()
                d_url = (drow.get("url") or "").strip()
                d_fuid = str(drow.get("fuid") or "").strip()

                _log(
                    progress,
                    f"{i}/{len(editable)} · 필터={d_filter or '?'} · URL={d_url[:80]}",
                    major=True,
                )

                if not p3.click_edit_on_row(
                    page,
                    row_idx,
                    row_url=d_url,
                    filter_hint=d_filter,
                    fuid_hint=d_fuid,
                    progress=progress,
                ):
                    result.failed += 1
                    result.errors.append(f"수집조건수정 실패 · 필터={d_filter}")
                    continue

                if not p3.wait_modify_page(page):
                    result.failed += 1
                    result.errors.append(f"수정화면 미열림 · 필터={d_filter}")
                    p3._return_to_list(page, url)
                    continue

                if not set_translate_option(page, option, progress=progress):
                    result.failed += 1
                    result.errors.append(f"번역옵션 적용 실패 · 필터={d_filter}")
                    p3._return_to_list(page, url)
                    continue

                if not p3.click_save_button(page):
                    result.failed += 1
                    result.errors.append(f"저장하기 실패 · 필터={d_filter}")
                    p3._return_to_list(page, url)
                    continue

                if not p3.click_modified_confirm(page, progress=progress):
                    result.failed += 1
                    result.errors.append(f"확인 실패 · 필터={d_filter}")
                    p3._return_to_list(page, url)
                    continue

                result.updated += 1
                _log(progress, f"  변경 완료 · 번역옵션={option}", major=True)
                p3._return_to_list(page, url)
                time.sleep(0.3)

    except Exception as e:  # noqa: BLE001
        result.errors.append(str(e))
        _log(progress, f"실행 오류: {e}", major=True)
    finally:
        _restore_p3_stop(old_stop)
        clear_stop_flag()

    result.ok = result.updated > 0 and result.failed == 0 and not result.errors
    _log(
        progress,
        f"완료 — 성공 {result.updated} · 실패 {result.failed} · 건너뜀 {result.skipped} "
        f"/ 대상 {result.total_rows}",
        major=True,
    )
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="P3_필터단위_수집조건수정")
    parser.add_argument("--translate-option", default="", help="번역옵션 (리스트 선택값)")
    parser.add_argument(
        "--list-options",
        action="store_true",
        help="망고에서 번역옵션 목록만 읽어 출력",
    )
    parser.add_argument("--mango-url", default="", help="필터 목록 URL (기본=P3 초기값)")
    args = parser.parse_args(argv)

    if args.list_options:
        options = fetch_translate_options(mango_url=args.mango_url)
        if not options:
            print("[오류] 번역옵션 목록을 읽지 못했습니다.", flush=True)
            return 1
        print(format_option_lines(options), flush=True)
        return 0

    if not args.translate_option.strip():
        parser.error("--translate-option 또는 --list-options 가 필요합니다.")

    result = run_update_collect_option(
        args.translate_option, mango_url=args.mango_url
    )
    if result.errors:
        for e in result.errors:
            print(f"[오류] {e}", flush=True)
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
