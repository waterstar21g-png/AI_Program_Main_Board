"""
P1_101 상품수 추출

엑셀(URL 주소 포함)을 읽어 각 URL을 브라우저로 열고,
팝업을 닫은 뒤 3초 대기 → 화면에 노출된 상품수를 수집하여
동일 엑셀 파일에 UPDATE 한다.

사용법:
    python extract.py 엑셀.xlsx
    python extract.py 엑셀.xlsx --headless
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
from urllib.parse import urlparse

from openpyxl import load_workbook

# Windows cp949 콘솔 안전 출력
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass

ProgressFn = Callable[[str, str], None]

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ★요건: 팝업 닫기 후 3초 대기 → 상품수 수집
POST_POPUP_WAIT_SEC = 3.0

# 메인보드 직접실행 시 중단 플래그 (P2와 동일 패턴)
STOP_FLAG_PATH = Path(__file__).resolve().parent / ".extract_stop"

URL_HEADER_CANDIDATES = (
    "최종 카테고리 URL주소",
    "최종 카테고리 URL",
    "카테고리 URL",
    "URL주소",
    "URL",
    "url",
)
COUNT_HEADER = "총상품수"
COLLECTIBLE_HEADER = "상품수집가능개수"

# 팝업/레이어 닫기 버튼 후보 (순서대로 시도)
POPUP_CLOSE_SELECTORS = (
    'button[aria-label="Close"]',
    'button[aria-label="닫기"]',
    '[aria-label="Close"]',
    '[aria-label="닫기"]',
    'button.close',
    '.btn-close',
    '.layer-popup .close',
    '.popup .close',
    '.modal .close',
    '#popupClose',
    '.popup-close',
    '.btn_close',
    'button:has-text("닫기")',
    'a:has-text("닫기")',
    'button:has-text("닫 기")',
    'button:has-text("Close")',
    'button:has-text("동의하고 닫기")',
    'button:has-text("오늘 하루 보지 않기")',
    'button:has-text("다시 보지 않기")',
    '[class*="close-button"]',
    '[class*="CloseButton"]',
    '[data-qa-action="stay-on-store"]',
    'button:has-text("Accept")',
    'button:has-text("동의")',
    'button:has-text("수락")',
)


@dataclass
class RowJob:
    excel_row: int  # 1-based sheet row
    url: str
    label: str = ""


@dataclass
class RowResult:
    """행별 최종출력용."""

    label: str
    count: int | None  # None = 수집 실패
    url: str


@dataclass
class ExtractResult:
    ok: bool
    excel_path: str
    total: int = 0
    updated: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    rows: list[RowResult] = field(default_factory=list)


def _log(progress: ProgressFn | None, step: str, message: str) -> None:
    # 보드 서브프로세스 stdout 파싱용 — 항상 출력
    print(f"[{step}] {message}", flush=True)
    if progress:
        progress(step, message)


def format_final_output(label: str, count: int | None, url: str) -> str:
    """실행로그 최종출력 1행 — 상위 최종 카테고리명 · 상품갯수 · url."""
    name = (label or "").strip() or "(이름없음)"
    cnt = "실패" if count is None else str(count)
    return f"상위 최종 카테고리명={name} · 상품갯수={cnt} · url={url}"


def log_final_outputs(
    progress: ProgressFn | None,
    rows: list[RowResult],
    *,
    title: str = "최종출력",
) -> None:
    """수집 결과를 실행로그에 최종출력 형식으로 일괄 표시."""
    _log(progress, "최종", f"===== {title} ({len(rows)}건) =====")
    if not rows:
        _log(progress, "최종", "(출력할 행 없음)")
        return
    for r in rows:
        _log(progress, "최종", format_final_output(r.label, r.count, r.url))


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


def _parse_int_count(raw: str | int | float | None) -> int:
    if raw is None or isinstance(raw, bool):
        return 0
    if isinstance(raw, (int, float)):
        return max(0, int(raw))
    s = re.sub(r"[^\d]", "", str(raw))
    return int(s) if s else 0


# Zara 등 SPA 상품 그리드 카드
PRODUCT_CARD_SELECTORS = (
    "li.product-grid-product",
    "article.product-grid-product",
    ".product-grid-product",
    "[data-productid]",
    "[data-qa-qualifier='product-grid-product']",
    "li[class*='product-grid']",
)


def parse_product_count_from_html(html: str) -> int:
    """페이지 HTML에서 노출 상품수를 파싱한다 (A-RT · Zara · 일반 패턴)."""
    text = html or ""
    if not text:
        return 0

    # A-RT: hidden totalCount / result-cnt
    m = re.search(
        r'name=["\']totalCount["\'][^>]*value=["\']([^"\']*)["\']',
        text,
        re.I,
    )
    if m:
        n = _parse_int_count(m.group(1))
        if n:
            return n
    m = re.search(
        r'value=["\']([^"\']*)["\'][^>]*name=["\']totalCount["\']',
        text,
        re.I,
    )
    if m:
        n = _parse_int_count(m.group(1))
        if n:
            return n
    m = re.search(
        r'class=["\'][^"\']*result-cnt[^"\']*["\'][^>]*>\s*([\d,]+)',
        text,
        re.I,
    )
    if m:
        n = _parse_int_count(m.group(1))
        if n:
            return n

    # JSON / JS / JSON-LD 흔한 키 (Zara·일반)
    for pat in (
        r'"numberOfItems"\s*:\s*(\d+)',
        r'"totalCount"\s*:\s*(\d+)',
        r'"productCount"\s*:\s*(\d+)',
        r'"productsCount"\s*:\s*(\d+)',
        r'"totalProducts"\s*:\s*(\d+)',
        r'"productsTotal"\s*:\s*(\d+)',
        r'"total_count"\s*:\s*(\d+)',
        r'"resultsCount"\s*:\s*(\d+)',
        r'"resultCount"\s*:\s*(\d+)',
        r'"numProducts"\s*:\s*(\d+)',
        r'"productsTotalCount"\s*:\s*(\d+)',
    ):
        m = re.search(pat, text, re.I)
        if m:
            n = _parse_int_count(m.group(1))
            if n:
                return n

    # 화면 표기: "총 930개", "상품 930개", "930 products", "930 results"
    patterns = (
        r"총\s*상품\s*수?\s*[:：]?\s*([\d,]+)",
        r"상품\s*수\s*[:：]?\s*([\d,]+)",
        r"총\s*([\d,]+)\s*개\s*상품",
        r"총\s*([\d,]+)\s*개",
        r"상품\s*([\d,]+)\s*개",
        r"([\d,]+)\s*개\s*상품",
        r"([\d,]+)\s*products?\b",
        r"([\d,]+)\s*results?\b",
        r"([\d,]+)\s*items?\b",
        r"([\d,]+)\s*Artikel\b",
        r"([\d,]+)\s*Produkte?\b",
    )
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            n = _parse_int_count(m.group(1))
            if n:
                return n

    # Zara 등: data-productid / 상품 상세 링크(-p####.html)
    ids = set(re.findall(r'data-productid=["\'](\d+)["\']', text, flags=re.I))
    if ids:
        return len(ids)
    p_links = set(
        re.findall(
            r"https?://[^\"'\s]+?-p\d+\.html",
            text,
            flags=re.I,
        )
    )
    if not p_links:
        p_links = set(re.findall(r"/[^\"'\s]+?-p\d+\.html", text, flags=re.I))
    if p_links:
        return len(p_links)
    return 0


def _total_from_json_obj(data: object) -> int:
    """API/JSON 객체에서 총상품수 후보를 찾는다."""
    if data is None:
        return 0
    if isinstance(data, (int, float)) and not isinstance(data, bool):
        return max(0, int(data))
    if isinstance(data, list):
        # 상품 배열로 보이면 길이
        if data and isinstance(data[0], dict):
            keys = set(data[0].keys())
            if keys & {"id", "productId", "seo", "detail", "name", "price"}:
                return len(data)
        best = 0
        for item in data[:50]:
            best = max(best, _total_from_json_obj(item))
        return best
    if not isinstance(data, dict):
        return 0
    for key in (
        "totalProducts",
        "productsCount",
        "productCount",
        "totalCount",
        "numberOfItems",
        "numProducts",
        "productsTotalCount",
        "resultsCount",
    ):
        if key in data:
            n = _parse_int_count(data.get(key))
            if n:
                return n
    # productGroups / products 배열
    for key in ("products", "productGroups", "items", "results"):
        if key not in data:
            continue
        val = data[key]
        if isinstance(val, list):
            if key == "productGroups":
                ids: set[str] = set()
                for g in val:
                    if not isinstance(g, dict):
                        continue
                    for p in g.get("products") or g.get("elements") or []:
                        if isinstance(p, dict):
                            pid = p.get("id") or p.get("productId")
                            if pid is not None:
                                ids.add(str(pid))
                if ids:
                    return len(ids)
            n = len(val)
            if n and isinstance(val[0], dict):
                return n
    best = 0
    for v in list(data.values())[:40]:
        if isinstance(v, (dict, list)):
            best = max(best, _total_from_json_obj(v))
    return best


def find_header_index(headers: list[str], candidates: tuple[str, ...] | list[str]) -> int | None:
    normalized = [str(h or "").strip() for h in headers]
    lower_map = {h.lower(): i for i, h in enumerate(normalized) if h}
    for cand in candidates:
        c = cand.strip()
        if c in normalized:
            return normalized.index(c)
        if c.lower() in lower_map:
            return lower_map[c.lower()]
    return None


def ensure_column(headers: list[str], ws, header_name: str) -> int:
    """헤더에 열이 없으면 맨 끝에 추가하고 0-based index 반환."""
    idx = find_header_index(headers, (header_name,))
    if idx is not None:
        return idx
    new_idx = len(headers)
    ws.cell(row=1, column=new_idx + 1, value=header_name)
    headers.append(header_name)
    return new_idx


def read_url_jobs(ws) -> tuple[list[str], int, list[RowJob]]:
    """시트에서 헤더·URL열·작업 행 목록을 읽는다."""
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not header_row:
        raise ValueError("엑셀 헤더(1행)가 비어 있습니다.")
    headers = [str(c or "").strip() for c in header_row]
    url_idx = find_header_index(headers, URL_HEADER_CANDIDATES)
    if url_idx is None:
        # 값이 URL처럼 보이는 첫 열 탐색
        for col_i, h in enumerate(headers):
            sample = ws.cell(row=2, column=col_i + 1).value
            if isinstance(sample, str) and sample.strip().lower().startswith("http"):
                url_idx = col_i
                break
    if url_idx is None:
        raise ValueError(
            "URL 열을 찾지 못했습니다. 헤더에 "
            "'최종 카테고리 URL주소' (또는 URL) 열이 필요합니다."
        )

    label_idx = find_header_index(
        headers,
        ("상위 최종 카테고리명", "최종 카테고리명", "카테고리명"),
    )

    jobs: list[RowJob] = []
    for excel_row in range(2, ws.max_row + 1):
        raw_url = ws.cell(row=excel_row, column=url_idx + 1).value
        url = str(raw_url or "").strip()
        # http(s) · file(로컬 검증) 허용
        low = url.lower()
        if not url or not (low.startswith("http://") or low.startswith("https://") or low.startswith("file:")):
            continue
        label = ""
        if label_idx is not None:
            label = str(ws.cell(row=excel_row, column=label_idx + 1).value or "").strip()
        if label == "목차" or label.startswith("목차") or label.upper() == "TOC":
            continue
        jobs.append(RowJob(excel_row=excel_row, url=url, label=label))
    return headers, url_idx, jobs


def dismiss_popups(page) -> int:
    """URL 진입 후 팝업·레이어·추가 창을 닫는다. 닫은 횟수 반환."""
    closed = 0

    # 1) 추가 창(팝업 윈도우) 닫기 — 메인 page 제외
    try:
        main = page
        for p in list(page.context.pages):
            if p is main:
                continue
            try:
                if not p.is_closed():
                    p.close()
                    closed += 1
            except Exception:
                pass
    except Exception:
        pass

    # 2) JS dialog (alert/confirm) — 다음부터 자동 수락
    try:
        page.on("dialog", lambda d: d.dismiss())
    except Exception:
        pass

    # 3) 화면 위 닫기 버튼 클릭
    for sel in POPUP_CLOSE_SELECTORS:
        try:
            loc = page.locator(sel)
            count = loc.count()
        except Exception:
            continue
        for i in range(min(count, 3)):
            try:
                el = loc.nth(i)
                if el.is_visible(timeout=300):
                    el.click(timeout=800, force=True)
                    closed += 1
                    time.sleep(0.2)
            except Exception:
                continue

    # 4) Escape 키로 모달 닫기 시도
    try:
        page.keyboard.press("Escape")
        time.sleep(0.15)
    except Exception:
        pass

    return closed


FOOTER_SELECTORS = (
    "footer",
    "[role='contentinfo']",
    "#footer",
    ".layout-footer",
    ".footer",
    "[data-qa-qualifier='footer']",
    ".page-footer",
)

# ★요건: 푸터까지 스크롤해 총갯수 파악 (조기 중단 방지)
SCROLL_MAX_ROUNDS = 160
SCROLL_PAUSE_SEC = 1.2
SCROLL_STABLE_ROUNDS = 6  # 개수·높이 불변 연속 횟수
FOOTER_STABLE_ROUNDS = 4  # 푸터/하단 도달 연속 확인


def count_product_cards(page) -> int:
    """현재 DOM에 보이는 상품 카드/링크 개수 (가상스크롤이면 일부만)."""
    best = 0
    for sel in PRODUCT_CARD_SELECTORS:
        try:
            c = page.locator(sel).count()
            if c > best:
                best = c
        except Exception:
            continue
    try:
        n = page.evaluate(
            """() => {
              const hrefs = Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.href || '')
                .filter(h => /-p\\d+\\.html/i.test(h));
              return new Set(hrefs).size;
            }"""
        )
        best = max(best, int(n or 0))
    except Exception:
        pass
    return best


def collect_visible_product_ids(page) -> set[str]:
    """현재 화면의 상품 ID를 수집 (스크롤 누적용)."""
    try:
        ids = page.evaluate(
            """() => {
              const out = new Set();
              document.querySelectorAll('[data-productid]').forEach(el => {
                const id = el.getAttribute('data-productid');
                if (id) out.add(String(id));
              });
              document.querySelectorAll('[data-product-id]').forEach(el => {
                const id = el.getAttribute('data-product-id');
                if (id) out.add(String(id));
              });
              document.querySelectorAll('a[href]').forEach(a => {
                const h = a.href || a.getAttribute('href') || '';
                const m = h.match(/-p(\\d+)\\.html/i);
                if (m) out.add(m[1]);
              });
              return Array.from(out);
            }"""
        )
        return {str(x) for x in (ids or []) if x is not None}
    except Exception:
        return set()


def _collect_ids_from_json(data: object, out: set[str], depth: int = 0) -> None:
    if depth > 8 or data is None:
        return
    if isinstance(data, dict):
        pid = data.get("id") or data.get("productId") or data.get("product_id")
        # 상품 객체처럼 보이면 id 채택
        if pid is not None and (
            "price" in data
            or "seo" in data
            or "detail" in data
            or "name" in data
            or "brand" in data
            or "sectionName" in data
            or "productType" in data
        ):
            out.add(str(pid))
        for v in data.values():
            if isinstance(v, (dict, list)):
                _collect_ids_from_json(v, out, depth + 1)
    elif isinstance(data, list):
        for item in data[:500]:
            _collect_ids_from_json(item, out, depth + 1)


def is_near_page_bottom(page) -> bool:
    try:
        return bool(
            page.evaluate(
                """() => {
                  const el = document.scrollingElement || document.documentElement;
                  const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
                  return remain < 120;
                }"""
            )
        )
    except Exception:
        return False


def footer_in_view(page) -> bool:
    """푸터 영역이 뷰포트에 들어왔는지."""
    for sel in FOOTER_SELECTORS:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            if loc.is_visible(timeout=200):
                box = loc.bounding_box()
                if not box:
                    continue
                vh = (page.viewport_size or {}).get("height") or 900
                # 푸터 상단이 화면 하단 근처·안쪽
                if box["y"] < vh + 40:
                    return True
        except Exception:
            continue
    return is_near_page_bottom(page)


def scroll_step_toward_footer(page) -> None:
    """무한스크롤 트리거 — 작은 간격으로 내려 중간 상품을 놓치지 않게 한다."""
    try:
        page.evaluate(
            """() => {
              const el = document.scrollingElement || document.documentElement;
              // 큰 jump는 가상리스트 ID를 건너뛰므로 뷰포트의 ~55%만 이동
              const step = Math.max(420, Math.floor(window.innerHeight * 0.55));
              window.scrollBy(0, step);
              const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
              if (remain < 160) {
                window.scrollTo(0, el.scrollHeight);
              }
            }"""
        )
    except Exception:
        try:
            page.mouse.wheel(0, 900)
        except Exception:
            pass


def _page_scroll_height(page) -> int:
    try:
        return int(
            page.evaluate(
                "() => (document.scrollingElement||document.documentElement).scrollHeight"
            )
            or 0
        )
    except Exception:
        return 0


def scroll_to_footer_and_count(
    page,
    *,
    progress: ProgressFn | None = None,
    accumulated_ids: set[str] | None = None,
    max_rounds: int = SCROLL_MAX_ROUNDS,
    pause: float = SCROLL_PAUSE_SEC,
) -> int:
    """페이지 맨 하단(푸터)까지 스크롤하며 상품 ID를 누적 → 총갯수.

    - 가상스크롤로 DOM에 일부만 남아도, 스크롤 중 본 ID를 모두 합산
    - 문서 높이(scrollHeight)가 아직 늘어나면 종료하지 않음 (무한스크롤 로딩 중)
    - 푸터 도달 + 개수·높이 안정화가 모두 만족할 때만 종료
    """
    seen: set[str] = accumulated_ids if accumulated_ids is not None else set()
    prev_n = -1
    prev_h = -1
    stable = 0
    footer_hits = 0

    def log(msg: str) -> None:
        _log(progress, "스크롤", msg)

    for i in range(1, max_rounds + 1):
        seen |= collect_visible_product_ids(page)
        n = len(seen)
        h = _page_scroll_height(page)
        at_bottom = is_near_page_bottom(page)
        at_footer = at_bottom or footer_in_view(page)

        # 상품수·페이지높이가 둘 다 不动일 때만 안정으로 간주
        if n > 0 and n == prev_n and h > 0 and h == prev_h:
            stable += 1
        else:
            stable = 0
        prev_n = n
        prev_h = h

        if at_footer:
            footer_hits += 1
        else:
            footer_hits = 0

        if i == 1 or i % 5 == 0 or at_footer:
            log(
                f"{i}/{max_rounds} 누적상품={n} · 높이={h} · "
                f"푸터={'Y' if at_footer else 'N'} · 안정={stable}"
            )

        # ★푸터(맨하단) 도달 + 더 이상 상품/높이 증가 없음
        if footer_hits >= FOOTER_STABLE_ROUNDS and stable >= SCROLL_STABLE_ROUNDS:
            log(f"푸터 도달·안정화 — 총갯수 확정 누적={n}")
            break

        scroll_step_toward_footer(page)
        time.sleep(pause)
        dismiss_popups(page)

        if stop_requested():
            log(f"중단 요청 — 현재 누적={n}")
            break
    else:
        log(f"최대 스크롤 도달 — 누적={len(seen)}")

    # 하단 고정 대기 후 한 번 더 수집
    try:
        page.evaluate(
            "() => window.scrollTo(0, (document.scrollingElement||document.documentElement).scrollHeight)"
        )
    except Exception:
        pass
    time.sleep(1.5)
    dismiss_popups(page)
    seen |= collect_visible_product_ids(page)

    # 2차 패스: 놓친 구간 보완 — 맨 위→맨 아래 재스크롤(짧게)
    log(f"2차 패스(상단→하단) 시작 — 현재 누적={len(seen)}")
    try:
        page.evaluate("() => window.scrollTo(0, 0)")
    except Exception:
        pass
    time.sleep(0.5)
    for j in range(1, 41):
        seen |= collect_visible_product_ids(page)
        scroll_step_toward_footer(page)
        time.sleep(max(0.45, pause * 0.5))
        dismiss_popups(page)
        if is_near_page_bottom(page) and j > 5:
            # 하단에서 추가 로드 대기
            time.sleep(1.0)
            seen |= collect_visible_product_ids(page)
            if j >= 8:
                break
        if stop_requested():
            break

    dom_now = count_product_cards(page)
    total = max(len(seen), dom_now)
    log(f"최종 누적 ID={len(seen)} · 현재DOM={dom_now} · 채택={total}")
    return total


def extract_count_from_page(
    page,
    *,
    api_totals: list[int] | None = None,
    api_ids: set[str] | None = None,
    progress: ProgressFn | None = None,
) -> int:
    """현재 페이지에서 상품수 추출.

    ★그리드(Zara 등)는 반드시 푸터까지 스크롤한 뒤 누적 총갯수를 쓴다.
    첫 화면 HTML 개수로 조기 return 하지 않는다.
    """
    api_best = max(api_totals) if api_totals else 0
    api_id_n = len(api_ids) if api_ids else 0

    # 명시적 카운터 문구(총 N개 등) — 스크롤 전에도 신뢰 가능하면 사용
    label_count = 0
    selectors = (
        ".result-cnt",
        'input[name="totalCount"]',
        "[data-product-count]",
        "[data-total-count]",
        ".product-count",
        ".products-count",
        ".search-count",
        ".total-count",
        "[data-qa-qualifier='product-count']",
    )
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            if sel.startswith("input"):
                val = loc.get_attribute("value")
                n = _parse_int_count(val)
            else:
                attr = loc.get_attribute("data-product-count") or loc.get_attribute(
                    "data-total-count"
                )
                n = _parse_int_count(attr) if attr else _parse_int_count(loc.inner_text())
            if n:
                label_count = n
                break
        except Exception:
            continue

    cards = count_product_cards(page)
    if cards <= 0:
        try:
            page.wait_for_selector(
                ", ".join(PRODUCT_CARD_SELECTORS[:4]),
                timeout=8_000,
            )
        except Exception:
            pass
        cards = count_product_cards(page)

    page_url = ""
    try:
        page_url = page.url or ""
    except Exception:
        pass
    looks_grid = cards > 0 or "zara.com" in page_url.lower()

    if looks_grid:
        # ★요건: 푸터까지 스크롤 → 총갯수 (가상리스트 대비 ID 누적)
        acc: set[str] = set(api_ids or ())
        scrolled = scroll_to_footer_and_count(
            page, progress=progress, accumulated_ids=acc
        )
        # API total 이 페이지크기(24 등)로 올 수 있어 항상 max
        best = max(scrolled, api_best, api_id_n, label_count, cards)
        return best

    # 비그리드: HTML/문구 폴백
    try:
        html = page.content() or ""
    except Exception:
        html = ""
    n = parse_product_count_from_html(html)
    if n:
        return max(n, api_best, label_count)
    try:
        visible = page.locator("body").inner_text(timeout=2000)
        n = parse_product_count_from_html(visible)
        if n:
            return max(n, api_best, label_count)
    except Exception:
        pass
    return max(api_best, label_count, cards)


def attach_api_total_listener(page) -> tuple[list[int], set[str]]:
    """카테고리/상품 API 응답에서 total 후보 + 상품 ID 누적."""
    found: list[int] = []
    ids: set[str] = set()

    def _on_response(response) -> None:
        try:
            if response.status != 200:
                return
            url = response.url or ""
            low = url.lower()
            if not any(
                k in low
                for k in (
                    "/products",
                    "product",
                    "catalog",
                    "category",
                    "commercial",
                    "ajax=true",
                )
            ):
                return
            ctype = (response.headers or {}).get("content-type", "")
            if "json" not in ctype and "text" not in ctype and "javascript" not in ctype:
                return
            data = response.json()
            n = _total_from_json_obj(data)
            if n > 0:
                found.append(n)
            _collect_ids_from_json(data, ids)
        except Exception:
            return

    page.on("response", _on_response)
    return found, ids


def _default_headless() -> bool:
    # 로컬 Windows는 화면 확인용으로 창 표시, CI/리눅스는 headless
    return os.name != "nt"


def run_extract(
    excel_path: str | Path,
    *,
    progress: ProgressFn | None = None,
    headless: bool | None = None,
    post_popup_wait_sec: float = POST_POPUP_WAIT_SEC,
) -> ExtractResult:
    """엑셀 URL별 상품수 수집 후 동일 파일 UPDATE."""
    path = Path(excel_path).expanduser().resolve()
    result = ExtractResult(ok=False, excel_path=str(path))
    if not path.is_file():
        result.errors.append(f"파일 없음: {path}")
        return result
    if path.suffix.lower() not in {".xlsx", ".xlsm"}:
        result.errors.append("xlsx/xlsm 엑셀 파일만 지원합니다.")
        return result

    use_headless = _default_headless() if headless is None else headless
    clear_stop_flag()
    stopped = False

    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # noqa: BLE001
        result.errors.append(f"Playwright 미설치: {e}")
        return result

    try:
        wb = load_workbook(str(path))
    except Exception as e:  # noqa: BLE001
        result.errors.append(f"엑셀 열기 실패: {e}")
        return result

    ws = wb.active
    try:
        headers, _url_idx, jobs = read_url_jobs(ws)
    except Exception as e:  # noqa: BLE001
        result.errors.append(str(e))
        try:
            wb.close()
        except Exception:
            pass
        return result

    count_idx = ensure_column(headers, ws, COUNT_HEADER)
    collectible_idx = find_header_index(headers, (COLLECTIBLE_HEADER,))
    # 상품수집가능개수 열이 있으면 함께 갱신, 없으면 추가하지 않음(기존 엑셀 보존)

    result.total = len(jobs)
    _log(progress, "준비", f"엑셀: {path.name} · URL {result.total}건")
    if result.total == 0:
        result.errors.append("처리할 URL 행이 없습니다.")
        try:
            wb.close()
        except Exception:
            pass
        return result

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=use_headless)
            # Zara 영문 DE 등 — en-GB 가 차단·팝업에 유리한 경우가 많음
            context = browser.new_context(
                user_agent=DEFAULT_UA,
                viewport={"width": 1440, "height": 900},
                locale="en-GB",
            )
            page = context.new_page()
            api_totals, api_ids = attach_api_total_listener(page)

            for i, job in enumerate(jobs, start=1):
                if stop_requested():
                    stopped = True
                    _log(progress, "중단", "사용자 중단 요청 — 현재까지 UPDATE 저장")
                    break

                label = (job.label or "").strip() or urlparse(job.url).path
                _log(
                    progress,
                    "URL",
                    f"{i}/{result.total} 행{job.excel_row} 열기: {label} · {job.url}",
                )
                api_totals.clear()
                api_ids.clear()
                try:
                    page.goto(job.url, wait_until="domcontentloaded", timeout=90_000)
                except Exception as e:  # noqa: BLE001
                    result.failed += 1
                    result.rows.append(
                        RowResult(label=label, count=None, url=job.url)
                    )
                    _log(progress, "오류", f"행{job.excel_row} 접속 실패: {e}")
                    _log(
                        progress,
                        "최종",
                        format_final_output(label, None, job.url),
                    )
                    continue

                closed = dismiss_popups(page)
                if closed:
                    _log(progress, "팝업", f"행{job.excel_row} 팝업/레이어 {closed}건 닫기")
                else:
                    _log(progress, "팝업", f"행{job.excel_row} 닫을 팝업 없음(확인)")

                # ★요건: 팝업 닫기 후 3초 대기 → 상품수 수집
                _log(
                    progress,
                    "대기",
                    f"행{job.excel_row} {post_popup_wait_sec:g}초 대기 후 "
                    f"푸터까지 스크롤·총갯수 수집",
                )
                # 대기 중에도 중단 플래그 확인
                waited = 0.0
                step = 0.25
                while waited < float(post_popup_wait_sec):
                    if stop_requested():
                        stopped = True
                        break
                    time.sleep(step)
                    waited += step
                if stopped:
                    _log(progress, "중단", "사용자 중단 요청 — 현재까지 UPDATE 저장")
                    break

                # 대기 중 다시 뜬 팝업이 있으면 한 번 더 닫고, 짧게만 안정화
                closed2 = dismiss_popups(page)
                if closed2:
                    _log(progress, "팝업", f"행{job.excel_row} 추가 팝업 {closed2}건 닫기")
                    time.sleep(0.5)

                count = extract_count_from_page(
                    page,
                    api_totals=api_totals,
                    api_ids=api_ids,
                    progress=progress,
                )
                if count == 0:
                    _log(
                        progress,
                        "경고",
                        f"행{job.excel_row} 상품수 0 — 그리드/API 미검출(사이트 지연·차단 가능)",
                    )
                else:
                    _log(
                        progress,
                        "상품수",
                        f"행{job.excel_row} 푸터스크롤 누적 총갯수={count}"
                        f" (API후보={max(api_totals) if api_totals else 0}"
                        f", API_ID={len(api_ids)})",
                    )
                ws.cell(row=job.excel_row, column=count_idx + 1, value=count)
                if collectible_idx is not None:
                    ws.cell(
                        row=job.excel_row,
                        column=collectible_idx + 1,
                        value=count,
                    )
                result.updated += 1
                result.rows.append(RowResult(label=label, count=count, url=job.url))
                # ★요건: 실행로그 최종출력 = 상위 최종 카테고리명 · 상품갯수 · url
                _log(
                    progress,
                    "최종",
                    format_final_output(label, count, job.url),
                )

            browser.close()
    except Exception as e:  # noqa: BLE001
        result.errors.append(f"브라우저 실행 실패: {e}")
        try:
            wb.close()
        except Exception:
            pass
        clear_stop_flag()
        return result

    try:
        wb.save(str(path))
        wb.close()
    except Exception as e:  # noqa: BLE001
        result.errors.append(f"엑셀 저장 실패: {e}")
        clear_stop_flag()
        return result

    clear_stop_flag()
    # ★요건: 종료 시 최종출력을 상위 최종 카테고리명 · 상품갯수 · url 로 모아 표시
    log_final_outputs(progress, result.rows)

    if stopped:
        result.ok = result.updated > 0
        result.warnings.append("사용자 중단으로 일부만 UPDATE")
        _log(
            progress,
            "중단",
            f"부분 UPDATE {result.updated}/{result.total} · 파일: {path}",
        )
        return result

    result.ok = result.updated > 0 and not result.errors
    if result.updated == 0 and not result.errors:
        result.errors.append("상품수를 하나도 갱신하지 못했습니다.")
        result.ok = False
    _log(
        progress,
        "완료",
        f"UPDATE {result.updated}/{result.total} · 실패 {result.failed} · 파일: {path}",
    )
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="P1_101 상품수 추출 — 엑셀 URL UPDATE")
    parser.add_argument("excel", help="URL이 담긴 엑셀 파일 경로")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="브라우저를 숨김 모드로 실행",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="브라우저 창을 표시하며 실행",
    )
    parser.add_argument(
        "--wait",
        type=float,
        default=POST_POPUP_WAIT_SEC,
        help=f"팝업 닫기 후 대기 초 (기본 {POST_POPUP_WAIT_SEC:g})",
    )
    args = parser.parse_args(argv)

    headless: bool | None
    if args.headless:
        headless = True
    elif args.headed:
        headless = False
    else:
        headless = None

    result = run_extract(
        args.excel,
        headless=headless,
        post_popup_wait_sec=args.wait,
    )
    if not result.ok:
        for e in result.errors:
            print(f"[오류] {e}", flush=True)
        return 1
    # 보드: 부분 UPDATE(중단)도 exit 0 — 로그의 구분
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
