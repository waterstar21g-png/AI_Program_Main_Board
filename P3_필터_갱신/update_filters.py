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
4) 팝업 하단 "저장하기"
5) 팝업(검색필터 수정) 닫힘 확인
6) "수정되었습니다" 팝업에서 "확인" 반드시 클릭 → 다음 행
7) 더망고 화면 전 행 반복

필터 일치 행: 모든 단계 스크린샷을 run-logs + 실행로그에 남김
(목록일치 → 수정화면 → 저장상품수 입력그리드 → 저장하기 → 닫힘 → 확인 → 목록복귀)

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
P3_RUN_LOG_DIR = Path(__file__).resolve().parent / "run-logs"
P3_SHOT_MARK = "##P3SHOT##"  # ##P3SHOT##<path>##<label>
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



# 더망고 목록 행 스캔 JS (스크린샷 컬럼 구조 기준) — 테스트에서도 재사용
LIST_DEMANGO_ROWS_JS = r"""() => {
  const out = [];
  const trs = Array.from(document.querySelectorAll('table tr, form tr, tr'));
  let filterCol = -1;
  let condCol = -1;
  let headerIdx = -1;

  const isBadFilterName = (v) => {
    if (!v) return true;
    const s = String(v).trim();
    if (!s) return true;
    if (/^https?:/i.test(s)) return true;
    if (/^\d+$/.test(s)) return true;
    if (/\.com(\/|$)/i.test(s)) return true;           // Zara.com/de 등 사이트열
    if (/\d+\s*개\s*\/\s*\d+\s*개/.test(s)) return true;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
    if (/URL\s*검색|수집조건|전체저장|상품확인|검색필터관리|별도관리/.test(s)) return true;
    if (s.length > 120) return true;
    return false;
  };

  const readInputValue = (inp) => {
    if (!inp) return '';
    return (inp.value || inp.getAttribute('value') || '').trim();
  };

  // 헤더: '필터이름(수정가능)' / '검색필터(저장조건)'
  for (let i = 0; i < trs.length; i++) {
    const cells = Array.from(trs[i].querySelectorAll('th, td'));
    if (cells.length < 2) continue;
    const labels = cells.map(c => (c.innerText || '').replace(/\s+/g, ''));
    const fi = labels.findIndex(t => t.includes('필터이름'));
    const ci = labels.findIndex(t =>
      t.includes('검색필터') && (t.includes('저장조건') || t.includes('저장'))
    );
    if (fi >= 0 || ci >= 0) {
      filterCol = fi;
      condCol = ci;
      headerIdx = i;
      break;
    }
  }

  for (let i = 0; i < trs.length; i++) {
    if (i === headerIdx) continue;
    const tr = trs[i];
    const t = (tr.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (!/URL\s*검색|수집\s*조건\s*수정|https?:\/\//i.test(t)) continue;
    if (/필터이름\(수정가능\)/.test(t) && !/https?:\/\//i.test(t)) continue;

    const cells = Array.from(tr.querySelectorAll(':scope > td, :scope > th'));
    const cellsFallback = cells.length ? cells : Array.from(tr.querySelectorAll('td, th'));
    let filterName = '';
    let url = '';
    let editHref = '';
    let hasEdit = false;

    // 1) 검색필터 필드값 = '필터이름(수정가능)' 열의 <input> value
    const filterCell = (filterCol >= 0 && filterCol < cellsFallback.length)
      ? cellsFallback[filterCol] : null;
    if (filterCell) {
      const inp = filterCell.querySelector(
        'input[type="text"], input[type="search"], input:not([type])'
      );
      filterName = readInputValue(inp);
      if (isBadFilterName(filterName)) filterName = '';
    }
    if (!filterName) {
      // 폴백: 행 내 텍스트 input (사이트·숫자·URL 제외)
      const inputs = Array.from(tr.querySelectorAll('input')).filter(inp => {
        const ty = (inp.getAttribute('type') || 'text').toLowerCase();
        return ty === 'text' || ty === 'search' || ty === '';
      });
      for (const inp of inputs) {
        const v = readInputValue(inp);
        if (isBadFilterName(v)) continue;
        filterName = v;
        break;
      }
    }

    // 2) URL = '검색필터(저장조건)' 열의 'URL 검색:' 뒤 링크/텍스트
    const condCell = (condCol >= 0 && condCol < cellsFallback.length)
      ? cellsFallback[condCol] : tr;
    const scope = condCell || tr;
    const aHttp = scope.querySelector('a[href^="http"], a[href*="://"]');
    if (aHttp) {
      url = (aHttp.href || aHttp.getAttribute('href') || '').trim();
    }
    if (!url) {
      const raw = (scope.innerText || scope.textContent || '');
      const m = raw.match(/URL\s*검색\s*[:：]?\s*(https?:\/\/\S+)/i);
      if (m) url = m[1].replace(/[|｜].*$/, '').trim();
    }
    if (!url) {
      const m2 = t.match(/(https?:\/\/www\.zara\.com[^\s|]+)/i)
        || t.match(/(https?:\/\/[^\s|]+)/i);
      if (m2) url = m2[1].trim();
    }
    url = url.replace(/[\)\]\>,\;]+$/, '');

    // 3) 수집조건수정 버튼 → href / ps_fuid
    const editNodes = Array.from(tr.querySelectorAll('a, button, input, span'));
    for (const el of editNodes) {
      const label = (el.value || el.textContent || '').replace(/\s+/g, '');
      if (!/수집조건수정/.test(label)) continue;
      hasEdit = true;
      if (el.tagName === 'A') {
        editHref = el.href || el.getAttribute('href') || '';
      } else if (el.closest && el.closest('a')) {
        const a = el.closest('a');
        editHref = a.href || a.getAttribute('href') || '';
      }
      if (!editHref) {
        const oc = el.getAttribute('onclick') || '';
        const hrefInOc = oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/i)
          || oc.match(/['"]([^'"]*admin_group_modify\.php[^'"]*)['"]/i);
        if (hrefInOc) editHref = hrefInOc[1];
        if (!editHref) {
          const fm = oc.match(/ps_fuid\s*=\s*(\d+)/)
            || oc.match(/modify_filter[^0-9]*(\d+)/i)
            || oc.match(/fuid["'\s:=]+(\d+)/i)
            || oc.match(/(?:go|open|modify|edit)\s*\(\s*(\d+)\s*\)/i);
          if (fm) {
            editHref = 'admin_group_modify.php?ps_mode=modify_filter&ps_fuid=' + fm[1];
          }
        }
      }
      break;
    }

    if (!url && !hasEdit && !filterName) continue;
    out.push({
      index: i,
      url,
      filterName,
      hasEdit,
      editHref,
      text: t.slice(0, 240),
    });
  }
  return out;
}"""


