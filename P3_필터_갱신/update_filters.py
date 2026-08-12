"""
P3_필터_갱신 — 더망고 검색필터(저장조건) 화면의 저장상품수 갱신.

0) 보드에 입력한 더망고 URL(검색필터 저장조건 화면)로 이동
1) ★더망고 행의 URL을 기준값으로 엑셀에서 동일 URL을 찾음
   → 검색필터 동일 시 진행 (엑셀 중간공백→'_' 재비교 포함)
2) "수집조건수정" 클릭
3) 팝업에서 저장상품수 갱신
   - 상품수집가능개수 ≤ 200 → 그대로
   - 200 < n ≤ 500 → 300
   - n > 500 → 400
4) 팝업 하단 "저장하기" → 다음 행
5) 더망고 화면 전 행 반복

로그:
- 더망고 처음 10건: 더망고/엑셀 각각 1줄(검색필터·URL)
- 엑셀 처음 5행 매칭분 = 단계별 세부 / 그 외 = 핵심만
- 불일치 행: 검색필터·URL만

사용법:
  python update_filters.py 엑셀.xlsx --mango-url "https://..."
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable
from urllib.parse import unquote, urlparse

from openpyxl import load_workbook

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
P2_DIR = ROOT / "P2"
if str(P2_DIR) not in sys.path:
    sys.path.insert(0, str(P2_DIR))

ProgressFn = Callable[[str, str], None]

STOP_FLAG_PATH = Path(__file__).resolve().parent / ".filter_stop"
DETAIL_EXCEL_ROWS = 5  # 엑셀 1~5행 매칭 시 세부 로그
FIRST_COMPARE_LOG_N = 10  # 더망고 처음 10건: 더망고/엑셀 비교 2줄 로그

URL_HEADERS = (
    "검색필터 URL",
    "최종 카테고리 URL주소",
    "최종 카테고리 URL",
    "카테고리 URL",
    "URL주소",
    "URL",
    "url",
)
FILTER_HEADERS = (
    "검색필터",
    "검색필터명",
    "상위 최종 카테고리명",
    "최종 카테고리명",
    "카테고리명",
)
COLLECTIBLE_HEADERS = ("상품수집가능개수", "총상품수")


@dataclass
class ExcelRow:
    excel_row: int  # 1-based sheet row
    url: str
    filter_name: str
    collectible: int


@dataclass
class RunResult:
    ok: bool
    total_demango: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


def _log(progress: ProgressFn | None, step: str, message: str) -> None:
    print(f"[{step}] {message}", flush=True)
    if progress:
        progress(step, message)


def clear_stop_flag() -> None:
    try:
        STOP_FLAG_PATH.unlink(missing_ok=True)  # type: ignore[call-arg]
    except TypeError:
        if STOP_FLAG_PATH.exists():
            try:
                STOP_FLAG_PATH.unlink()
            except OSError:
                pass
    except OSError:
        pass


def stop_requested() -> bool:
    return STOP_FLAG_PATH.is_file()


def normalize_url(url: str) -> str:
    """URL 비교용 정규화 (끝 슬래시·쿼리 일부 무시하지 않음, 스킴/호스트 소문자)."""
    s = (url or "").strip()
    if not s:
        return ""
    try:
        p = urlparse(s)
        path = unquote(p.path or "")
        if path.endswith("/") and len(path) > 1:
            path = path[:-1]
        netloc = (p.netloc or "").lower()
        scheme = (p.scheme or "https").lower()
        query = p.query or ""
        return f"{scheme}://{netloc}{path}" + (f"?{query}" if query else "")
    except Exception:
        return s.rstrip("/").lower()


def map_save_count(collectible: int) -> int:
    """상품수집가능개수 → 더망고 저장상품수."""
    n = max(0, int(collectible))
    if n <= 200:
        return n
    if n <= 500:
        return 300
    return 400


def _header_index(headers: list[str], candidates: tuple[str, ...]) -> int | None:
    lowered = [(h or "").strip() for h in headers]
    for cand in candidates:
        for i, h in enumerate(lowered):
            if h == cand:
                return i
    for cand in candidates:
        c = cand.lower()
        for i, h in enumerate(lowered):
            if c in h.lower():
                return i
    return None


def _parse_int(raw) -> int:
    if raw is None:
        return 0
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return max(0, int(raw))
    s = re.sub(r"[^\d]", "", str(raw))
    return int(s) if s else 0


def read_excel_rows(path: Path) -> list[ExcelRow]:
    wb = load_workbook(str(path), data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_vals = next(rows_iter)
    except StopIteration:
        wb.close()
        raise ValueError("엑셀이 비어 있습니다.")
    headers = [str(h).strip() if h is not None else "" for h in header_vals]
    url_i = _header_index(headers, URL_HEADERS)
    if url_i is None:
        wb.close()
        raise ValueError(
            "URL 열 없음 — '검색필터 URL' 또는 '최종 카테고리 URL주소' 필요"
        )
    filter_i = _header_index(headers, FILTER_HEADERS)
    coll_i = _header_index(headers, COLLECTIBLE_HEADERS)
    out: list[ExcelRow] = []
    for offset, vals in enumerate(rows_iter, start=2):
        cells = list(vals) if vals else []
        url = str(cells[url_i] or "").strip() if url_i < len(cells) else ""
        if not url or not url.lower().startswith("http"):
            continue
        fname = ""
        if filter_i is not None and filter_i < len(cells):
            fname = str(cells[filter_i] or "").strip()
        coll = 0
        if coll_i is not None and coll_i < len(cells):
            coll = _parse_int(cells[coll_i])
        out.append(
            ExcelRow(
                excel_row=offset,
                url=url,
                filter_name=fname,
                collectible=coll,
            )
        )
    wb.close()
    return out


def excel_by_url(rows: list[ExcelRow]) -> dict[str, ExcelRow]:
    """엑셀 URL → 행. 조회 KEY는 더망고 URL(정규화) 기준."""
    m: dict[str, ExcelRow] = {}
    for r in rows:
        key = normalize_url(r.url)
        if key and key not in m:
            m[key] = r
    return m


def find_excel_by_demango_url(
    by_url: dict[str, ExcelRow], demango_url: str
) -> ExcelRow | None:
    """★요건: 더망고 URL을 기준값으로 엑셀에서 동일 URL 행을 찾는다."""
    key = normalize_url(demango_url)
    if not key:
        return None
    return by_url.get(key)


def log_first10_compare(
    progress: ProgressFn | None,
    *,
    ordinal: int,
    d_filter: str,
    d_url: str,
    ex: ExcelRow | None,
) -> None:
    """더망고 처음 10건 — 더망고/엑셀 검색필터·URL을 두 줄로 표시."""
    if ordinal > FIRST_COMPARE_LOG_N:
        return
    _log(
        progress,
        "비교",
        f"더망고 · 검색필터={d_filter} · URL={d_url}",
    )
    if ex is not None:
        _log(
            progress,
            "비교",
            f"엑셀 · 검색필터={ex.filter_name} · URL={ex.url}",
        )
    else:
        _log(
            progress,
            "비교",
            "엑셀 · 검색필터=- · URL=-",
        )


def filters_equal(excel_filter: str, demango_filter: str) -> bool:
    """검색필터 비교.

    1) 그대로 비교
    2) 불일치이고 엑셀 검색필터 값 *중간*에 공백이 있으면 공백→'_' 치환 후 재비교
    """
    a = (excel_filter or "").strip()
    b = (demango_filter or "").strip()
    if a == b:
        return True
    # 중간에 공백이 있는 경우만 (앞뒤 trim 이후에도 공백 존재)
    if " " in a:
        if a.replace(" ", "_") == b:
            return True
    return False


def filter_compare_note(excel_filter: str, demango_filter: str) -> str:
    """로그용 — 공백→_ 재비교로 맞은 경우 메모."""
    a = (excel_filter or "").strip()
    b = (demango_filter or "").strip()
    if a == b:
        return ""
    if " " in a and a.replace(" ", "_") == b:
        return "엑셀 중간공백→'_' 재비교 일치"
    return ""


def _detail(excel_row: int | None) -> bool:
    """엑셀 처음 5행(데이터 행 기준 sheet row 중 앞 5건) — excel_row 번호가 작을수록 앞행.

    데이터 시작이 보통 2행이므로 sheet row 2~6 을 세부 로그로 본다.
    """
    if excel_row is None:
        return False
    # header=1 → 데이터 1번째 행 = excel_row 2 … 5번째 = excel_row 6
    return 2 <= excel_row <= (1 + DETAIL_EXCEL_ROWS)


class Logger:
    def __init__(self, progress: ProgressFn | None, excel_row: int | None = None):
        self.progress = progress
        self.excel_row = excel_row
        self.verbose = _detail(excel_row)

    def step(self, step: str, detail: str, summary: str | None = None) -> None:
        if self.verbose:
            _log(self.progress, step, detail)
        else:
            _log(self.progress, step, summary if summary is not None else detail)


def navigate_mango_url(page, mango_url: str, *, progress: ProgressFn | None) -> None:
    url = (mango_url or "").strip()
    if not url:
        raise ValueError("더망고 URL이 비어 있습니다.")
    _log(progress, "로직", f"0) 더망고 URL(검색필터·저장조건) 이동: {url}")
    page.goto(url, wait_until="domcontentloaded", timeout=90_000)
    time.sleep(0.8)
    # 화면 문구 확인 (없어도 진행 — URL을 사용자가 지정)
    try:
        body = page.locator("body").inner_text(timeout=3000) or ""
        if re.search(r"검색\s*필터|저장\s*조건|수집\s*조건", body):
            _log(progress, "확인", "검색필터/저장조건 화면 문구 확인")
        else:
            _log(progress, "확인", "화면 문구 미검출 — 지정 URL로 계속 진행")
    except Exception:
        pass


def list_demango_rows(page) -> list[dict]:
    """더망고 검색필터 목록 행 수집 (검색필터 URL · 검색필터명 · 행 인덱스)."""
    data = page.evaluate(
        """() => {
          const out = [];
          const trs = Array.from(document.querySelectorAll('tr'));
          trs.forEach((tr, idx) => {
            const t = (tr.innerText || '').replace(/\\s+/g, ' ').trim();
            if (!t) return;
            if (!/수집\\s*조건\\s*수정|조건\\s*수정/.test(t) && !/https?:\\/\\//i.test(t)) {
              return;
            }
            // skip header-like
            if (/검색\\s*필터\\s*URL|번호/.test(t) && !/https?:\\/\\//i.test(t)) return;
            let url = '';
            const link = tr.querySelector('a[href^="http"], a[href*="http"]');
            if (link) url = link.href || link.getAttribute('href') || '';
            if (!url) {
              const m = t.match(/https?:\\/\\/[^\\s]+/i);
              if (m) url = m[0];
            }
            // 검색필터명: URL이 아닌 짧은 텍스트 셀 후보
            let filterName = '';
            const tds = Array.from(tr.querySelectorAll('td, th'));
            for (const td of tds) {
              const s = (td.innerText || '').replace(/\\s+/g, ' ').trim();
              if (!s || /^\\d+$/.test(s)) continue;
              if (/https?:\\/\\//i.test(s)) continue;
              if (/수집\\s*조건\\s*수정|수정|삭제|선택/.test(s) && s.length < 12) continue;
              if (s.length >= 2 && s.length <= 80) { filterName = s; break; }
            }
            const hasEdit = /수집\\s*조건\\s*수정|조건\\s*수정/.test(t);
            if (url || hasEdit) {
              out.push({ index: idx, url, filterName, hasEdit, text: t.slice(0, 200) });
            }
          });
          return out;
        }"""
    )
    return list(data or [])


def click_edit_on_row(page, row_index: int) -> bool:
    return bool(
        page.evaluate(
            """(idx) => {
              const trs = document.querySelectorAll('tr');
              const tr = trs[idx];
              if (!tr) return false;
              const nodes = Array.from(tr.querySelectorAll('a, button, span, input'));
              for (const el of nodes) {
                const t = (el.value || el.textContent || '').replace(/\\s+/g, '');
                if (/수집조건수정|조건수정/.test(t)) {
                  el.click();
                  return true;
                }
              }
              // fallback: any clickable with 수정
              for (const el of nodes) {
                const t = (el.value || el.textContent || '').replace(/\\s+/g, '');
                if (t === '수정' || /수정$/.test(t)) {
                  el.click();
                  return true;
                }
              }
              return false;
            }""",
            row_index,
        )
    )


def find_save_count_input(page):
    """팝업/모달의 저장상품수 입력칸."""
    # label-near input
    try:
        loc = page.locator(
            "xpath=//*[contains(normalize-space(.),'저장상품수') or "
            "contains(normalize-space(.),'저장 상품 수') or "
            "contains(normalize-space(.),'검색결과상위') or "
            "contains(normalize-space(.),'수집상품수')]"
            "/following::input[1]"
        ).first
        if loc.count() > 0 and loc.is_visible(timeout=800):
            return loc
    except Exception:
        pass
    for sel in (
        'input[name*="save"]',
        'input[name*="count"]',
        'input[name*="goods"]',
        'input[type="text"]',
        'input[type="number"]',
    ):
        try:
            cands = page.locator(sel)
            n = min(cands.count(), 12)
            for i in range(n):
                el = cands.nth(i)
                if not el.is_visible(timeout=200):
                    continue
                # prefer numeric-looking fields near modal
                return el
        except Exception:
            continue
    return None


def set_save_count(page, value: int) -> bool:
    loc = find_save_count_input(page)
    if loc is None:
        return False
    try:
        loc.click(timeout=1500)
        loc.fill("")
        loc.type(str(value), delay=20)
        return True
    except Exception:
        try:
            loc.fill(str(value))
            return True
        except Exception:
            return False


def click_save_button(page) -> bool:
    selectors = (
        'input[type="submit"][value="저장하기"]',
        'input[type="button"][value="저장하기"]',
        'input[value="저장하기"]',
        'button:has-text("저장하기")',
        'a:has-text("저장하기")',
    )
    for sel in selectors:
        try:
            loc = page.locator(sel).last
            if loc.count() > 0 and loc.is_visible(timeout=500):
                loc.click(timeout=3000, force=True)
                return True
        except Exception:
            continue
    try:
        clicked = page.evaluate(
            """() => {
              const nodes = Array.from(document.querySelectorAll('a,button,input,span'));
              for (const el of nodes) {
                const t = (el.value || el.textContent || '').replace(/\\s+/g, '');
                if (t === '저장하기') { el.click(); return true; }
              }
              return false;
            }"""
        )
        return bool(clicked)
    except Exception:
        return False


def run_update(
    excel_path: str | Path,
    mango_url: str,
    *,
    progress: ProgressFn | None = None,
) -> RunResult:
    path = Path(excel_path).expanduser().resolve()
    result = RunResult(ok=False)
    if not path.is_file():
        result.errors.append(f"파일 없음: {path}")
        return result
    mango = (mango_url or "").strip()
    if not mango:
        result.errors.append("더망고 URL을 입력하세요.")
        return result

    clear_stop_flag()
    try:
        rows = read_excel_rows(path)
    except Exception as e:  # noqa: BLE001
        result.errors.append(str(e))
        return result
    if not rows:
        result.errors.append("엑셀에 URL 행이 없습니다.")
        return result
    by_url = excel_by_url(rows)
    _log(progress, "준비", f"엑셀 {path.name} · URL {len(rows)}건 · 더망고URL 지정됨")

    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # noqa: BLE001
        result.errors.append(f"Playwright 미설치: {e}")
        return result

    # P2 CDP 브라우저 재사용
    try:
        import collect as p2  # type: ignore
    except Exception as e:  # noqa: BLE001
        result.errors.append(f"P2 collect 로드 실패: {e}")
        return result

    try:
        with sync_playwright() as p:
            browser, page = p2.connect_browser(p)
            navigate_mango_url(page, mango, progress=progress)
            time.sleep(0.5)

            demango_rows = list_demango_rows(page)
            result.total_demango = len(demango_rows)
            _log(progress, "준비", f"더망고 목록 {result.total_demango}행 검출")

            if result.total_demango == 0:
                result.errors.append(
                    "더망고 화면에서 검색필터 행을 찾지 못했습니다. "
                    "URL이 검색필터(저장조건) 화면인지 확인하세요."
                )
                return result

            for i, drow in enumerate(demango_rows, start=1):
                if stop_requested():
                    _log(progress, "중단", "사용자 중단 요청")
                    break

                d_url = (drow.get("url") or "").strip()
                d_filter = (drow.get("filterName") or "").strip()
                row_idx = int(drow.get("index") or 0)
                # ★요건1: 더망고 URL을 기준값으로 엑셀에서 동일 URL 검색
                ex = find_excel_by_demango_url(by_url, d_url)

                # ★요건2: 더망고 처음 10건 — 더망고/엑셀 검색필터·URL 두 줄
                log_first10_compare(
                    progress,
                    ordinal=i,
                    d_filter=d_filter,
                    d_url=d_url,
                    ex=ex,
                )

                # 1) KEY 매칭 (기준=더망고 URL)
                if not ex:
                    result.skipped += 1
                    if i > FIRST_COMPARE_LOG_N:
                        _log(
                            progress,
                            "불일치",
                            f"검색필터={d_filter} · URL={d_url}",
                        )
                    continue

                # 검색필터 비교 (공백→_ 재비교 포함)
                if ex.filter_name and d_filter and not filters_equal(
                    ex.filter_name, d_filter
                ):
                    result.skipped += 1
                    # ★요건: 불일치 행은 검색필터·URL만 (첫 10건은 비교 2줄로 이미 표시)
                    if i > FIRST_COMPARE_LOG_N:
                        _log(
                            progress,
                            "불일치",
                            f"검색필터={ex.filter_name} · URL={ex.url}",
                        )
                    continue

                lg = Logger(progress, ex.excel_row)
                lg.step(
                    "행",
                    f"{i}/{result.total_demango} 더망고URL기준 매칭 · 엑셀행={ex.excel_row}",
                    f"{i}/{result.total_demango} URL매칭=Y",
                )
                lg.step(
                    "로직",
                    f"1) 더망고URL→엑셀 일치 · 필터일치 — "
                    f"엑셀필터={ex.filter_name!r} · 더망고필터={d_filter!r} · "
                    f"상품수집가능개수={ex.collectible}",
                    f"1) URL·필터일치 · 수집가능={ex.collectible}",
                )
                note = filter_compare_note(ex.filter_name, d_filter)
                if note:
                    lg.step("로직", f"1) {note}", note)

                # 2) 수집조건수정
                lg.step("로직", "2) 수집조건수정 클릭", "2) 조건수정")
                if not click_edit_on_row(page, row_idx):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 수집조건수정 클릭 실패")
                    continue
                time.sleep(0.7)

                # 3) 저장상품수 갱신
                target = map_save_count(ex.collectible)
                lg.step(
                    "로직",
                    f"3) 저장상품수 갱신 — 수집가능={ex.collectible} → 저장상품수={target}",
                    f"3) 저장상품수={target}",
                )
                if not set_save_count(page, target):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 저장상품수 입력칸 실패")
                    try:
                        page.keyboard.press("Escape")
                    except Exception:
                        pass
                    continue

                # 4) 저장하기
                lg.step("로직", "4) 팝업 하단 저장하기 클릭", "4) 저장하기")
                if not click_save_button(page):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 저장하기 클릭 실패")
                    continue
                time.sleep(0.9)
                # 저장 후 알림 닫기
                try:
                    page.keyboard.press("Escape")
                except Exception:
                    pass
                try:
                    page.on("dialog", lambda d: d.accept())
                except Exception:
                    pass
                result.updated += 1
                lg.step(
                    "완료",
                    f"행{i} 갱신완료 · 엑셀행{ex.excel_row} · 저장상품수={target}",
                    f"갱신OK · 저장상품수={target}",
                )

                # 목록이 리로드됐을 수 있어 다음 루프 전 재스캔은 비용 큼 —
                # 인덱스 기반이므로 저장 후 화면 유지 가정. 깨지면 재진입.
                if stop_requested():
                    break

    except Exception as e:  # noqa: BLE001
        result.errors.append(f"실행 실패: {e}")
        _log(progress, "오류", str(e))
        return result

    clear_stop_flag()
    result.ok = result.updated > 0 and not result.errors
    _log(
        progress,
        "완료",
        f"갱신 {result.updated} · 건너뜀 {result.skipped} · 실패 {result.failed} "
        f"/ 더망고 {result.total_demango}행",
    )
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="P3_필터_갱신 — 저장상품수 갱신")
    parser.add_argument("excel", help="엑셀 파일 경로")
    parser.add_argument(
        "--mango-url",
        required=True,
        help="더망고 검색필터(저장조건) 화면 URL (보드 입력값)",
    )
    args = parser.parse_args(argv)
    result = run_update(args.excel, args.mango_url)
    if result.errors:
        for e in result.errors:
            print(f"[오류] {e}", flush=True)
    # 부분 성공도 0
    if result.updated > 0 or (result.ok and not result.errors):
        return 0
    if result.skipped > 0 and result.failed == 0 and not result.errors:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
