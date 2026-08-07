"""
P2 — 더망고(tmg1898) 상품데이터 대량수집

목표: 카테고리 URL(P1 엑셀) 1행당 상품 정보 N건(기본 3)을 오류 없이 가져오기.

0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭
1. URL상품검색하기 : 필드값 입력 후 클릭 -> 팝업창이 없어질 때까지 대기
2. 검색된 상품 모두저장 클릭 -> 검색필터명·저장수 입력 -> 저장하기
3. 팝업창이 없어질 때까지 대기 + 저장 결과 확인
4. 다음 행 (실패 시 같은 행 재시도)

사용법:
    python collect.py 엑셀.xlsx              # 저장수 3
    python collect.py 엑셀.xlsx 3 --verify   # 1행 검증(샷·재시도)
    python collect.py 엑셀.xlsx 3 --retries 3 --yes
    run-verify.bat 엑셀.xlsx
"""

import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

import openpyxl
from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    TimeoutError as PWTimeout,
    sync_playwright,
)

# Windows cp949 콘솔/파이프에서 특수기호 출력 시 UnicodeEncodeError 방지
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass


def safe_print(msg: str = "", *, flush: bool = True) -> None:
    """stdout이 cp949여도 죽지 않게 출력."""
    text = "" if msg is None else str(msg)
    try:
        print(text, flush=flush)
        return
    except UnicodeEncodeError:
        pass
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    try:
        data = (text + "\n").encode(enc, errors="replace")
        sys.stdout.buffer.write(data)
        if flush:
            sys.stdout.flush()
    except Exception:
        try:
            print(text.encode("ascii", errors="replace").decode("ascii"), flush=flush)
        except Exception:
            pass

LOGIN_URL = "https://tmg1898.cafe24.com/mall/admin/admin_login.php"
MAIN_URL = "https://tmg1898.cafe24.com/mall/admin/admin.php"
BULK_URL = "https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php"
ADMIN_HOST = "tmg1898.cafe24.com"
BULK_PATH = "getGoodsNew.php"

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"
PROFILE_DIR = Path(__file__).parent / ".chrome-profile"

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/local/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
]

POPUP_WAIT_SEC = 600
MODAL_WAIT_SEC = 180
DEFAULT_SAVE_COUNT = 3
DEFAULT_ROW_RETRIES = 3

FILTER_NAME_LABEL = re.compile(r"검색\s*필터\s*명")
SAVE_COUNT_LABEL = re.compile(r"저장\s*상품\s*수|검색결과\s*상위")
# 저장 완료로 볼 수 있는 화면 문구 (망고 버전에 따라 다를 수 있음)
SAVE_OK_PATTERNS = [
    re.compile(r"저장\s*(이\s*)?(완료|성공)"),
    re.compile(r"정상\s*처리"),
    re.compile(r"상품\s*(이\s*)?저장"),
    re.compile(r"(\d+)\s*건\s*(이\s*)?저장"),
]
SAVE_FAIL_PATTERNS = [
    re.compile(r"저장\s*실패"),
    re.compile(r"오류\s*가\s*발생"),
    re.compile(r"다시\s*시도"),
]

SHOT_ROOT = Path(__file__).parent / "run-logs"

# 현재 실행 컨텍스트(로그인 등 단계 샷을 같은 폴더에 모으기)
_ACTIVE_CTX: "RunCtx | None" = None

# 파일명 태그 → 한글 단계명 (갤러리/보드 표시용)
SHOT_STEP_LABELS: dict[str, str] = {
    "login_wait": "로그인 대기(창 표시)",
    "login_ok": "로그인 완료",
    "login_gate": "로그인 게이트",
    "login_required": "세션만료·재로그인",
    "ready": "준비완료(대량수집 진입)",
    "00_init_bulk": "0. 초기화 — 대량데이터수집",
    "01_url_filled": "1. URL 입력 완료",
    "01_popup_missing": "1. 검색 팝업 미표시(오류)",
    "01_popup_opened": "1. 검색 팝업 열림",
    "01_popup_closed": "1. 검색 팝업 닫힘",
    "01_results_ready": "1. 검색 결과 준비",
    "02_save_modal": "2. 모두저장 모달",
    "02_no_count_field": "2. 저장수 필드 없음(오류)",
    "02_count_mismatch": "2. 저장수 불일치(오류)",
    "02_modal_filled": "2. 필터명·저장수 입력",
    "03_modal_stuck": "3. 저장 모달 미종료(오류)",
    "03_modal_closed": "3. 저장 모달 닫힘",
    "04_row_done": "4. 행 완료",
}

# 사용자 수동 로그인 대기 제한 (초)
LOGIN_WAIT_SEC = 600


def log(msg: str) -> None:
    safe_print(f"[{time.strftime('%H:%M:%S')}] {msg}")