def list_demango_rows(page) -> list[dict]:
    """더망고 검색필터 목록 행 수집.

    스크린샷 순서·구조:
    1) 검색필터 필드값 = 열 '필터이름(수정가능)' 의 input.value (예: 여성헤어_헤어)
    2) URL = 열 '검색필터(저장조건)' 안의 'URL 검색:' 뒤 링크/텍스트
    3) 수집조건수정 = 같은 영역 버튼/링크 (href 또는 ps_fuid)
    """
    data = page.evaluate(LIST_DEMANGO_ROWS_JS)
    return list(data or [])


def click_edit_on_row(page, row_index: int, edit_href: str = "") -> bool:
    """수집조건수정 — 가능하면 수정 페이지로 직접 이동, 아니면 행 버튼 클릭.

    새 팝업/탭이 열리면 context 에 남기고, 이후 resolve_modify_target 이 잡는다.
    """
    href = (edit_href or "").strip()
    if href:
        try:
            if href.startswith("http"):
                page.goto(href, wait_until="domcontentloaded", timeout=60_000)
            else:
                page.evaluate("""(h) => { location.href = h; }""", href)
                page.wait_for_load_state("domcontentloaded", timeout=60_000)
            time.sleep(0.6)
            return True
        except Exception:
            pass

    before_pages = []
    try:
        before_pages = list(page.context.pages)
    except Exception:
        before_pages = [page]

    ok = bool(
        page.evaluate(
            """(idx) => {
              const trs = document.querySelectorAll('table tr, form tr, tr');
              const tr = trs[idx];
              if (!tr) return false;
              const nodes = Array.from(tr.querySelectorAll('a, button, span, input'));
              for (const el of nodes) {
                const t = (el.value || el.textContent || '').replace(/\\s+/g, '');
                if (/수집조건수정/.test(t)) {
                  el.click();
                  return true;
                }
              }
              return false;
            }""",
            row_index,
        )
    )
    if not ok:
        return False

    time.sleep(0.7)
    # 새 팝업/탭?
    try:
        for p in page.context.pages:
            if p not in before_pages:
                try:
                    p.wait_for_load_state("domcontentloaded", timeout=15_000)
                except Exception:
                    pass
                time.sleep(0.3)
                return True
    except Exception:
        pass

    try:
        page.wait_for_load_state("domcontentloaded", timeout=15_000)
    except Exception:
        pass
    return True


