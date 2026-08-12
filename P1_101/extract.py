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


def parse_product_count_from_html(html: str) -> int:
    """페이지 HTML에서 노출 상품수를 파싱한다 (A-RT · 일반 패턴)."""
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

    # JSON / JS 흔한 키
    for pat in (
        r'"totalCount"\s*:\s*(\d+)',
        r'"productCount"\s*:\s*(\d+)',
        r'"totalProducts"\s*:\s*(\d+)',
        r'"productsTotal"\s*:\s*(\d+)',
        r'"total_count"\s*:\s*(\d+)',
        r'"resultsCount"\s*:\s*(\d+)',
        r'"resultCount"\s*:\s*(\d+)',
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
        r"([\d,]+)\s*Artikel\b",
        r"([\d,]+)\s*Produkte?\b",
    )
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            n = _parse_int_count(m.group(1))
            if n:
                return n
    return 0


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


def extract_count_from_page(page) -> int:
    """현재 페이지에서 상품수 추출 (DOM 텍스트 + HTML 파싱)."""
    # 우선 눈에 띄는 카운터 요소
    selectors = (
        ".result-cnt",
        'input[name="totalCount"]',
        "[data-product-count]",
        "[data-total-count]",
        ".product-count",
        ".products-count",
        ".search-count",
        ".total-count",
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
                return n
        except Exception:
            continue

    try:
        html = page.content() or ""
    except Exception:
        html = ""
    n = parse_product_count_from_html(html)
    if n:
        return n

    # 보이는 텍스트 폴백
    try:
        visible = page.locator("body").inner_text(timeout=2000)
        n = parse_product_count_from_html(visible)
        if n:
            return n
    except Exception:
        pass
    return 0


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
            context = browser.new_context(
                user_agent=DEFAULT_UA,
                viewport={"width": 1440, "height": 900},
                locale="ko-KR",
            )
            page = context.new_page()

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
                    f"행{job.excel_row} {post_popup_wait_sec:g}초 대기 후 상품수 수집",
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

                count = extract_count_from_page(page)
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
