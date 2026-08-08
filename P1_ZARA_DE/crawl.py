"""
P1_ZARA_DE — ZARA Deutschland(zara.com/de) 카테고리 URL → 엑셀

P1(ABC마트/A-RT)을 복제한 신규 프로젝트.
엑셀 헤더·상위칸(명1:명2) 규칙은 P1과 동일 → P2 입력으로 사용 가능.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from openpyxl import Workbook

# step, message — 보드 실행로그 그리드 실시간 콜백
ProgressFn = Callable[[str, str], None]

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DEFAULT_SITE = "독일자라"
DEFAULT_URL = "https://www.zara.com/de/en/user/order"
# ★요건: 독일어(/de/de)가 아닌 영어(/de/en) 표기 사이트로 카테고리·URL 수집
ZARA_STORE = "de"
ZARA_LANG = "en"
ZARA_LOCALE_PATH = f"/{ZARA_STORE}/{ZARA_LANG}"
# 상위 카테고리는 보드/CLI 입력으로만 지정 (기본 프리필 없음)
DEFAULT_TOPS: list[str] = []

EXCEL_HEADERS = [
    "상위 카테고리명",
    "중위 카테고리명",
    "하위 카테고리명",
    "최종 카테고리명",
    "상위 최종 카테고리명",
    "최종 카테고리 URL주소",
]

# 보드 입력 그리드: 3행 × 10칸 = 최대 30개, 칸당 15자
TOP_GRID_ROWS = 3
TOP_GRID_COLS = 10
MAX_TOP = TOP_GRID_ROWS * TOP_GRID_COLS
TOP_CELL_MAX_LEN = 15

# ZARA 카테고리 링크: /de/de|en/slug-l123.html 또는 -m123.html
ZARA_CAT_HREF_RE = re.compile(
    r"^https?://(?:www\.)?zara\.com/de/(?:de|en)/[^?\s#]+-[lm]\d+\.html",
    re.I,
)
ZARA_CAT_PATH_RE = re.compile(r"/de/(?:de|en)/[^?\s#]+-[lm]\d+\.html", re.I)

# 영문 섹션명 기준 + 독일어 입력도 매칭 (수집 결과는 영어 표기)
TOP_ALIASES: dict[str, set[str]] = {
    "WOMAN": {"WOMAN", "WOMEN", "DAMEN", "FRAUEN", "LADIES"},
    "MAN": {"MAN", "MEN", "HERREN", "MÄNNER", "MAENNER"},
    "KIDS": {"KIDS", "KINDER", "CHILD", "CHILDREN"},
}


@dataclass
class Leaf:
    top: str
    mid: str
    low: str
    final: str
    category_url: str
    cat_id: str | None = None
    # 루트→최종 전체 경로 (입력 카테고리명 매칭·하위 전부 수집용)
    path: tuple[str, ...] = ()


@dataclass
class HierarchyRow:
    site_name: str
    top: str
    mid: str
    low: str
    final: str
    top_final_label: str
    final_category_url: str


@dataclass
class CrawlResult:
    ok: bool
    site_name: str
    site_url: str
    platform: str = ""
    applied_tops: list[str] = field(default_factory=list)
    rows: list[HierarchyRow] = field(default_factory=list)
    total: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    final_shot_path: str = ""
    run_log_dir: str = ""


def normalize_url(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        raise ValueError("사이트 URL이 비어 있습니다.")
    return s if s.startswith("http") else f"https://{s}"


def parse_top_cell(raw: str) -> tuple[str, str] | None:
    """상위 카테고리 칸 1개 해석.

    - ``카테고리명1`` → 사이트 매칭·엑셀 모두 동일
    - ``카테고리명1:카테고리명2`` → 사이트는 명1로 매칭, 엑셀 출력은 명2로 치환
    """
    s = (raw or "").strip()
    if not s:
        return None
    if len(s) > TOP_CELL_MAX_LEN:
        s = s[:TOP_CELL_MAX_LEN]
    if ":" in s:
        left, right = s.split(":", 1)
        match = left.strip()
        excel = right.strip()
        if not match:
            return None
        if not excel:
            excel = match
        return match, excel
    return s, s


def parse_tops(
    raw: list[str], max_n: int = MAX_TOP
) -> tuple[list[str], dict[str, str]]:
    seen: set[str] = set()
    match_names: list[str] = []
    rename: dict[str, str] = {}
    for r in raw:
        parsed = parse_top_cell(r)
        if parsed is None:
            continue
        match, excel = parsed
        key = match.upper()
        if key in seen:
            continue
        seen.add(key)
        match_names.append(match)
        rename[key] = excel
        if len(match_names) >= max_n:
            break
    return match_names, rename


def sanitize_tops(raw: list[str], max_n: int = MAX_TOP) -> list[str]:
    names, _rename = parse_tops(raw, max_n=max_n)
    return names


def excel_top_name(site_top: str, rename: dict[str, str]) -> str:
    key = (site_top or "").strip().upper()
    if key in rename:
        return rename[key]
    return (site_top or "").strip()


def top_final_label(top: str, final: str) -> str:
    t, f = top.strip(), final.strip()
    if not t:
        return f
    if not f:
        return t
    return f"{t} {f}"


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def is_zara_de_platform(html: str, url: str) -> bool:
    u = (url or "").lower()
    h = (html or "").lower()
    # /de/en/… (영문 UI) · /de/de/… (독문 UI) · /de/ 모두 DE 스토어
    if "zara.com" in u and re.search(r"(^|/)de(/|$)", urlparse(u).path):
        return True
    if "zara.com/de" in h or "zara deutschland" in h:
        return True
    if "zara" in h and ("/de/de/" in h or "/de/en/" in h or 'lang="de"' in h):
        return True
    return False


def zara_store_homes(site_url: str) -> list[str]:
    """카테고리 수집용 스토어 홈 — 영어(/de/en)만 사용."""
    parsed = urlparse(normalize_url(site_url))
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return [f"{origin}{ZARA_LOCALE_PATH}/"]


def to_english_locale_url(url: str) -> str:
    """카테고리 URL을 /de/de → /de/en 영어 표기로 정규화."""
    if not url:
        return url
    return re.sub(r"(zara\.com)/de/de/", r"\1/de/en/", url, flags=re.I)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": DEFAULT_UA,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            # 영어 UI(/de/en) 우선
            "Accept-Language": "en-GB,en;q=0.9,de;q=0.5,ko;q=0.3",
            "Cache-Control": "no-cache",
        }
    )
    return s


def fetch_text(url: str, session: requests.Session | None = None) -> str:
    sess = session or _session()
    res = sess.get(url, timeout=60, allow_redirects=True)
    if res.status_code == 403:
        raise RuntimeError(
            f"ZARA 접속이 차단되었습니다 (HTTP 403): {url}\n"
            "  · 로컬 PC 브라우저에서 열리는지 확인하세요.\n"
            "  · VPN/사내망 차단이면 네트워크를 바꾼 뒤 다시 시도하세요."
        )
    if not res.ok:
        raise RuntimeError(f"페이지 요청 실패 ({res.status_code}): {url}")
    res.encoding = res.apparent_encoding or res.encoding or "utf-8"
    return res.text


def _abs_zara_url(origin: str, href: str) -> str | None:
    if not href:
        return None
    abs_u = urljoin(origin + "/", href.strip())
    abs_u = to_english_locale_url(abs_u)
    # 상대 경로가 /de/ 없이 오면 영어 로케일로 붙임
    if ZARA_CAT_HREF_RE.match(abs_u):
        return abs_u.split("?")[0].split("#")[0]
    if ZARA_CAT_PATH_RE.search(abs_u):
        return to_english_locale_url(abs_u.split("?")[0].split("#")[0])
    return None


def _cat_id_from_url(url: str) -> str | None:
    m = re.search(r"-([lm])(\d+)\.html$", url or "", re.I)
    return m.group(2) if m else None


def _normalize_top_key(name: str) -> str:
    return clean_text(name).upper()


def _top_match_keys(name: str) -> set[str]:
    """입력/사이트 카테고리명을 비교용 키 집합으로."""
    key = _normalize_top_key(name)
    keys = {key}
    for canon, alts in TOP_ALIASES.items():
        if key == canon or key in alts:
            keys |= {canon} | set(alts)
    return keys


def category_name_matches(candidate: str, query: str) -> bool:
    """카테고리명 일치 (대소문자 무시 + WOMAN/DAMEN 등 동의어)."""
    if not (candidate or "").strip() or not (query or "").strip():
        return False
    return bool(_top_match_keys(candidate) & _top_match_keys(query))


def leaf_path(leaf: Leaf) -> tuple[str, ...]:
    if leaf.path:
        return leaf.path
    return tuple(p for p in (leaf.top, leaf.mid, leaf.low, leaf.final) if p)


def levels_from_path(path: list[str] | tuple[str, ...]) -> tuple[str, str, str, str]:
    """경로 → (top, mid, low, final)."""
    parts = [p for p in path if p]
    if not parts:
        return "", "", "", ""
    if len(parts) == 1:
        return parts[0], "", "", parts[0]
    if len(parts) == 2:
        return parts[0], "", "", parts[1]
    if len(parts) == 3:
        return parts[0], parts[1], "", parts[2]
    return parts[0], parts[1], parts[2], parts[-1]


def filter_subcategories_of(leaves: list[Leaf], names: list[str]) -> list[Leaf]:
    """입력 카테고리명과 일치하는 노드의 하위 카테고리를 전부 반환.

    경로(top/mid/low/final) 중 하나라도 입력명과 일치하면
    그 노드 자신·하위(해당 leaf)를 포함한다.
    """
    if not names:
        return []
    queries = [n for n in names if (n or "").strip()]
    if not queries:
        return []
    out: list[Leaf] = []
    for leaf in leaves:
        path = leaf_path(leaf)
        if any(
            category_name_matches(seg, q) for seg in path for q in queries
        ):
            out.append(leaf)
    return out


def filter_by_top(leaves: list[Leaf], tops: list[str]) -> list[Leaf]:
    """하위 호환 — 카테고리명 일치 시 하위 전부 수집."""
    return filter_subcategories_of(leaves, tops)


def _dedupe(leaves: list[Leaf]) -> list[Leaf]:
    seen: set[str] = set()
    out: list[Leaf] = []
    for leaf in leaves:
        key = "|".join(
            [
                *leaf_path(leaf),
                leaf.cat_id or leaf.category_url,
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(leaf)
    return out


def _make_leaf(
    path: list[str],
    *,
    category_url: str,
    cat_id: str | None,
) -> Leaf:
    top, mid, low, final = levels_from_path(path)
    return Leaf(
        top=top,
        mid=mid,
        low=low,
        final=final,
        category_url=category_url,
        cat_id=cat_id,
        path=tuple(p for p in path if p),
    )


def _walk_zara_json(
    node: Any,
    *,
    origin: str,
    path: list[str],
    leaves: list[Leaf],
) -> None:
    if not isinstance(node, dict):
        if isinstance(node, list):
            for child in node:
                _walk_zara_json(child, origin=origin, path=path, leaves=leaves)
        return

    name = clean_text(
        str(
            node.get("name")
            or node.get("categoryName")
            or node.get("sectionName")
            or ""
        )
    )
    kids = (
        node.get("subcategories")
        or node.get("categories")
        or node.get("children")
        or []
    )
    href = str(node.get("url") or node.get("seoKeyword") or node.get("path") or "")
    cat_id = node.get("id") or node.get("categoryId")
    if href and not href.startswith("http"):
        if href.startswith("/"):
            href = urljoin(origin, href)
        elif re.search(r"-[lm]\d+$", href, re.I):
            href = f"{origin}{ZARA_LOCALE_PATH}/{href}.html"
        else:
            href = ""

    abs_url = _abs_zara_url(origin, href) if href else None
    if abs_url:
        abs_url = to_english_locale_url(abs_url)
    new_path = path + ([name] if name else [])
    cid = str(cat_id) if cat_id else (_cat_id_from_url(abs_url) if abs_url else None)

    # URL이 있는 노드는 모두 후보로 쌓음 — 이후 입력명 매칭 시 하위 전부 필터
    if abs_url and name:
        leaves.append(_make_leaf(new_path, category_url=abs_url, cat_id=cid))

    if isinstance(kids, list):
        for child in kids:
            _walk_zara_json(child, origin=origin, path=new_path, leaves=leaves)


def parse_zara_categories_json(text: str, base_url: str) -> list[Leaf]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
    leaves: list[Leaf] = []
    root = data.get("categories") if isinstance(data, dict) else data
    if root is None and isinstance(data, dict):
        root = data
    _walk_zara_json(root, origin=origin, path=[], leaves=leaves)
    return _dedupe(leaves)


def parse_zara_html_links(html: str, base_url: str) -> list[Leaf]:
    """HTML 앵커에서 ZARA DE 카테고리 링크를 수집 (API 실패 시 폴백)."""
    # html.parser 우선 (lxml 미설치 환경 대응)
    soup = BeautifulSoup(html, "html.parser")
    origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
    leaves: list[Leaf] = []
    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        abs_url = _abs_zara_url(origin, href)
        if not abs_url:
            continue
        name = clean_text(a.get_text()) or clean_text(a.get("title") or "")
        if not name or len(name) > 80:
            continue
        # 상위 추정: 영어 섹션명(WOMAN/MAN/KIDS) 기준
        top = "WOMAN"
        slug = urlparse(abs_url).path.rsplit("/", 1)[-1].lower()
        if (
            slug.startswith("man-")
            or slug.startswith("men-")
            or slug.startswith("herren")
            or "-man-" in f"-{slug}"
            or "-men-" in f"-{slug}"
            or "-herren-" in f"-{slug}"
        ):
            top = "MAN"
        elif (
            slug.startswith("kids")
            or slug.startswith("kinder")
            or "child" in slug
        ):
            top = "KIDS"
        elif (
            slug.startswith("woman")
            or slug.startswith("women")
            or slug.startswith("damen")
        ):
            top = "WOMAN"
        leaves.append(
            _make_leaf(
                [top, name],
                category_url=to_english_locale_url(abs_url),
                cat_id=_cat_id_from_url(abs_url),
            )
        )
    return _dedupe(leaves)


def collect_zara_leaves(
    site_url: str, progress: ProgressFn | None = None
) -> tuple[list[Leaf], list[str]]:
    """카테고리 트리 수집 — 영어 UI(/de/en)만 사용.

    site_url 이 주문/계정 페이지여도 독일자라 영어 홈·categories API 로 수집한다.
    """
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    warnings: list[str] = []
    sess = _session()
    origin = f"{urlparse(site_url).scheme}://{urlparse(site_url).netloc}"
    homes = zara_store_homes(site_url)
    en_home = homes[0]

    # 1) categories ajax — 영어(/de/en)만
    ajax_urls = [
        urljoin(en_home, "categories?ajax=true"),
        f"{origin}{ZARA_LOCALE_PATH}/categories?ajax=true",
        f"https://www.zara.com{ZARA_LOCALE_PATH}/categories?ajax=true",
    ]
    seen_ajax: set[str] = set()
    for ajax in ajax_urls:
        if ajax in seen_ajax:
            continue
        seen_ajax.add(ajax)
        log("API", f"카테고리 API 요청: {ajax}")
        try:
            text = fetch_text(ajax, sess)
            if text.strip().startswith("{") or text.strip().startswith("["):
                leaves = parse_zara_categories_json(text, en_home)
                if leaves:
                    for leaf in leaves:
                        leaf.category_url = to_english_locale_url(leaf.category_url)
                    log("API", f"카테고리 API 성공 — {len(leaves)}건")
                    return leaves, warnings
            warnings.append(f"카테고리 API 응답이 JSON이 아님: {ajax}")
            log("API", f"JSON 아님 — 다음 URL 시도")
        except Exception as e:  # noqa: BLE001
            warnings.append(f"카테고리 API 실패({ajax}): {e}")
            log("API", f"실패: {e}")

    # 2) HTML 폴백 — 영어 스토어 홈만
    log("HTML", f"HTML 폴백: {en_home}")
    try:
        html = fetch_text(en_home, sess)
        if not is_zara_de_platform(html, en_home):
            raise RuntimeError("HTML이 독일자라(영어 /de/en) 형식이 아닙니다.")
        leaves = parse_zara_html_links(html, en_home)
        if leaves:
            warnings.append("카테고리 API 대신 HTML 링크 폴백으로 수집했습니다. (영어 /de/en)")
            log("HTML", f"HTML 링크 수집 — {len(leaves)}건")
            return leaves, warnings
    except Exception as e:  # noqa: BLE001
        warnings.append(f"HTML 폴백 실패({en_home}): {e}")
        log("HTML", f"실패: {e}")
        raise

    return [], warnings


def new_run_log_dir(root: Path | None = None) -> Path:
    base = (root or Path(__file__).resolve().parent) / "run-logs"
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = base / stamp
    path.mkdir(parents=True, exist_ok=True)
    return path


def capture_final_screenshot(
    page_url: str,
    out_dir: Path,
    progress: ProgressFn | None = None,
) -> Path | None:
    """독일자라 영어 페이지 최종 스크린샷 (Playwright)."""
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    shot_path = out_dir / "final.png"
    # 주문 URL이어도 영어 스토어 홈을 찍어 카테고리 UI를 보여 줌
    homes = zara_store_homes(page_url)
    target = homes[0] if homes else to_english_locale_url(page_url)
    log("SHOT", f"최종 스크린샷 촬영 시작: {target}")
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # noqa: BLE001
        log("SHOT", f"Playwright 미설치/로드 실패: {e}")
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                locale="en-GB",
                user_agent=DEFAULT_UA,
                viewport={"width": 1440, "height": 900},
            )
            page = context.new_page()
            page.goto(target, wait_until="domcontentloaded", timeout=90_000)
            time.sleep(2.0)
            page.screenshot(path=str(shot_path), full_page=False)
            browser.close()
        if shot_path.is_file():
            log("SHOT", f"최종 스크린샷 저장: {shot_path}")
            return shot_path
        log("SHOT", "스크린샷 파일이 생성되지 않았습니다.")
        return None
    except Exception as e:  # noqa: BLE001
        log("SHOT", f"스크린샷 실패: {e}")
        return None


def crawl_site(
    site_name: str,
    site_url: str,
    top_categories: list[str],
    progress: ProgressFn | None = None,
    take_screenshot: bool = True,
    run_root: Path | None = None,
) -> CrawlResult:
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    name = (site_name or "").strip() or DEFAULT_SITE
    run_dir = new_run_log_dir(run_root)
    log("시작", f"독일자라 수집 시작 — {name}")
    log("시작", f"사이트 URL: {site_url}")
    log("시작", f"로그 폴더: {run_dir}")

    try:
        url = normalize_url(site_url or DEFAULT_URL)
    except ValueError as e:
        log("오류", str(e))
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=site_url or "",
            errors=[str(e)],
            run_log_dir=str(run_dir),
        )

    tops, rename = parse_tops(top_categories)
    if not tops:
        err = f"카테고리명을 1개 이상 입력하세요. (최대 {MAX_TOP}개)"
        log("오류", err)
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=[],
            errors=[err],
            run_log_dir=str(run_dir),
        )
    log("입력", f"상위 카테고리: {', '.join(tops)}")

    if not is_zara_de_platform("", url):
        err = (
            "지원하지 않는 사이트 형식입니다. "
            "P1_ZARA_DE는 zara.com/de (독일자라)만 지원합니다."
        )
        log("오류", err)
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=[err],
            run_log_dir=str(run_dir),
        )

    try:
        leaves, warn_collect = collect_zara_leaves(url, progress=progress)
    except Exception as e:  # noqa: BLE001
        log("오류", str(e))
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=[str(e)],
            run_log_dir=str(run_dir),
        )

    if not leaves:
        err = (
            "카테고리 메뉴를 찾지 못했습니다. "
            "로컬 PC에서 ZARA DE 접속·수집을 다시 시도하세요."
        )
        log("오류", err)
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=[err],
            warnings=warn_collect,
            run_log_dir=str(run_dir),
        )

    log("필터", f"수집 원본 {len(leaves)}건 → 입력 카테고리명 일치 시 하위 전부 수집")
    filtered = filter_subcategories_of(leaves, tops)
    if not filtered:
        err = (
            f"지정한 카테고리명({', '.join(tops)})과 일치하는 하위 카테고리를 찾지 못했습니다."
        )
        log("오류", err)
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=[err],
            warnings=warn_collect,
            run_log_dir=str(run_dir),
        )

    warnings = list(warn_collect)
    if len(filtered) < len(leaves):
        warnings.append(
            f"카테고리명 매칭: 전체 {len(leaves)}건 중 하위 {len(filtered)}건 "
            f"({', '.join(tops)})"
        )
    aliased = [f"{m}→{rename[m.upper()]}" for m in tops if rename.get(m.upper(), m) != m]
    if aliased:
        warnings.append("엑셀 상위명 치환: " + ", ".join(aliased))

    rows = [
        HierarchyRow(
            site_name=name,
            top=excel_top_name(leaf.top, rename),
            mid=leaf.mid,
            low=leaf.low,
            final=leaf.final,
            top_final_label=top_final_label(
                excel_top_name(leaf.top, rename), leaf.final
            ),
            final_category_url=leaf.category_url,
        )
        for leaf in filtered
    ]
    log("결과", f"필터 후 {len(rows)}건 확정")
    for i, r in enumerate(rows[:30], start=1):
        log("결과", f"{i}. {r.top_final_label} | {r.final_category_url}")
    if len(rows) > 30:
        log("결과", f"… 외 {len(rows) - 30}건")

    shot_path = ""
    if take_screenshot:
        shot = capture_final_screenshot(url, run_dir, progress=progress)
        if shot is not None:
            shot_path = str(shot)
        else:
            warnings.append("최종 스크린샷 촬영에 실패했습니다.")

    log("완료", f"수집 완료 — {len(rows)}건 · 영어(/de/en)")
    return CrawlResult(
        ok=True,
        site_name=name,
        site_url=url,
        platform="독일자라 영어 (zara.com/de/en)",
        applied_tops=tops,
        rows=rows,
        total=len(rows),
        warnings=warnings,
        final_shot_path=shot_path,
        run_log_dir=str(run_dir),
    )


def save_excel(rows: list[HierarchyRow], site_name: str, out_dir: Path | str) -> Path:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r'[\\/:*?"<>|]', "_", site_name or "ZARA_DE")[:40]
    stamp = date.today().strftime("%Y%m%d")
    path = out / f"{safe}_카테고리URL_LIST_{stamp}.xlsx"

    wb = Workbook()
    ws = wb.active
    ws.title = "카테고리표"
    ws.append(list(EXCEL_HEADERS))
    for r in rows:
        ws.append([r.top, r.mid, r.low, r.final, r.top_final_label, r.final_category_url])
    wb.save(path)
    return path


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(description="P1_ZARA_DE 카테고리 URL 추출")
    p.add_argument("--site", default=DEFAULT_SITE)
    p.add_argument("--url", default=DEFAULT_URL)
    p.add_argument(
        "--tops",
        default="",
        help="쉼표 구분 상위 카테고리(필수 입력). 명1:명2 = 사이트명1→엑셀명2 치환",
    )
    p.add_argument("--out", default=".", help="엑셀 저장 폴더")
    args = p.parse_args()
    tops = [t.strip() for t in args.tops.split(",") if t.strip()]
    result = crawl_site(args.site, args.url, tops)
    if not result.ok:
        print("실패:", "; ".join(result.errors))
        raise SystemExit(1)
    path = save_excel(result.rows, result.site_name, args.out)
    print(f"완료 {result.total}행 → {path}")


if __name__ == "__main__":
    main()