def set_save_count(
    page,
    value: int,
    *,
    shot_dir: Path | None = None,
    progress: ProgressFn | None = None,
    row_no: int = 0,
) -> bool:
    """저장상품수 입력칸: 현재 숫자(스크린샷의 '3')가 있는 칸을 찾아 상품수값으로 대체.

    UI: 저장상품수 | 검색결과 상위 [ 3 ] 개 상품만 저장
    1) value가 '3'(또는 숫자)인 input 을 찾음
    2) 그 칸의 값을 상품수(target)로 덮어씀
    """
    target = str(int(value))

    work, kind = resolve_modify_target(page)
    wait_for_save_count_ready(work, timeout_ms=8_000)

    # ★요건: 숫자 "3" 이 들어있는 칸 우선 탐색
    loc = find_save_count_locator(work, prefer_value="3")
    shot_page = page if kind == "frame" else work

    before_val = ""
    if loc is not None:
        try:
            before_val = (loc.input_value(timeout=500) or "").strip()
        except Exception:
            before_val = ""
        _log(
            progress,
            "로직",
            f"3) 저장상품수 칸 발견 현재값={before_val or '?'} → 상품수값={target}",
        )
        if shot_dir is not None:
            screenshot_save_count_grid(
                shot_page,
                loc,
                shot_dir,
                tag="before",
                row_no=row_no,
                note=f"현재값={before_val or '?'}",
                progress=progress,
            )

    def _replace_value(el) -> bool:
        """기존 숫자(3 등)를 지우고 상품수값으로 대체 입력."""
        try:
            el.scroll_into_view_if_needed(timeout=1500)
        except Exception:
            pass
        try:
            el.click(timeout=1500, force=True)
        except Exception:
            try:
                el.focus()
            except Exception:
                pass
        # 전체 선택 후 삭제 → 새 값 입력 (자동완성 대비 Escape)
        for key in ("Control+a", "Meta+a"):
            try:
                el.press(key)
                break
            except Exception:
                continue
        try:
            el.press("Backspace")
        except Exception:
            pass
        try:
            el.fill("")
        except Exception:
            pass
        try:
            el.type(target, delay=30)
        except Exception:
            try:
                el.fill(target)
            except Exception:
                return False
        # 브라우저 자동완성(30/3/35) 닫기
        try:
            el.press("Escape")
        except Exception:
            pass
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        time.sleep(0.15)
        try:
            got = (el.input_value(timeout=800) or "").strip()
            if got == target:
                return True
        except Exception:
            pass
        # JS 강제 대체
        try:
            ok = bool(
                el.evaluate(
                    """(el, want) => {
                      el.focus();
                      el.value = '';
                      el.value = String(want);
                      el.dispatchEvent(new Event('input', {bubbles:true}));
                      el.dispatchEvent(new Event('change', {bubbles:true}));
                      el.blur();
                      return (el.value || '').trim() === String(want);
                    }""",
                    target,
                )
            )
            return ok
        except Exception:
            return False

    filled = False
    if loc is not None and _replace_value(loc):
        filled = True
    else:
        # JS: value==='3' 인 칸을 우선 찾아 상품수값으로 대체
        try:
            filled = bool(
                work.evaluate(
                    """(n) => {
                      const want = String(n);
                      const isNumInput = (inp) => {
                        if (!inp) return false;
                        const ty = (inp.getAttribute('type') || 'text').toLowerCase();
                        if (!(ty === 'text' || ty === 'number' || ty === '')) return false;
                        if (inp.disabled || inp.readOnly) return false;
                        return true;
                      };
                      const setVal = (inp) => {
                        inp.focus();
                        try { inp.select(); } catch (e) {}
                        inp.value = '';
                        inp.value = want;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                        try { inp.blur(); } catch (e) {}
                        return (inp.value || '').trim() === want;
                      };
                      const inSaveRow = (inp) => {
                        const tr = inp.closest('tr');
                        const scope = tr || inp.closest('td,div,li') || inp.parentElement;
                        const t = ((scope && scope.innerText) || '').replace(/\\s+/g, '');
                        return t.includes('저장상품수')
                          || (t.includes('검색결과') && t.includes('상위'))
                          || t.includes('개상품만저장')
                          || (t.includes('상위') && t.includes('개'));
                      };
                      const all = Array.from(document.querySelectorAll(
                        'input[type="text"], input[type="number"], input:not([type])'
                      )).filter(isNumInput);

                      // 1) 정확히 value==='3' 이고 저장상품수 문맥
                      let pick = all.find(i => (i.value || '').trim() === '3' && inSaveRow(i));
                      // 2) value==='3' (문맥 느슨)
                      if (!pick) pick = all.find(i => (i.value || '').trim() === '3');
                      // 3) 저장상품수 행의 숫자 value
                      if (!pick) pick = all.find(i => inSaveRow(i) && /^\\d+$/.test((i.value || '').trim()));
                      // 4) 저장상품수 행 첫 숫자 input
                      if (!pick) pick = all.find(i => inSaveRow(i));
                      if (pick) return setVal(pick);
                      return false;
                    }""",
                    int(value),
                )
            )
        except Exception:
            filled = False
        if filled:
            loc = find_save_count_locator(work, prefer_value=target)

    if filled and loc is not None and shot_dir is not None:
        after_val = target
        try:
            after_val = (loc.input_value(timeout=500) or "").strip() or target
        except Exception:
            pass
        _log(
            progress,
            "로직",
            f"3) 저장상품수 대체완료 {before_val or '3'} → {after_val}",
        )
        screenshot_save_count_grid(
            shot_page,
            loc,
            shot_dir,
            tag="after",
            row_no=row_no,
            note=f"{before_val or '3'}→{after_val}",
            progress=progress,
        )

    if not filled:
        screenshot_step(
            page,
            shot_dir,
            step_tag="03_save_count_not_found",
            label="3)저장상품수(값3) 칸 미검출/대체실패",
            row_no=row_no,
            progress=progress,
        )

    return filled