class RunCtx:
    """행 단위 수집·재시도·스크린샷용 실행 컨텍스트

    shot_first_n: 입력 데이터 앞 N건(기본 2=1·2행)만 단계별 스크린샷.
    """

    def __init__(
        self,
        *,
        save_count: int = DEFAULT_SAVE_COUNT,
        retries: int = DEFAULT_ROW_RETRIES,
        verify: bool = False,
        max_rows: int | None = None,
        batch: bool = False,
        shot_dir: Path | None = None,
        shot_first_n: int = 2,
    ) -> None:
        global _ACTIVE_CTX
        self.save_count = save_count
        self.retries = max(1, retries)
        self.verify = verify
        self.max_rows = max_rows
        self.batch = batch or verify  # 검증 모드는 기본 무중단
        self.shot_first_n = max(0, int(shot_first_n))
        stamp = time.strftime("%Y%m%d_%H%M%S")
        self.shot_dir = shot_dir or (SHOT_ROOT / stamp)
        self.shot_dir.mkdir(parents=True, exist_ok=True)
        self.step_i = 0
        self.shots: list[dict] = []
        self._gallery_written = False
        self.input_ordinal = 0  # 처리 중인 입력 순서(1부터)
        self.current_label = ""
        self.current_url = ""
        self.log_path = self.shot_dir / "run.log"
        self._log_file = open(self.log_path, "a", encoding="utf-8")
        _ACTIVE_CTX = self
        self.info(f"[샷폴더] {self.shot_dir}")
        if self.shot_first_n > 0:
            self.info(f"[샷대상] 입력 데이터 1~{self.shot_first_n}행 단계별 스크린샷")

    def begin_row(self, ordinal: int, row: dict) -> None:
        """행 처리 시작 — 로그에 카테고리명·URL 기록."""
        self.input_ordinal = ordinal
        self.current_label = str(row.get("label") or "").strip()
        self.current_url = str(row.get("url") or "").strip()
        excel_row = row.get("row", "?")
        self.info(
            f"--- 입력#{ordinal} 엑셀{excel_row}행 | "
            f"상위 최종 카테고리명={self.current_label} | "
            f"최종 카테고리 URL주소={self.current_url} ---"
        )

    def wants_row_shot(self, row_no: int | None = None) -> bool:
        """공통(로그인 등 row_no=0) 또는 입력 1~N행만 샷."""
        if row_no in (None, 0):
            return True
        return 0 < self.input_ordinal <= self.shot_first_n

    def close(self) -> None:
        global _ACTIVE_CTX
        try:
            self.write_gallery()
        except Exception as e:  # noqa: BLE001
            try:
                self.info(f"  [갤러리 작성 실패] {e}")
            except Exception:
                pass
        try:
            self._log_file.close()
        except Exception:
            pass
        if _ACTIVE_CTX is self:
            _ACTIVE_CTX = None

    def info(self, msg: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {msg}"
        safe_print(line)
        try:
            self._log_file.write(line + "\n")
            self._log_file.flush()
        except Exception:
            pass

    @staticmethod
    def label_for_tag(tag: str) -> str:
        if tag in SHOT_STEP_LABELS:
            return SHOT_STEP_LABELS[tag]
        for key, label in SHOT_STEP_LABELS.items():
            if key in tag:
                return label
        if tag.startswith("fail_attempt"):
            return f"실패 시도 {tag.replace('fail_attempt', '')}"
        return tag

    def shot(self, page: Page, tag: str, row_no: int | None = None) -> Path | None:
        if not self.wants_row_shot(row_no):
            return None
        self.step_i += 1
        safe = re.sub(r"[^\w\-가-힣]+", "_", tag)[:40]
        ord_part = f"i{self.input_ordinal}" if self.input_ordinal else "i0"
        name = f"{self.step_i:02d}_{ord_part}_r{row_no or 0}_{safe}.png"
        path = self.shot_dir / name
        label = self.label_for_tag(tag)
        try:
            page.screenshot(path=str(path), full_page=True)
            self.shots.append(
                {
                    "step": self.step_i,
                    "ordinal": self.input_ordinal,
                    "row": row_no or 0,
                    "tag": tag,
                    "label": label,
                    "category": self.current_label,
                    "url": self.current_url,
                    "file": name,
                    "path": str(path),
                }
            )
            extra = ""
            if self.current_label or self.current_url:
                extra = f" | {self.current_label} | {self.current_url}"
            self.info(f"  [샷] {self.step_i:02d}. {label} -> {path.name}{extra}")
            return path
        except Exception as e:  # noqa: BLE001
            self.info(f"  [샷 실패] {label}: {e}")
            return None

    def write_gallery(self) -> Path | None:
        """1행 전과정 스크린샷 HTML 갤러리 + JSON 인덱스 작성."""
        if self._gallery_written:
            gallery = self.shot_dir / "index.html"
            return gallery if gallery.is_file() else None
        pngs = sorted(self.shot_dir.glob("*.png"))
        if not pngs and not self.shots:
            return None

        # shots 목록이 비어 있으면 파일명에서 재구성
        items = list(self.shots)
        if not items:
            for i, p in enumerate(pngs, start=1):
                stem = p.stem
                tag = stem
                m = re.match(r"^\d+_r\d+_(.+)$", stem)
                if m:
                    tag = m.group(1)
                items.append(
                    {
                        "step": i,
                        "row": 0,
                        "tag": tag,
                        "label": self.label_for_tag(tag),
                        "file": p.name,
                        "path": str(p),
                    }
                )

        import json

        idx_path = self.shot_dir / "shots.json"
        idx_path.write_text(
            json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        rows_html: list[str] = []
        for it in items:
            f = it["file"]
            label = it.get("label") or ""
            step = it.get("step", 0)
            cat = it.get("category") or ""
            url = it.get("url") or ""
            ord_n = it.get("ordinal") or 0
            meta_bits = [f]
            if ord_n:
                meta_bits.append(f"입력#{ord_n}")
            if cat:
                meta_bits.append(f"상위 최종 카테고리명={cat}")
            if url:
                meta_bits.append(f"최종 카테고리 URL주소={url}")
            meta = " | ".join(meta_bits)
            rows_html.append(
                f'<section class="shot">'
                f"<h2>{step:02d}. {label}</h2>"
                f'<p class="meta">{meta}</p>'
                f'<img src="{f}" alt="{label}"/>'
                f"</section>"
            )

        html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>1·2행 전과정 스크린샷</title>
<style>
body {{ font-family: "Malgun Gothic", sans-serif; margin: 16px; background: #0f172a; color: #e2e8f0; }}
h1 {{ font-size: 20px; }}
.shot {{ margin: 24px 0; padding: 12px; background: #1e293b; border-radius: 8px; }}
.shot h2 {{ margin: 0 0 6px; font-size: 16px; color: #93c5fd; }}
.meta {{ margin: 0 0 10px; color: #94a3b8; font-size: 12px; word-break: break-all; }}
img {{ max-width: 100%; height: auto; border: 1px solid #334155; background: #fff; }}
</style>
</head>
<body>
<h1>1·2행 전과정 스크린샷 ({len(items)}장)</h1>
<p>폴더: {self.shot_dir}</p>
{''.join(rows_html)}
</body>
</html>
"""
        gallery = self.shot_dir / "index.html"
        gallery.write_text(html, encoding="utf-8")
        self._gallery_written = True
        self.info(f"[갤러리] {gallery} ({len(items)}장)")
        return gallery


def shot_now(page: Page, tag: str, row_no: int | None = 0) -> Path | None:
    """활성 RunCtx가 있으면 같은 샷폴더에, 없으면 run-logs 루트에 저장."""
    ctx = _ACTIVE_CTX
    if ctx is not None:
        return ctx.shot(page, tag, row_no)
    SHOT_ROOT.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^\w\-가-힣]+", "_", tag)[:40]
    path = SHOT_ROOT / f"{time.strftime('%Y%m%d_%H%M%S')}_{safe}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
        log(f"  [샷] {path.name}")
        return path
    except Exception as e:  # noqa: BLE001
        log(f"  [샷 실패] {e}")
        return None


# ── 브라우저 연결 (기존 Chrome/Edge에 CDP로 붙기, Chromium 다운로드 없음) ──

def cdp_port_open(port: int = CDP_PORT) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        try:
            s.connect(("127.0.0.1", port))
            return True
        except OSError:
            return False


def find_browser_exe() -> str | None:
    for path in CHROME_CANDIDATES:
        if Path(path).exists():
            return path
    return None


def _clear_stale_singleton_locks() -> None:
    """
    이전 실행이 비정상 종료되어 남은 잠금파일이 있으면, 새 Chrome이
    "이미 실행 중"이라고 착각해 디버그 포트 없이 조용히 기존 창에만
    메시지를 보내고 끝나버릴 수 있다(=화면에 아무 반응도 없어 보임).
    cdp_port_open()이 False라는 건 우리 프로필로 살아있는 프로세스가
    없다는 뜻이므로 안전하게 지운다.
    """
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        f = PROFILE_DIR / name
        try:
            if f.exists() or f.is_symlink():
                f.unlink()
        except OSError:
            pass


def launch_debug_browser() -> None:
    """평소 쓰는 Chrome/Edge를 디버그 포트로 실행 — Playwright Chromium 미사용"""
    exe = find_browser_exe()
    if not exe:
        raise SystemExit(
            "Chrome 또는 Edge를 찾지 못했습니다.\n"
            "https://www.google.com/chrome/ 에서 설치 후 다시 실행하세요."
        )
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    _clear_stale_singleton_locks()
    log(f"브라우저 실행: {exe}")
    # 주의: stdout/stderr를 DEVNULL로 버리면 일부 환경(보안 소프트웨어·
    # 컨테이너 등)에서 Chrome이 바로 죽는 경우가 있다(무반응처럼 보임).
    # 로그 파일로 받아두면 안전하고, 문제 생기면 이 파일로 원인도 알 수 있다.
    log_path = PROFILE_DIR / "chrome_debug.log"
    log_file = open(log_path, "ab")
    subprocess.Popen(
        [
            exe,
            f"--remote-debugging-port={CDP_PORT}",
            f"--user-data-dir={PROFILE_DIR}",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            MAIN_URL,
        ],
        stdout=log_file,
        stderr=log_file,
    )
    log("디버그 모드 연결 대기 중 (최대 30초)...")
    for i in range(60):
        if cdp_port_open():
            log("브라우저 연결 확인됨")
            return
        if i > 0 and i % 6 == 0:
            log(f"  아직 대기 중... ({i * 0.5:.0f}초 경과 — 화면에 Chrome 창이 떴는지 확인해 주세요)")
        time.sleep(0.5)  # 소켓 연결 대기 — Playwright 이벤트루프와 무관하므로 안전
    raise SystemExit(
        "브라우저가 디버그 모드로 열리지 않았습니다.\n"
        "열려있는 Chrome/Edge 창을 모두 닫고 다시 실행해 보세요.\n"
        f"(참고 로그: {log_path})"
    )


def pick_working_page(context: BrowserContext) -> Page:
    """이미 망고 화면이 열려 있으면 그 탭을 그대로 사용(기본 화면 유지)"""
    open_pages = [p for p in context.pages if not p.is_closed()]
    for p in open_pages:
        try:
            if ADMIN_HOST in p.url:
                return p
        except Exception:  # noqa: BLE001
            continue
    return open_pages[0] if open_pages else context.new_page()


def refresh_if_closed(page: Page) -> Page:
    """
    로그인 성공 후 사이트가 원래 탭을 닫고 새 창을 띄우는 경우가 있다
    (예: 로그인 중계 페이지가 자기 자신을 닫음). 그러면 이전 page
    객체로는 더 이상 아무 것도 할 수 없으므로(TargetClosedError),
    같은 컨텍스트에서 살아있는 페이지를 다시 찾아온다.
    """
    if not page.is_closed():
        return page
    log("  탭이 닫힘 감지 — 새 탭을 다시 찾는 중...")
    return pick_working_page(page.context)


def connect_browser(p) -> tuple[Browser, Page]:
    """
    1) 이미 디버그 모드로 열린 Chrome/Edge가 있으면 그대로 연결(= 망고 기본 화면 그대로)
    2) 없으면 평소 쓰는 Chrome/Edge를 디버그 모드로 새로 열어서 연결
    Playwright 전용 Chromium은 내려받지 않는다.
    """
    if not cdp_port_open():
        launch_debug_browser()

    browser = p.chromium.connect_over_cdp(CDP_URL)
    context = browser.contexts[0] if browser.contexts else browser.new_context()
    page = pick_working_page(context)
    return browser, page


# ── 엑셀 ──────────────────────────────────────────────────────

def read_excel(path: str) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    headers = [str(c.value or "").strip() for c in next(ws.iter_rows(min_row=1, max_row=1))]
    try:
        label_col = headers.index("상위 최종 카테고리명")
        url_col = headers.index("최종 카테고리 URL주소")
    except ValueError:
        raise SystemExit(
            "엑셀 1행 헤더에 '상위 최종 카테고리명', '최종 카테고리 URL주소' 열이 있어야 합니다."
        )

    rows = []
    for i, row in enumerate(ws.iter_rows(min_row=2), start=2):
        label = str(row[label_col].value or "").strip()
        url = str(row[url_col].value or "").strip()
        if url:
            rows.append({"row": i, "label": label, "url": url})
    return rows


def normalize_url(u: str) -> str:
    u = u.strip()
    return u if re.match(r"^https?://", u, re.I) else f"https://{u}"


# ── 팝업 ──────────────────────────────────────────────────────

def popups(page: Page) -> list:
    result = []
    for p in page.context.pages:
        if p is page or p.is_closed():
            continue
        try:
            u = p.url
        except Exception:
            continue
        if u and u != "about:blank" and ADMIN_HOST not in u:
            result.append(p)
    return result


def wait_popup_open(page: Page, grace_sec: float = 15.0) -> list:
    """검색 팝업(새 창)이 열릴 때까지 대기. 열린 팝업 Page 리스트 반환."""
    grace_end = time.time() + max(0.5, float(grace_sec))
    while time.time() < grace_end:
        cur = popups(page)
        if cur:
            return cur
        page.wait_for_timeout(200)
    return []


def wait_popups_close(page: Page, timeout_sec: int = POPUP_WAIT_SEC) -> None:
    """열린 검색 팝업이 모두 닫힐 때까지 대기 — 절대 건드리지 않음."""
    end = time.time() + timeout_sec
    last_beat = 0.0
    while popups(page):
        if time.time() > end:
            raise TimeoutError("팝업창이 닫히지 않음")
        if time.time() - last_beat > 10:
            last_beat = time.time()
            cur = popups(page)
            urls = ", ".join(p.url for p in cur if not p.is_closed())
            log(f"  팝업창 닫힘 대기중... (열린 팝업 {len(cur)}개: {urls})")
        page.wait_for_timeout(500)


def wait_popups_gone(
    page: Page,
    timeout_sec: int = POPUP_WAIT_SEC,
    grace_sec: float = 2.0,
    warn_if_never_opened: bool = False,
) -> bool:
    """팝업이 한 번 열린 뒤 스스로 닫힐 때까지 대기.

    반환값: 팝업이 한 번이라도 열렸으면 True.
    """
    opened = wait_popup_open(page, grace_sec=grace_sec)
    if not opened:
        if warn_if_never_opened:
            log(
                "  [경고] 팝업이 뜨지 않음 — 클릭이 제대로 안 됐거나 "
                "사이트가 응답하지 않았을 수 있음"
            )
        return False
    wait_popups_close(page, timeout_sec=timeout_sec)
    return True


def scroll_to_product_strip(page: Page) -> None:
    """수집 상품 썸네일/모두저장 버튼 영역이 보이도록 스크롤."""
    try:
        btn = save_all_button(page).first
        if btn.count() > 0 and btn.is_visible():
            btn.scroll_into_view_if_needed(timeout=5_000)
            page.wait_for_timeout(250)
    except Exception:  # noqa: BLE001
        pass
    try:
        page.evaluate(
            """() => {
                const re = /검색된\\s*상품\\s*모두\\s*저장|전체선택|선택상품저장/;
                const nodes = Array.from(document.querySelectorAll('input,button,a,td,div,span'));
                const hit = nodes.find(el => re.test((el.value || el.innerText || '').trim()));
                if (hit) hit.scrollIntoView({ block: 'center', inline: 'nearest' });
                const imgs = Array.from(document.querySelectorAll('img')).filter(
                    (i) => (i.naturalWidth || 0) >= 40 && (i.naturalHeight || 0) >= 40
                );
                if (imgs.length) {
                    imgs[Math.min(3, imgs.length - 1)].scrollIntoView({
                        block: 'center', inline: 'nearest'
                    });
                }
            }"""
        )
        page.wait_for_timeout(300)
    except Exception:  # noqa: BLE001
        pass


def wait_product_images(
    page: Page,
    *,
    min_count: int = 2,
    timeout_sec: float = 25.0,
) -> int:
    """상품 이미지(naturalWidth>=40)가 로드될 때까지 스크롤·대기. 로드 개수 반환."""
    end = time.time() + max(3.0, float(timeout_sec))
    best = 0
    while time.time() < end:
        try:
            n = page.evaluate(
                """() => {
                    let ok = 0;
                    for (const img of Array.from(document.querySelectorAll('img'))) {
                        const w = img.naturalWidth || 0;
                        const h = img.naturalHeight || 0;
                        const r = img.getBoundingClientRect();
                        if (w >= 40 && h >= 40 && r.width >= 20 && r.height >= 20) ok += 1;
                    }
                    return ok;
                }"""
            )
            best = max(best, int(n or 0))
        except Exception:  # noqa: BLE001
            pass
        if best >= min_count:
            scroll_to_product_strip(page)
            return best
        try:
            page.evaluate(
                "() => window.scrollBy(0, Math.max(280, Math.floor(window.innerHeight * 0.55)))"
            )
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(350)
    scroll_to_product_strip(page)
    return best


def prepare_product_view_for_shot(page: Page, *, min_images: int = 2) -> int:
    """샷 직전에 상품 이미지가 보이도록 대기·스크롤. 로드된 이미지 수 반환."""
    wait_page_not_loading(page, timeout_sec=15.0)
    scroll_to_product_strip(page)
    n = wait_product_images(page, min_count=min_images, timeout_sec=25.0)
    scroll_to_product_strip(page)
    page.wait_for_timeout(400)
    return n


# ── 입력 · 클릭 (망고 구형 input 대응) ────────────────────────

def type_into(page: Page, locator, value: str) -> None:
    el = locator.first
    el.wait_for(state="attached", timeout=60_000)
    el.scroll_into_view_if_needed()
    try:
        el.click(timeout=15_000)
    except PWTimeout:
        pass
    page.keyboard.press("Control+A")
    page.keyboard.press("Backspace")
    page.keyboard.insert_text(value)

    got = ""
    try:
        got = el.input_value()
    except Exception:
        pass
    if not got.strip():
        el.evaluate(
            """(node, v) => {
                if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
                    node.focus();
                    node.value = v;
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                    node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                    node.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }""",
            value,
        )
        got = ""
        try:
            got = el.input_value()
        except Exception:
            pass

    if got.strip() != value.strip():
        log(f"  [경고] 입력값 불일치 — 넣으려던 값: {value!r} / 실제 값: {got!r}")


def click_it(locator) -> bool:
    """
    반환값: 신뢰할 수 있는(trusted) 클릭으로 처리됐으면 True.
    el.evaluate(...node.click()...) 같은 JS 강제클릭은 브라우저가
    "진짜 사용자 클릭"으로 인정하지 않아, 그 안에서 호출되는
    window.open()(팝업)이 조용히 차단될 수 있다. 그래서 실패해도
    좌표 기반 실제 마우스 클릭(신뢰됨)을 먼저 시도하고,
    그것마저 안 될 때만 최후 수단으로 JS 클릭을 쓴다.
    """
    el = locator.first
    el.wait_for(state="visible", timeout=60_000)
    el.scroll_into_view_if_needed()
    try:
        el.click(timeout=20_000)
        return True
    except PWTimeout:
        pass

    try:
        box = el.bounding_box()
        if box:
            el.page.mouse.click(
                box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            )
            return True
    except Exception:  # noqa: BLE001
        pass

    log("  [경고] 실제 클릭 실패 — JS 강제클릭 사용 (팝업이 안 뜰 수 있음)")
    el.evaluate("(node) => node.click()")
    return False


# ── 화면 요소 ─────────────────────────────────────────────────

def url_search_button(page: Page):
    return page.locator(
        'input[type="button"][value*="URL"], input[type="submit"][value*="URL"]'
    ).or_(page.get_by_text(re.compile(r"URL\s*상품\s*검색")))


def save_all_button(page: Page):
    return (
        page.locator('input[type="button"][value*="모두저장"]')
        .or_(page.locator('input[type="submit"][value*="모두저장"]'))
        .or_(page.get_by_text(re.compile(r"검색된\s*상품\s*모두\s*저장")))
    )


def _describe(loc) -> str:
    try:
        return loc.evaluate(
            "n => `<${n.tagName.toLowerCase()}"
            " name=${n.name||''} id=${n.id||''} rows=${n.rows||''}"
            " value.len=${(n.value||'').length}>`"
        )
    except Exception:
        return "<알 수 없음>"


def url_input(page: Page):
    """페이지 전환 중이면 재시도(_url_input_once 참고)"""
    return with_nav_retry(page, lambda: _url_input_once(page))


def _url_input_once(page: Page):
    """
    URL상품검색하기 버튼과 실제 입력칸이 서로 다른 <tr>/<table>에 있는
    화면이 있어(선택자가 넓으면 엉뚱한 textarea를 골라 "검색결과 없음"이
    나는 원인이 됨) 좁은 범위 -> 넓은 범위 순으로, 후보가 정확히 하나일
    때만 채택한다.
    """
    btn = url_search_button(page).first

    # 1) 버튼과 같은 <tr> 안에서 우선 찾기 (가장 정확)
    row = btn.locator("xpath=ancestor::tr[1]")
    if row.count() > 0:
        for sel in ("textarea", 'input[type="text"]:not([name*="login"]):not([readonly])'):
            cand = row.locator(sel)
            if cand.count() > 0:
                found = cand.first
                log(f"  URL입력칸(같은 행에서 발견): {_describe(found)}")
                return found

    # 2) 부모를 한 단계씩 올라가며(최대 4단계) 후보가 정확히 하나일 때만 채택
    ancestor = btn
    for _ in range(4):
        ancestor = ancestor.locator("xpath=..")
        for sel in ("textarea", 'input[type="text"]:not([name*="login"]):not([readonly])'):
            cand = ancestor.locator(sel)
            if cand.count() == 1:
                found = cand.first
                log(f"  URL입력칸(상위 요소에서 발견): {_describe(found)}")
                return found

    # 3) 최후 수단: 페이지 전체에서 rows 속성이 가장 큰 textarea
    #    (URL 여러 줄 입력용 큰 textarea일 가능성이 높음)
    all_ta = page.locator("textarea")
    n = all_ta.count()
    if n == 1:
        found = all_ta.first
        log(f"  URL입력칸(페이지에 textarea 1개뿐): {_describe(found)}")
        return found
    if n > 1:
        best_idx, best_rows = 0, -1
        for i in range(n):
            rows_attr = all_ta.nth(i).get_attribute("rows")
            try:
                rows_val = int(rows_attr) if rows_attr else 1
            except ValueError:
                rows_val = 1
            if rows_val > best_rows:
                best_rows, best_idx = rows_val, i
        found = all_ta.nth(best_idx)
        log(f"  URL입력칸(가장 큰 textarea 선택, {n}개 중): {_describe(found)}")
        return found

    raise RuntimeError("URL 입력칸을 찾지 못했습니다")


def save_modal(page: Page):
    return (
        page.locator("div, form, table")
        .filter(has_text=re.compile(r"상품\s*저장\s*설정|검색\s*필터\s*명"))
        .filter(has_text=re.compile("저장하기"))
        .last
    )


def save_modal_visible(page: Page) -> bool:
    try:
        return page.get_by_text(re.compile(r"상품\s*저장\s*설정")).first.is_visible()
    except Exception:
        return False


def modal_field(page: Page, label_pattern: re.Pattern):
    modal = save_modal(page)
    return (
        modal.locator("tr, div, p, label")
        .filter(has_text=label_pattern)
        .locator('input[type="text"], input:not([type]), input[type="number"]')
        .first
    )


# ── 0 ~ 4 ────────────────────────────────────────────────────

def safe_goto(page: Page, url: str, retries: int = 3) -> None:
    """
    로그인 직후 등 사이트 자체가 리다이렉트를 진행 중일 때
    page.goto()와 겹치면 'interrupted by another navigation' 오류가 난다.
    사이트 쪽 리다이렉트가 끝날 때까지 기다렸다가 다시 시도한다.
    """
    last_err: Exception | None = None
    for _ in range(retries):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=120_000)
            return
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "interrupted by another navigation" in msg or "NS_BINDING_ABORTED" in msg:
                last_err = e
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=15_000)
                except Exception:  # noqa: BLE001
                    pass
                page.wait_for_timeout(800)
                continue
            raise
    if last_err:
        raise last_err


NAV_ERROR_MARKERS = (
    "Execution context was destroyed",
    "context was destroyed",
    "Target closed",
    "Target page, context or browser has been closed",
)


def is_navigation_error(e: Exception) -> bool:
    msg = str(e)
    return any(m in msg for m in NAV_ERROR_MARKERS)


def with_nav_retry(page: Page, fn, retries: int = 3):
    """
    사이트가 리다이렉트/네비게이션 중일 때 DOM을 조회하면
    "Execution context was destroyed" 같은 오류가 난다.
    페이지가 안정될 때까지 기다렸다가 재시도한다.
    """
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if is_navigation_error(e):
                last_err = e
                log(f"  [정보] 페이지 전환 중이라 재시도합니다 ({attempt + 1}/{retries})")
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=10_000)
                except Exception:  # noqa: BLE001
                    pass
                page.wait_for_timeout(800)
                continue
            raise
    if last_err:
        raise last_err
    return None


def _is_logged_in(page: Page) -> bool:
    """로그인 화면을 벗어나고 관리자 호스트에 있으면 로그인된 것으로 본다."""
    try:
        url = page.url or ""
    except Exception:  # noqa: BLE001
        return False
    if not url or url in ("about:blank", "chrome://newtab/"):
        return False
    if ADMIN_HOST not in url:
        return False
    if "admin_login" in url:
        return False
    if "m_login" in url:
        return False
    return True


def wait_for_user_login(page: Page, timeout_sec: int = LOGIN_WAIT_SEC) -> Page:
    """더망고 로그인 창만 띄우고, 사용자가 직접 로그인할 때까지 대기.

    자동 ID/PW 입력·글자 지연 입력·자동 제출은 하지 않는다.
    (Cafe24 보안/자동화 거절 회피 — 사용자 수동 로그인)
    """
    page = refresh_if_closed(page)
    if _is_logged_in(page):
        log("이미 로그인된 세션 — 사용자 로그인 대기 생략")
        return page

    if "admin_login" not in (page.url or ""):
        log("더망고 로그인창 열기: " + LOGIN_URL)
        safe_goto(page, LOGIN_URL)
        page = refresh_if_closed(page)

    try:
        page.bring_to_front()
    except Exception:  # noqa: BLE001
        pass

    safe_print("")
    safe_print("================================================")
    safe_print("  더망고 로그인창에서 직접 로그인하세요.")
    safe_print("  (프로그램이 ID/PW를 입력하지 않습니다)")
    safe_print(f"  로그인 완료 후 자동으로 계속됩니다. (최대 {timeout_sec}초)")
    safe_print("================================================")
    log("사용자 로그인 대기 중...")
    shot_now(page, "login_wait", 0)

    deadline = time.time() + max(30, int(timeout_sec))
    last_url = ""
    while time.time() < deadline:
        page = refresh_if_closed(page)
        try:
            cur = page.url or ""
        except Exception:  # noqa: BLE001
            cur = ""
        if cur != last_url:
            last_url = cur
            log(f"  [대기] URL={cur}")
        if _is_logged_in(page):
            log("사용자 로그인 확인 — 계속 진행")
            shot_now(page, "login_ok", 0)
            return page
        page.wait_for_timeout(1000)

    raise RuntimeError(
        "사용자 로그인 대기 시간 초과.\n"
        "  · Chrome에 열린 더망고 로그인창에서 직접 로그인한 뒤 다시 실행하세요.\n"
        f"  · 마지막 URL={last_url or '(unknown)'}"
    )


def perform_tmg_login(page: Page, user_id: str | None = None, password: str | None = None) -> Page:
    """하위 호환: 자동 입력 없음 — 사용자 수동 로그인 대기."""
    _ = user_id, password
    return wait_for_user_login(page)


def _ask_human(prompt: str) -> None:
    """대화형 터미널에서만 대기. CI/비대화형이면 즉시 실패."""
    if not sys.stdin.isatty():
        raise RuntimeError(
            "로그인이 필요하지만 비대화형 실행입니다. "
            "로컬 PC에서 망고 로그인 후 다시 실행하세요."
        )
    try:
        input(prompt)
    except EOFError as e:
        raise RuntimeError(
            "로그인이 필요하지만 입력을 받을 수 없습니다. "
            "로컬 PC에서 망고 로그인 후 다시 실행하세요."
        ) from e


def handle_possible_login_page(page: Page) -> None:
    """
    세션이 만료돼 admin_login.php로 튕기면 로그인창을 띄우고
    사용자가 직접 로그인할 때까지 기다린다. (자동 입력 없음)
    """
    if "admin_login" not in page.url:
        return
    log("  [경고] 로그인 화면 — 사용자 직접 로그인 대기")
    shot_now(page, "login_required", 0)
    wait_for_user_login(page)
    page = refresh_if_closed(page)
    if "admin_login" in page.url:
        raise RuntimeError("로그인 후에도 여전히 로그인 화면입니다 — 다시 확인해 주세요")


def _wait_bulk_ready_once(page: Page) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=15_000)
    except Exception:  # noqa: BLE001
        pass
    if BULK_PATH not in page.url:
        safe_goto(page, BULK_URL)
    handle_possible_login_page(page)
    if BULK_PATH not in page.url:
        safe_goto(page, BULK_URL)
        handle_possible_login_page(page)
    log("  대량수집 화면 로딩 확인 중...")
    url_search_button(page).first.wait_for(state="visible", timeout=60_000)


def wait_bulk_ready(page: Page) -> None:
    with_nav_retry(page, lambda: _wait_bulk_ready_once(page))


def _reset_to_bulk_menu_once(page: Page) -> None:
    href = page.locator('a[href*="getGoodsNew"]').first
    if href.count() > 0:
        try:
            href.click(timeout=5000)
        except PWTimeout:
            href.evaluate("(node) => node.click()")
        page.wait_for_timeout(800)
        handle_possible_login_page(page)
        if BULK_PATH in page.url:
            wait_bulk_ready(page)
            return

    page.evaluate(
        """() => {
            const clean = (s) => (s || '').replace(/\\s+/g, '');
            const nodes = Array.from(document.querySelectorAll('a, li, span, td, div, button'));
            const byHref = Array.from(document.querySelectorAll('a[href*="getGoodsNew"]'));
            if (byHref[0]) { byHref[0].click(); return; }
            const top = nodes.find(el => clean(el.textContent) === '상품데이터수집');
            if (top) top.click();
            const sub = nodes.find(el => {
                const t = clean(el.textContent);
                if (t.length > 30) return false;
                return /대량데이터수집|대량수집|상품데이터대량/.test(t);
            });
            if (sub) (sub.closest('a') || sub).click();
        }"""
    )
    page.wait_for_timeout(1000)
    handle_possible_login_page(page)
    if BULK_PATH not in page.url:
        safe_goto(page, BULK_URL)
    wait_bulk_ready(page)


def reset_to_bulk_menu(page: Page) -> None:
    """0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭"""
    with_nav_retry(page, lambda: _reset_to_bulk_menu_once(page))


def wait_page_not_loading(page: Page, timeout_sec: float = 15.0) -> None:
    """
    모두저장 클릭 전에 "로딩 중" 표시가 사라졌는지만 확인한다.
    (검색결과 있음/없음은 절대 판단하지 않음 — 로딩 중에 "결과없음"
    문구가 잠깐 보였다가 사라지는 경우를 결과없음으로 오판했던 과거
    버그가 있어서, 오직 로딩 표시 유무만 본다.)
    """
    end = time.time() + timeout_sec
    while time.time() < end:
        try:
            loading = page.evaluate(
                "() => /load\\s*product|상품정보를\\s*불러오는\\s*중|잠시만\\s*기다려/i"
                ".test(document.body ? document.body.innerText : '')"
            )
        except Exception:  # noqa: BLE001
            return
        if not loading:
            page.wait_for_timeout(500)  # 결과 렌더링 여유
            return
        page.wait_for_timeout(300)


def _process_row_once(page: Page, row: dict, ctx: RunCtx) -> None:
    label = row["label"]
    url = normalize_url(row["url"])
    save_count = ctx.save_count
    rn = row["row"]
    ctx.info(
        f"처리 시작 | 상위 최종 카테고리명={label} | "
        f"최종 카테고리 URL주소={row['url']} | 목표 저장수={save_count}"
    )

    ctx.info("0. 초기화 : 상품데이터수집 -> 대량데이터수집")
    reset_to_bulk_menu(page)
    page.wait_for_timeout(500)
    ctx.shot(page, "00_init_bulk", rn)

    ctx.info(f"  엑셀 원본 URL: {row['url']}")
    if url != row["url"].strip():
        ctx.info(f"  [정보] 프로토콜 보정됨: {url}")

    ctx.info(f"1. URL 입력 | 상위 최종 카테고리명={label} | 최종 카테고리 URL주소={url}")
    target = url_input(page)
    type_into(page, target, url)
    actual = ""
    try:
        actual = target.input_value()
    except Exception:
        pass
    ctx.info(f"  입력칸 최종 값: {actual!r}")
    if actual.strip() != url.strip():
        raise RuntimeError(f"URL 입력 불일치 — 기대 {url!r} / 실제 {actual!r}")
    ctx.shot(page, "01_url_filled", rn)

    ctx.info("1. URL상품검색하기 클릭")
    trusted = click_it(url_search_button(page))

    # 07 선행: 검색 팝업 "열림" 확인·샷 → 그 다음 "닫힘"
    ctx.info("1. 검색 팝업 열림 대기")
    opened_pages = wait_popup_open(page, grace_sec=15.0)
    if not opened_pages:
        ctx.info("  키보드로 재시도 (Enter)")
        try:
            btn = url_search_button(page).first
            btn.focus()
            page.keyboard.press("Enter")
        except Exception:  # noqa: BLE001
            pass
        opened_pages = wait_popup_open(page, grace_sec=10.0)

    if not opened_pages:
        ctx.shot(page, "01_popup_missing", rn)
        raise RuntimeError(
            f"#{rn} URL상품검색하기 클릭 후 팝업이 뜨지 않음 "
            f"(trusted_click={trusted})"
        )

    popup = opened_pages[0]
    try:
        popup.bring_to_front()
    except Exception:  # noqa: BLE001
        pass
    try:
        popup_imgs = prepare_product_view_for_shot(popup, min_images=2)
    except Exception as e:  # noqa: BLE001
        ctx.info(f"  [경고] 팝업 상품이미지 대기 실패: {e}")
        popup_imgs = 0
    ctx.info(f"1. 검색 팝업 열림 (상품이미지 약 {popup_imgs}개)")
    ctx.shot(popup, "01_popup_opened", rn)

    ctx.info("1. 검색 팝업 닫힘 대기")
    wait_popups_close(page)
    try:
        page.bring_to_front()
    except Exception:  # noqa: BLE001
        pass
    ctx.info("1. 검색 팝업 닫힘")
    ctx.shot(page, "01_popup_closed", rn)

    # 08: 검색 결과 준비 — 하단 수집 상품 이미지가 보이도록 대기 후 샷
    result_imgs = prepare_product_view_for_shot(page, min_images=2)
    ctx.info(f"1. 검색 결과 준비 (하단 상품이미지 약 {result_imgs}개)")
    if result_imgs < 1:
        ctx.info("  [경고] 검색 결과 상품이미지가 거의 보이지 않음 — 그대로 샷")
    ctx.shot(page, "01_results_ready", rn)

    ctx.info("2. 검색된 상품 모두저장 클릭")
    scroll_to_product_strip(page)
    click_it(save_all_button(page))
    save_modal(page).wait_for(state="visible", timeout=MODAL_WAIT_SEC * 1000)
    # 09: 모달과 함께 하단 상품 이미지가 보이도록 스크롤·대기 후 샷
    try:
        modal_imgs = prepare_product_view_for_shot(page, min_images=2)
    except Exception as e:  # noqa: BLE001
        ctx.info(f"  [경고] 모달 화면 상품이미지 대기 실패: {e}")
        modal_imgs = 0
    page.wait_for_timeout(300)
    ctx.info(f"2. 모두저장 모달 (하단 상품이미지 약 {modal_imgs}개)")
    ctx.shot(page, "02_save_modal", rn)

    ctx.info(f"2. 검색필터명 입력: {label}")
    type_into(page, modal_field(page, FILTER_NAME_LABEL), label)

    count_field = modal_field(page, SAVE_COUNT_LABEL)
    if count_field.count() == 0:
        ctx.shot(page, "02_no_count_field", rn)
        raise RuntimeError(f"#{rn} 저장상품수 입력칸을 찾지 못함")
    type_into(page, count_field, str(save_count))
    type_into(page, modal_field(page, FILTER_NAME_LABEL), label)

    # 저장수 확인
    got_count = ""
    try:
        got_count = count_field.input_value()
    except Exception:
        pass
    ctx.info(f"  저장상품수 입력값: {got_count!r} (목표 {save_count})")
    if str(save_count) not in (got_count or "").replace(" ", ""):
        # 숫자만 비교
        digits = re.sub(r"\D", "", got_count or "")
        if digits != str(save_count):
            ctx.shot(page, "02_count_mismatch", rn)
            raise RuntimeError(
                f"#{rn} 저장상품수 불일치 — 기대 {save_count} / 실제 {got_count!r}"
            )
    ctx.shot(page, "02_modal_filled", rn)

    ctx.info("2. 저장하기 버튼 클릭")
    click_it(
        save_modal(page)
        .locator('input[value*="저장하기"]')
        .or_(save_modal(page).locator('button:has-text("저장하기")'))
        .or_(save_modal(page).get_by_text(re.compile("^저장하기$")))
    )

    ctx.info("3. 팝업창이 없어질 때까지 대기")
    end = time.time() + MODAL_WAIT_SEC
    closed = False
    while time.time() < end:
        if not save_modal_visible(page):
            wait_popups_gone(page, grace_sec=0.5)
            closed = True
            break
        page.wait_for_timeout(500)
    if not closed:
        ctx.shot(page, "03_modal_stuck", rn)
        raise TimeoutError(f"#{rn} 저장 팝업창이 닫히지 않음")
    ctx.info("3. 팝업창 닫힘")
    ctx.shot(page, "03_modal_closed", rn)

    # C. 3건(저장수) 완료 확인
    verify_row_save_done(page, ctx, rn, save_count)
    ctx.info(f"4. -> 행 완료 확인 (저장수 {save_count})")
    ctx.shot(page, "04_row_done", rn)


def verify_row_save_done(page: Page, ctx: RunCtx, row_no: int, save_count: int) -> None:
    """저장 모달 종료 후, 오류 문구가 없고(가능하면) 성공 신호를 확인."""
    page.wait_for_timeout(800)
    try:
        text = page.evaluate(
            "() => (document.body && document.body.innerText) ? document.body.innerText : ''"
        )
    except Exception:  # noqa: BLE001
        text = ""

    for pat in SAVE_FAIL_PATTERNS:
        if pat.search(text or ""):
            raise RuntimeError(f"#{row_no} 저장 후 오류 문구 감지: {pat.pattern}")

    ok_hit = None
    for pat in SAVE_OK_PATTERNS:
        m = pat.search(text or "")
        if m:
            ok_hit = m.group(0)
            break

    # 모달이 닫혔고 오류 문구가 없으면 1차 통과.
    # 성공 문구가 있으면 로그에 남김. 검증 모드에서는 성공 문구 또는
    # '저장상품수 입력 확인됨'을 전제로 이미 모달에서 확인했으므로 통과.
    if ok_hit:
        ctx.info(f"  [확인] 화면 성공 신호: {ok_hit!r}")
    else:
        ctx.info(
            f"  [확인] 오류 문구 없음 · 모달 종료 · 저장수 {save_count} 입력 확인됨 "
            f"(성공 문구는 화면에 없을 수 있음)"
        )

    if ctx.verify:
        # 검증 모드: 저장수 필드에 넣었던 값이 반영됐는지 이미 확인함.
        # 추가로 짧은 대기 후 로그인 튕김만 검사.
        if "admin_login" in page.url:
            raise RuntimeError(f"#{row_no} 저장 직후 로그인 화면으로 이동됨")


def process_row_with_retries(page: Page, row: dict, ctx: RunCtx) -> bool:
    """행 단위 재시도. 성공 True / 최종 실패 False."""
    last_err: Exception | None = None
    label = str(row.get("label") or "").strip()
    raw_url = str(row.get("url") or "").strip()
    for attempt in range(1, ctx.retries + 1):
        try:
            ctx.info(
                f"> 시도 {attempt}/{ctx.retries} (엑셀 {row['row']}행) | "
                f"상위 최종 카테고리명={label} | 최종 카테고리 URL주소={raw_url}"
            )
            page = refresh_if_closed(page)
            _process_row_once(page, row, ctx)
            ctx.info(
                f"[OK] 엑셀{row['row']}행 성공 (시도 {attempt}) | "
                f"상위 최종 카테고리명={label} | 최종 카테고리 URL주소={raw_url}"
            )
            return True
        except Exception as e:  # noqa: BLE001
            last_err = e
            err_name = type(e).__name__
            ctx.info(
                f"[FAIL] 엑셀{row['row']}행 실패 (시도 {attempt}/{ctx.retries}) | "
                f"상위 최종 카테고리명={label} | 최종 카테고리 URL주소={raw_url} | "
                f"{err_name}: {e}"
            )
            try:
                page = refresh_if_closed(page)
                ctx.shot(page, f"fail_attempt{attempt}", row["row"])
            except Exception:
                pass
            # 탭/브라우저가 닫힌 경우 같은 컨텍스트에서 페이지 다시 확보
            if "TargetClosed" in err_name or "Target closed" in str(e):
                ctx.info("  탭 닫힘 감지 — 작업 페이지 재연결 시도")
                try:
                    page = refresh_if_closed(page)
                except Exception as re:  # noqa: BLE001
                    ctx.info(f"  재연결 경고: {re}")
            if attempt < ctx.retries:
                ctx.info("  같은 행 재시도 전 대량수집 화면 복귀...")
                try:
                    page = refresh_if_closed(page)
                    reset_to_bulk_menu(page)
                except Exception as re:  # noqa: BLE001
                    ctx.info(f"  복귀 중 경고: {re}")
                try:
                    page.wait_for_timeout(1000)
                except Exception:
                    page = refresh_if_closed(page)
    ctx.info(f"[FAIL] {row['row']}행 최종 실패: {last_err}")
    return False


def process_row(page: Page, row: dict, save_count: int = DEFAULT_SAVE_COUNT) -> None:
    """하위 호환: 저장수만 받아 1회 시도."""
    ctx = RunCtx(save_count=save_count, retries=1, batch=True)
    try:
        _process_row_once(page, row, ctx)
    finally:
        ctx.close()


def ensure_ready_page(page: Page) -> Page:
    """이미 망고 화면이면 그대로, 아니면 메인화면 진입 → 필요시 로그인 대기 → 0.초기화

    로그인 성공 후 사이트가 원래 탭을 닫아버리는 경우가 있어(예: 로그인
    중계 페이지가 스스로를 닫음) 매 단계 사이마다 탭이 살아있는지
    확인하고, 닫혔으면 같은 브라우저에서 새 탭을 다시 찾아온다.
    """
    page = refresh_if_closed(page)

    if ADMIN_HOST not in page.url or page.url in ("about:blank", ""):
        log("메인화면으로 이동: " + MAIN_URL)
        safe_goto(page, MAIN_URL)

    # 세션 없으면 더망고 로그인창을 직접 연다 (메인 경유 리다이렉트만 기다리지 않음)
    need_login = "admin_login" in page.url
    if not need_login:
        # 메인에 들어갔는데 세션 쿠키가 없으면 곧 로그인으로 튕김 → 선제 확인
        try:
            if page.locator('input[name="login_id"]').count() > 0:
                need_login = True
        except Exception:  # noqa: BLE001
            pass
    if need_login or ADMIN_HOST not in page.url:
        if "admin_login" not in page.url:
            log("더망고 로그인창으로 이동: " + LOGIN_URL)
            safe_goto(page, LOGIN_URL)
            page = refresh_if_closed(page)
        shot_now(page, "login_gate", 0)
        page = wait_for_user_login(page)
        page = refresh_if_closed(page)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=15_000)
        except Exception:  # noqa: BLE001
            pass
        page = refresh_if_closed(page)
        try:
            page.wait_for_timeout(500)
        except Exception:  # noqa: BLE001
            pass
        page = refresh_if_closed(page)
        if "admin_login" in page.url or ADMIN_HOST not in page.url:
            safe_goto(page, MAIN_URL)

    log("0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭")
    if BULK_PATH in page.url:
        wait_bulk_ready(page)
    else:
        reset_to_bulk_menu(page)

    return page


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(
        description="P2 더망고 대량수집 — URL 1행당 상품 N건 (기본 3)"
    )
    ap.add_argument("excel", help="P1 출력 엑셀 (.xlsx)")
    ap.add_argument(
        "save_count",
        nargs="?",
        type=int,
        default=DEFAULT_SAVE_COUNT,
        help=f"행당 저장 상품 수 (기본 {DEFAULT_SAVE_COUNT})",
    )
    ap.add_argument(
        "--verify",
        action="store_true",
        help="검증 모드: 앞 N행 처리(기본 2), 1·2행 단계 스크린샷, 재시도, 무중단",
    )
    ap.add_argument(
        "--max-rows",
        type=int,
        default=None,
        help="처리할 최대 행 수 (검증 모드 기본 2)",
    )
    ap.add_argument(
        "--shot-first",
        type=int,
        default=2,
        help="단계별 스크린샷을 남길 앞쪽 입력 행 수 (기본 2 = 1·2행)",
    )
    ap.add_argument(
        "--retries",
        type=int,
        default=DEFAULT_ROW_RETRIES,
        help=f"행 실패 시 같은 행 재시도 횟수 (기본 {DEFAULT_ROW_RETRIES})",
    )
    ap.add_argument(
        "--yes",
        "--batch",
        dest="batch",
        action="store_true",
        help="실패해도 y/n 묻지 않고 다음 행으로 (또는 재시도만)",
    )
    ap.add_argument(
        "--id",
        dest="tmg_id",
        default=None,
        help="(미사용) 자동 로그인 제거됨 — 브라우저에서 직접 로그인",
    )
    ap.add_argument(
        "--pw",
        dest="tmg_pw",
        default=None,
        help="(미사용) 자동 로그인 제거됨 — 브라우저에서 직접 로그인",
    )
    args = ap.parse_args()

    excel_path = args.excel
    save_count = args.save_count if args.save_count and args.save_count > 0 else DEFAULT_SAVE_COUNT
    verify = bool(args.verify)
    max_rows = args.max_rows
    shot_first = max(0, int(args.shot_first))
    if verify and max_rows is None:
        max_rows = max(2, shot_first)  # 검증 기본: 1·2행

    if args.tmg_id or args.tmg_pw:
        log("[안내] --id/--pw 는 더 이상 사용하지 않습니다. 브라우저에서 직접 로그인하세요.")

    all_rows = read_excel(excel_path)
    if not all_rows:
        safe_print("엑셀에 처리할 행이 없습니다.")
        sys.exit(1)

    ctx = RunCtx(
        save_count=save_count,
        retries=args.retries,
        verify=verify,
        max_rows=max_rows,
        batch=args.batch or verify,
        shot_first_n=shot_first,
    )

    # 모든 입력 데이터 카테고리명·URL을 실행 로그에 기록
    ctx.info(f"[입력목록] 파일={excel_path}")
    ctx.info(f"[입력목록] 총 {len(all_rows)}건 (상위 최종 카테고리명 / 최종 카테고리 URL주소)")
    for i, r in enumerate(all_rows, start=1):
        ctx.info(
            f"  입력#{i} 엑셀{r['row']}행 | "
            f"상위 최종 카테고리명={r['label']} | "
            f"최종 카테고리 URL주소={r['url']}"
        )

    rows = all_rows
    if max_rows is not None:
        rows = all_rows[: max(0, max_rows)]
    ctx.info(
        f"처리대상 {len(rows)}행 / 전체입력 {len(all_rows)}행 · 저장수={save_count} · "
        f"재시도={ctx.retries} · verify={verify} · 샷=입력1~{shot_first}행 · "
        f"로그={ctx.shot_dir}"
    )

    ok = 0
    fail = 0
    try:
        with sync_playwright() as p:
            _browser, page = connect_browser(p)
            page.set_default_timeout(120_000)
            page = ensure_ready_page(page)
            ctx.shot(page, "ready", 0)

            for ordinal, row in enumerate(rows, start=1):
                ctx.begin_row(ordinal, row)
                page = refresh_if_closed(page)
                success = process_row_with_retries(page, row, ctx)
                if success:
                    ok += 1
                else:
                    fail += 1
                    if not ctx.batch:
                        if input("계속 진행할까요? (y/n) ").strip().lower() != "y":
                            break

            ctx.info(f"완료: 성공 {ok} / 실패 {fail} / 대상 {len(rows)}행 / 입력전체 {len(all_rows)}건")
            gallery = ctx.write_gallery()
            ctx.info(f"스크린샷·로그: {ctx.shot_dir}")
            if gallery:
                ctx.info(f"[갤러리] {gallery}")
            safe_print("브라우저는 그대로 열어둡니다 (이 창만 닫으면 됩니다).")
            if verify and ok >= 1 and fail == 0:
                safe_print(
                    f"[OK] 검증 모드 PASS — {ok}행 완료 · "
                    f"입력 1~{shot_first}행 전과정 스크린샷 기록됨"
                )
                sys.exit(0)
            if fail:
                sys.exit(2)
    finally:
        ctx.close()


if __name__ == "__main__":
    main()