def new_shot_dir() -> Path:
    """P3 실행별 스크린샷 폴더."""
    ts = time.strftime("%Y%m%d_%H%M%S")
    d = P3_RUN_LOG_DIR / ts
    d.mkdir(parents=True, exist_ok=True)
    return d


def find_save_count_locator(page, prefer_value: str = "3"):
    """저장상품수 숫자 입력칸 — 우선 현재값이 prefer_value(기본 '3')인 input.

    스크린샷: 검색결과 상위 [ 3 ] 개 상품만 저장
    """
    prefer = (prefer_value or "3").strip()

    # 0) JS로 value===prefer (문맥: 저장상품수/상위/개) 인 요소 핸들
    try:
        handle = page.evaluate_handle(
            """(prefer) => {
              const isNumInput = (inp) => {
                if (!inp) return false;
                const ty = (inp.getAttribute('type') || 'text').toLowerCase();
                if (!(ty === 'text' || ty === 'number' || ty === '')) return false;
                if (inp.disabled || inp.readOnly) return false;
                return true;
              };
              const inCtx = (inp) => {
                const tr = inp.closest('tr');
                const scope = tr || inp.closest('td,div') || inp.parentElement;
                const t = ((scope && scope.innerText) || '').replace(/\\s+/g, '');
                return t.includes('저장상품수')
                  || (t.includes('검색결과') && t.includes('상위'))
                  || (t.includes('상위') && t.includes('개'));
              };
              const all = Array.from(document.querySelectorAll(
                'input[type="text"], input[type="number"], input:not([type])'
              )).filter(isNumInput);
              return all.find(i => (i.value || '').trim() === String(prefer) && inCtx(i))
                || all.find(i => (i.value || '').trim() === String(prefer))
                || all.find(i => inCtx(i) && /^\\d+$/.test((i.value || '').trim()))
                || all.find(i => inCtx(i))
                || null;
            }""",
            prefer,
        )
        el = handle.as_element()
        if el is not None:
            # ElementHandle → Locator 대신 직접 쓰기 위해 wrapper
            # Playwright: page.locator로 재검색이 더 안정적
            pass
    except Exception:
        handle = None
        el = None

    # 1) value=prefer 정확 매칭 (저장상품수 행)
    try:
        loc = page.locator(
            "xpath=//tr[.//text()[contains(.,'저장상품수')] or "
            ".//*[contains(normalize-space(.),'저장상품수')]]"
            f"//input[(@type='text' or @type='number' or not(@type)) and @value='{prefer}']"
        ).first
        if loc.count() > 0 and loc.is_visible(timeout=400):
            return loc
    except Exception:
        pass

    # 2) '검색결과 상위' 셀 안 value=prefer
    try:
        loc = page.locator(
            "xpath=//td[contains(.,'검색결과') and contains(.,'상위') and contains(.,'개')]"
            f"//input[(@type='text' or @type='number' or not(@type)) and @value='{prefer}']"
        ).first
        if loc.count() > 0 and loc.is_visible(timeout=400):
            return loc
    except Exception:
        pass

    # 3) 화면에 보이는 input 중 value가 prefer 인 것 (런타임 value)
    try:
        cands = page.locator(
            'input[type="text"], input[type="number"], input:not([type])'
        )
        n = min(cands.count(), 40)
        for i in range(n):
            el = cands.nth(i)
            try:
                if not el.is_visible(timeout=150):
                    continue
                v = (el.input_value(timeout=200) or "").strip()
                if v != prefer:
                    continue
                # 부모 텍스트에 상위/개 있으면 채택
                ok_ctx = el.evaluate(
                    """(el) => {
                      const tr = el.closest('tr');
                      const t = ((tr && tr.innerText) || el.parentElement?.innerText || '')
                        .replace(/\\s+/g, '');
                      return t.includes('저장상품수')
                        || (t.includes('상위') && t.includes('개'))
                        || t.includes('검색결과');
                    }"""
                )
                if ok_ctx:
                    return el
            except Exception:
                continue
    except Exception:
        pass

    # 4) 기존 폴백: 저장상품수 행의 숫자 input
    selectors = (
        "xpath=//td[contains(.,'검색결과') and contains(.,'상위') and contains(.,'개')]"
        "//input[@type='text' or @type='number' or not(@type)]",
        "xpath=//tr[.//th[contains(normalize-space(.),'저장상품수')] or "
        ".//td[normalize-space()='저장상품수'] or "
        ".//td[starts-with(normalize-space(.),'저장상품수')] or "
        ".//*[contains(normalize-space(.),'저장상품수')]]"
        "//input[@type='text' or @type='number' or not(@type)]",
        "xpath=//*[contains(normalize-space(.),'개 상품만 저장')]"
        "/preceding::input[@type='text' or @type='number' or not(@type)][1]",
    )
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            if not loc.is_visible(timeout=400):
                continue
            try:
                v = (loc.input_value(timeout=300) or "").strip()
                if v and not re.fullmatch(r"\d+", v):
                    if len(v) > 8 or "http" in v.lower():
                        continue
            except Exception:
                pass
            return loc
        except Exception:
            continue
    return None


def resolve_modify_target(page):
    """검색필터 수정(저장상품수) 화면이 열린 page/frame 을 찾는다.

    팝업 창·iframe 모두 탐색. (page, kind) 반환. 없으면 (page, 'main').
    """
    candidates = []
    try:
        for p in page.context.pages:
            candidates.append(("page", p))
    except Exception:
        candidates.append(("page", page))

    # 현재 page 를 앞에
    ordered = [("page", page)]
    for kind, p in candidates:
        if p is not page:
            ordered.append((kind, p))

    for kind, p in ordered:
        try:
            url = p.url or ""
            if "modify_filter" in url or "admin_group_modify" in url:
                return p, kind
        except Exception:
            pass
        try:
            body = p.locator("body").inner_text(timeout=400) or ""
            if "저장상품수" in body and (
                "검색필터 수정" in body or "검색결과" in body or "저장하기" in body
            ):
                return p, kind
        except Exception:
            pass
        # frames
        try:
            for fr in p.frames:
                try:
                    t = fr.inner_text("body", timeout=300) or ""
                except Exception:
                    continue
                if "저장상품수" in t and ("검색결과" in t or "저장하기" in t):
                    return fr, "frame"
        except Exception:
            pass
    return page, "main"


def wait_for_save_count_ready(target, *, timeout_ms: int = 8000) -> bool:
    """저장상품수 입력칸이 보일 때까지 대기."""
    end = time.time() + timeout_ms / 1000.0
    while time.time() < end:
        try:
            # Page or Frame both have locator
            if find_save_count_locator(target) is not None:
                return True
        except Exception:
            pass
        try:
            body = ""
            if hasattr(target, "locator"):
                body = target.locator("body").inner_text(timeout=300) or ""
            if "저장상품수" in body or "개 상품만 저장" in body:
                # 문구는 있는데 locator 실패 — 한 번 더 여유
                time.sleep(0.3)
                if find_save_count_locator(target) is not None:
                    return True
        except Exception:
            pass
        time.sleep(0.25)
    return find_save_count_locator(target) is not None


def screenshot_step(
    page,
    shot_dir: Path | None,
    *,
    step_tag: str,
    label: str,
    row_no: int = 0,
    progress: ProgressFn | None = None,
    full_page: bool = False,
) -> Path | None:
    """필터 일치 행의 단계 스크린샷 → 실행 로그에 출력.

    ★타임아웃을 짧게(5초) 잡아 샷 실패가 본 작업(저장상품수 입력)을
    30초씩 막지 않도록 한다.
    """
    if shot_dir is None:
        return None
    shot_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^\w\-]+", "_", step_tag)[:48]
    name = f"r{row_no:03d}_{safe}.png"
    path = shot_dir / name
    try:
        time.sleep(0.08)
        page.screenshot(
            path=str(path),
            full_page=bool(full_page),
            timeout=5_000,
            animations="disabled",
        )
        if not (path.is_file() and path.stat().st_size > 0):
            return None
    except Exception as e:  # noqa: BLE001
        short = str(e).split("\n")[0][:140]
        _log(progress, "샷", f"[샷 실패] {label}: {short}")
        return None

    _log(progress, "샷", f"{label} -> {path}")
    print(f"{P3_SHOT_MARK}{path}##{label}", flush=True)
    return path


def screenshot_save_count_grid(
    page,
    loc,
    shot_dir: Path,
    *,
    tag: str,
    row_no: int = 0,
    note: str = "",
    progress: ProgressFn | None = None,
) -> Path | None:
    """판단한 저장상품수 입력그리드(행) 근접 스크린샷 → 로그 출력."""
    shot_dir.mkdir(parents=True, exist_ok=True)
    safe_tag = re.sub(r"[^\w\-]+", "_", tag)[:40]
    name = f"r{row_no:03d}_save_count_{safe_tag}.png"
    path = shot_dir / name
    label = f"저장상품수 입력그리드/{tag}"
    if note:
        label = f"{label} ({note})"

    ok = False
    try:
        row = loc.locator("xpath=ancestor::tr[1]")
        if row.count() > 0:
            row.first.scroll_into_view_if_needed(timeout=1500)
            time.sleep(0.1)
            row.first.screenshot(path=str(path), timeout=5_000, animations="disabled")
            ok = path.is_file() and path.stat().st_size > 0
    except Exception:
        ok = False

    if not ok:
        try:
            loc.scroll_into_view_if_needed(timeout=1500)
            box = loc.bounding_box()
            if box:
                pad_l, pad_r, pad_y = 160, 220, 28
                clip = {
                    "x": max(0, box["x"] - pad_l),
                    "y": max(0, box["y"] - pad_y),
                    "width": max(80, box["width"] + pad_l + pad_r),
                    "height": max(40, box["height"] + pad_y * 2),
                }
                page.screenshot(
                    path=str(path),
                    clip=clip,
                    timeout=5_000,
                    animations="disabled",
                )
                ok = path.is_file() and path.stat().st_size > 0
        except Exception:
            ok = False

    if not ok:
        try:
            page.screenshot(
                path=str(path),
                timeout=5_000,
                animations="disabled",
            )
            ok = path.is_file()
        except Exception as e:  # noqa: BLE001
            short = str(e).split("\n")[0][:140]
            _log(progress, "샷", f"[샷 실패] {label}: {short}")
            return None

    if not ok:
        return None

    _log(progress, "샷", f"{label} -> {path}")
    print(f"{P3_SHOT_MARK}{path}##{label}", flush=True)
    return path


def click_save_button(page) -> bool:
    """검색필터 수정 화면 하단 '저장하기' (옆에 '닫기')."""
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
              const nodes = Array.from(document.querySelectorAll('a,button,input'));
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


def attach_native_dialog_handler(page) -> dict:
    """브라우저 alert/confirm 대비 — '수정되었습니다' 등 네이티브 다이얼로그 accept.

    저장하기 클릭 *전에* 등록해야 한다.
    """
    state: dict = {"seen": False, "message": "", "accepted": False}

    def _on_dialog(dialog) -> None:  # noqa: ANN001
        try:
            state["seen"] = True
            state["message"] = dialog.message or ""
            dialog.accept()
            state["accepted"] = True
        except Exception:
            try:
                dialog.dismiss()
            except Exception:
                pass

    try:
        page.on("dialog", _on_dialog)
    except Exception:
        pass
    return state


def is_modify_page_open(page) -> bool:
    """검색필터 수정 팝업/페이지가 열려 있는지."""
    try:
        url = page.url or ""
        if "modify_filter" in url or "admin_group_modify" in url:
            return True
    except Exception:
        pass
    try:
        body = page.locator("body").inner_text(timeout=400) or ""
        if "검색필터 수정" in body and "저장상품수" in body:
            return True
        if "저장상품수" in body and "검색결과" in body and "저장하기" in body:
            return True
    except Exception:
        pass
    return False


def wait_modify_page_closed(page, *, timeout_ms: int = 20000) -> bool:
    """저장하기 후 '검색필터 수정' 팝업/페이지 닫힘 확인."""
    end = time.time() + timeout_ms / 1000.0
    # 잠깐은 열려 있을 수 있음 — 닫힐 때까지 대기
    while time.time() < end:
        if not is_modify_page_open(page):
            return True
        # 수정되었습니다 팝업이 뜨면 수정화면은 사실상 닫힌 것으로 본다
        try:
            body = page.locator("body").inner_text(timeout=300) or ""
            if "수정되었습니다" in body or "수정 되었습니다" in body:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return not is_modify_page_open(page)


def click_modified_confirm(page, *, timeout_ms: int = 20000, dialog_state: dict | None = None) -> bool:
    """'수정되었습니다' 팝업에서 '확인' 버튼을 반드시 클릭.

    - 네이티브 alert: attach_native_dialog_handler 가 이미 accept
    - HTML 레이어/모달: '확인' 버튼 클릭
    """
    end = time.time() + timeout_ms / 1000.0

    # 1) 네이티브 다이얼로그가 이미 처리된 경우
    if dialog_state and dialog_state.get("accepted"):
        msg = str(dialog_state.get("message") or "")
        if (not msg) or ("수정" in msg) or ("완료" in msg) or ("저장" in msg):
            return True

    while time.time() < end:
        if dialog_state and dialog_state.get("accepted"):
            return True

        # 2) HTML 팝업: '수정되었습니다' 근처의 '확인'
        try:
            ok = page.evaluate(
                """() => {
                  const bodyText = (document.body && document.body.innerText) || '';
                  const hasMsg = /수정\\s*되었습니다|수정되었습니다/.test(bodyText);
                  const nodes = Array.from(document.querySelectorAll(
                    'button, a, input[type="button"], input[type="submit"], input[type="image"]'
                  ));
                  // 정확히 '확인' 우선
                  for (const el of nodes) {
                    const t = ((el.value || el.innerText || el.textContent || '') + '')
                      .replace(/\\s+/g, '');
                    if (t !== '확인') continue;
                    // 메시지 보이거나, alert 레이어 안이면 클릭
                    const scope = el.closest(
                      '.ui-dialog, .modal, .layer, .popup, .alert, [role="dialog"], form, body'
                    );
                    const scopeText = ((scope && scope.innerText) || bodyText);
                    if (hasMsg || /수정\\s*되었습니다|수정되었습니다/.test(scopeText)) {
                      el.click();
                      return true;
                    }
                  }
                  // 폴백: 화면에 수정되었습니다가 보이면 첫 '확인' 클릭
                  if (hasMsg) {
                    for (const el of nodes) {
                      const t = ((el.value || el.innerText || el.textContent || '') + '')
                        .replace(/\\s+/g, '');
                      if (t === '확인') { el.click(); return true; }
                    }
                  }
                  return false;
                }"""
            )
            if ok:
                time.sleep(0.3)
                return True
        except Exception:
            pass

        # 3) Playwright locator 폴백
        try:
            msg = page.locator("text=수정되었습니다").first
            if msg.count() > 0 and msg.is_visible(timeout=200):
                for sel in (
                    'button:has-text("확인")',
                    'input[type="button"][value="확인"]',
                    'input[value="확인"]',
                    'a:has-text("확인")',
                ):
                    loc = page.locator(sel).last
                    if loc.count() > 0 and loc.is_visible(timeout=200):
                        loc.click(timeout=2000, force=True)
                        time.sleep(0.3)
                        return True
        except Exception:
            pass

        time.sleep(0.25)

    # 마지막: 다이얼로그만 처리됐고 메시지가 비어있어도(일부 브라우저) 통과
    if dialog_state and dialog_state.get("accepted"):
        return True
    return False


def wait_modify_page(page, *, timeout_ms: int = 20000) -> bool:
    """수집조건수정 후 '검색필터 수정' / 저장상품수 화면 대기.

    팝업 창·iframe 포함.
    """
    end = time.time() + timeout_ms / 1000.0
    while time.time() < end:
        try:
            target, kind = resolve_modify_target(page)
            url = ""
            try:
                url = getattr(target, "url", None) or page.url or ""
            except Exception:
                url = page.url or ""
            if "modify_filter" in url or "admin_group_modify" in url:
                return True
            if kind in ("page", "frame") and kind != "main":
                # resolve 가 저장상품수 화면을 찾음
                if wait_for_save_count_ready(target, timeout_ms=500):
                    return True
            body = ""
            try:
                body = page.locator("body").inner_text(timeout=400) or ""
            except Exception:
                pass
            if "저장상품수" in body and (
                "검색필터 수정" in body or "검색결과" in body
            ):
                return True
            # 다른 탭/팝업
            try:
                for p in page.context.pages:
                    if p is page:
                        continue
                    bu = p.url or ""
                    if "modify_filter" in bu or "admin_group_modify" in bu:
                        return True
                    bt = p.locator("body").inner_text(timeout=300) or ""
                    if "저장상품수" in bt:
                        return True
            except Exception:
                pass
        except Exception:
            pass
        time.sleep(0.25)
    target, _kind = resolve_modify_target(page)
    return wait_for_save_count_ready(target, timeout_ms=800)


def _return_to_list(page, list_url: str) -> None:
    """저장 후 검색필터 목록으로 복귀."""
    url = (list_url or "").strip()
    if not url:
        return
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        time.sleep(0.5)
    except Exception:
        try:
            page.go_back(wait_until="domcontentloaded", timeout=30_000)
            time.sleep(0.4)
        except Exception:
            pass


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
            shot_dir = new_shot_dir()
            _log(progress, "준비", f"스크린샷 폴더: {shot_dir}")

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
                edit_href = (drow.get("editHref") or "").strip()
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

                # ★필터 일치 시 모든 단계 스크린샷
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="01_matched_list",
                    label=f"1)필터일치 목록행 filter={d_filter}",
                    row_no=i,
                    progress=progress,
                )

                # 목록에 있는지 확인 (이전 저장 후 복귀)
                try:
                    cur = page.url or ""
                    if "modify_filter" in cur or "admin_group_modify" in cur:
                        _return_to_list(page, mango)
                except Exception:
                    pass

                # 2) 수집조건수정
                lg.step("로직", "2) 수집조건수정 클릭", "2) 조건수정")
                if not click_edit_on_row(page, row_idx, edit_href):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 수집조건수정 클릭 실패")
                    screenshot_step(
                        page,
                        shot_dir,
                        step_tag="02_edit_fail",
                        label="2)수집조건수정 실패",
                        row_no=i,
                        progress=progress,
                    )
                    _return_to_list(page, mango)
                    continue
                if not wait_modify_page(page):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 검색필터 수정 화면 미진입")
                    screenshot_step(
                        page,
                        shot_dir,
                        step_tag="02_modify_missing",
                        label="2)검색필터수정 미진입",
                        row_no=i,
                        progress=progress,
                    )
                    _return_to_list(page, mango)
                    continue
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="02_modify_opened",
                    label="2)검색필터 수정 화면",
                    row_no=i,
                    progress=progress,
                )

                # 3) 저장상품수 갱신 (입력그리드 before/after 샷 포함)
                target = map_save_count(ex.collectible)
                lg.step(
                    "로직",
                    f"3) 저장상품수 갱신 — 수집가능={ex.collectible} → 저장상품수={target}",
                    f"3) 저장상품수={target}",
                )
                if not set_save_count(
                    page,
                    target,
                    shot_dir=shot_dir,
                    progress=progress,
                    row_no=i,
                ):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 저장상품수 입력칸 실패")
                    screenshot_step(
                        page,
                        shot_dir,
                        step_tag="03_save_count_fail",
                        label="3)저장상품수 입력 실패",
                        row_no=i,
                        progress=progress,
                    )
                    try:
                        page.keyboard.press("Escape")
                    except Exception:
                        pass
                    _return_to_list(page, mango)
                    continue
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="03_save_count_done",
                    label=f"3)저장상품수 입력완료={target}",
                    row_no=i,
                    progress=progress,
                )

                # 4) 저장하기 → 팝업 닫힘 → "수정되었습니다" 확인 클릭
                dialog_state = attach_native_dialog_handler(page)
                lg.step("로직", "4) 팝업 하단 저장하기 클릭", "4) 저장하기")
                if not click_save_button(page):
                    result.failed += 1
                    _log(progress, "오류", f"행{i} 저장하기 클릭 실패")
                    screenshot_step(
                        page,
                        shot_dir,
                        step_tag="04_save_click_fail",
                        label="4)저장하기 클릭 실패",
                        row_no=i,
                        progress=progress,
                    )
                    _return_to_list(page, mango)
                    continue
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="04_after_save_click",
                    label="4)저장하기 클릭 후",
                    row_no=i,
                    progress=progress,
                )

                lg.step(
                    "로직",
                    "5) 검색필터 수정 팝업 닫힘 확인",
                    "5) 수정팝업 닫힘",
                )
                if not wait_modify_page_closed(page, timeout_ms=20_000):
                    _log(progress, "경고", f"행{i} 수정팝업 닫힘 대기 시간초과 — 확인 팝업 계속 시도")
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="05_modify_closed",
                    label="5)수정팝업 닫힘/확인대기",
                    row_no=i,
                    progress=progress,
                )

                lg.step(
                    "로직",
                    "6) '수정되었습니다' 팝업에서 확인 클릭",
                    "6) 수정완료 확인",
                )
                if not click_modified_confirm(
                    page, timeout_ms=20_000, dialog_state=dialog_state
                ):
                    result.failed += 1
                    _log(
                        progress,
                        "오류",
                        f"행{i} '수정되었습니다' 확인 버튼 클릭 실패",
                    )
                    screenshot_step(
                        page,
                        shot_dir,
                        step_tag="06_confirm_fail",
                        label="6)수정되었습니다 확인 실패",
                        row_no=i,
                        progress=progress,
                    )
                    _return_to_list(page, mango)
                    continue
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="06_confirm_ok",
                    label="6)수정되었습니다 확인 클릭 후",
                    row_no=i,
                    progress=progress,
                )

                result.updated += 1
                lg.step(
                    "완료",
                    f"행{i} 갱신완료 · 엑셀행{ex.excel_row} · 저장상품수={target}",
                    f"갱신OK · 저장상품수={target}",
                )

                # 다음 행을 위해 목록 복귀
                _return_to_list(page, mango)
                screenshot_step(
                    page,
                    shot_dir,
                    step_tag="07_back_to_list",
                    label="7)목록 복귀",
                    row_no=i,
                    progress=progress,
                )

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
    if result.updated > 0 or (result.ok and not result.errors):
        return 0
    if result.skipped > 0 and result.failed == 0 and not result.errors:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
