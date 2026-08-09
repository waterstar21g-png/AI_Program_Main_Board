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
    "총상품수",
    "상품수집가능개수",
    "검색수",
    "리뷰수",
]

# 보드 입력 그리드: 20행 × 3열
# 한 행 = 상위 카테고리명, 중위 카테고리명, 하위 카테고리 URL
TOP_GRID_ROWS = 20
TOP_GRID_COLS = 3
TOP_GRID_LEVELS = 3  # 상위·중위·하위URL
MAX_TOP = TOP_GRID_ROWS
TOP_CELL_MAX_LEN = 15  # 상위·중위 명
URL_CELL_MAX_LEN = 240  # 하위 카테고리 URL
# 보드 Entry width: 상위·중위 기준, 하위 URL은 10배
NAME_ENTRY_WIDTH = 12
URL_ENTRY_WIDTH = NAME_ENTRY_WIDTH * 10
COL_LABELS: tuple[str, ...] = (
    "상위 카테고리명",
    "중위 카테고리명",
    "하위 카테고리 URL",
)
LEVEL_LABELS = COL_LABELS  # 보드 열 헤더
# 하위 호환 (이전 그리드 상수)
LOW_SLOT_COUNT = 1

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
    total_product_count: int = 0  # 총상품수
    collectible_count: int = 0  # 상품수집가능개수
    search_count: int = 0  # 검색수
    review_count: int = 0  # 리뷰수


@dataclass
class CategoryStats:
    """카테고리 URL별 상품·검색·리뷰 수치."""

    total_product_count: int = 0
    collectible_count: int = 0
    search_count: int = 0
    review_count: int = 0


@dataclass
class CategorySpec:
    """입력 1경로 = 상위·중위 명 + (하위명 또는 하위 URL)."""

    match1: str = ""
    match2: str = ""
    match3: str = ""
    excel1: str = ""
    excel2: str = ""
    excel3: str = ""
    # 하위 카테고리 URL (있으면 URL로 앵커 매칭 → 최종 카테고리 리스트업)
    low_url: str = ""

    def match_levels(self) -> list[str]:
        return [x for x in (self.match1, self.match2, self.match3) if x]

    def excel_levels(self) -> tuple[str, str, str]:
        return (self.excel1 or "", self.excel2 or "", self.excel3 or "")

    def label(self) -> str:
        if self.low_url:
            head = " > ".join(x for x in (self.excel1 or self.match1, self.excel2 or self.match2) if x)
            return f"{head} > {self.low_url}" if head else self.low_url
        return " > ".join(self.match_levels())


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


def fill_hierarchy_from_previous(
    raw_paths: list[tuple[str, str, str]],
) -> list[tuple[str, str, str]]:
    """상위·중위 생략 시 바로 이전 경로의 상위·중위를 그대로 복사.

    하위는 경로마다 입력. 완전히 빈 경로는 건너뛰며 이전 값은 유지.
    """
    prev1, prev2 = "", ""
    out: list[tuple[str, str, str]] = []
    for raw1, raw2, raw3 in raw_paths:
        a1 = (raw1 or "").strip()
        a2 = (raw2 or "").strip()
        a3 = (raw3 or "").strip()
        if not (a1 or a2 or a3):
            continue
        if not a1:
            a1 = prev1
        if not a2:
            a2 = prev2
        out.append((a1, a2, a3))
        if a1:
            prev1 = a1
        if a2:
            prev2 = a2
    return out


def normalize_category_url(raw: str) -> str | None:
    """하위 카테고리 URL 정규화 (/de/en, 쿼리 제거). 실패 시 None."""
    s = (raw or "").strip()
    if not s:
        return None
    if len(s) > URL_CELL_MAX_LEN:
        s = s[:URL_CELL_MAX_LEN]
    if not s.startswith("http"):
        s = f"https://{s}"
    try:
        s = normalize_url(s)
    except ValueError:
        return None
    s = to_english_locale_url(s.split("?")[0].split("#")[0])
    if ZARA_CAT_HREF_RE.match(s) or ZARA_CAT_PATH_RE.search(s):
        return s
    # zara.com/de/... 형태면 허용 (id 없는 경로도 비교용)
    if re.search(r"zara\.com/de/(?:de|en)/", s, re.I):
        return s
    return None


def category_urls_equivalent(a: str, b: str) -> bool:
    """두 카테고리 URL이 동일 노드인지 (영문 로케일·cat_id 기준)."""
    na = to_english_locale_url((a or "").split("?")[0].split("#")[0]).rstrip("/").lower()
    nb = to_english_locale_url((b or "").split("?")[0].split("#")[0]).rstrip("/").lower()
    if not na or not nb:
        return False
    if na == nb:
        return True
    ida, idb = _cat_id_from_url(na), _cat_id_from_url(nb)
    return bool(ida and idb and ida == idb)


def expand_grid_rows_to_paths(
    raw_rows: list[tuple[str, ...] | list[str]],
) -> list[tuple[str, str, str]]:
    """N행×3열(상위·중위·하위URL) → (상위, 중위, 하위URL) 목록.

    상위/중위 생략 시 이전 행 값을 복사. 하위 URL이 있는 행만 채택.
    """
    prev1, prev2 = "", ""
    paths: list[tuple[str, str, str]] = []
    for row in raw_rows[:TOP_GRID_ROWS]:
        cells = [(c or "").strip() for c in list(row)[:TOP_GRID_COLS]]
        if len(cells) < TOP_GRID_COLS:
            cells.extend([""] * (TOP_GRID_COLS - len(cells)))
        a1, a2, url = cells[0], cells[1], cells[2]
        if not (a1 or a2 or url):
            continue
        if not a1:
            a1 = prev1
        if not a2:
            a2 = prev2
        if a1:
            prev1 = a1
        if a2:
            prev2 = a2
        if not url:
            continue
        paths.append((a1, a2, url))
    return paths


def parse_category_specs(
    raw_paths: list[tuple[str, str, str]], max_n: int = MAX_TOP
) -> list[CategorySpec]:
    """(상위, 중위, 하위명또는URL) 원시 입력 → CategorySpec 목록.

    ★요건: 상위·중위 생략 시 이전 경로 값을 복사한 뒤 파싱한다.
    3번째 칸이 URL이면 low_url 로 저장한다.
    """
    filled = fill_hierarchy_from_previous(raw_paths)
    out: list[CategorySpec] = []
    for raw1, raw2, raw3 in filled:
        url = normalize_category_url(raw3)
        c1 = parse_top_cell(raw1)
        c2 = parse_top_cell(raw2)
        m1 = e1 = m2 = e2 = m3 = e3 = ""
        if c1 is not None:
            m1, e1 = c1
        if c2 is not None:
            m2, e2 = c2
        if url:
            out.append(
                CategorySpec(
                    match1=m1,
                    match2=m2,
                    match3="",
                    excel1=e1,
                    excel2=e2,
                    excel3="",
                    low_url=url,
                )
            )
        else:
            c3 = parse_top_cell(raw3)
            if c3 is not None:
                m3, e3 = c3
            if not (m1 or m2 or m3):
                continue
            out.append(
                CategorySpec(
                    match1=m1, match2=m2, match3=m3, excel1=e1, excel2=e2, excel3=e3
                )
            )
        if len(out) >= max_n:
            break
    return out


def parse_grid_category_specs(
    raw_rows: list[tuple[str, ...] | list[str]], max_n: int = MAX_TOP
) -> list[CategorySpec]:
    """N행×3열(상위·중위·하위URL) → CategorySpec 목록."""
    return parse_category_specs(expand_grid_rows_to_paths(raw_rows), max_n=max_n)


def specs_from_flat_names(names: list[str], max_n: int = MAX_TOP) -> list[CategorySpec]:
    """하위 호환: 단일 카테고리명 목록 → 상위만 채운 스펙."""
    paths = [(n, "", "") for n in names if (n or "").strip()]
    return parse_category_specs(paths, max_n=max_n)


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


def hierarchy_output_label(excel_levels: tuple[str, str, str], final: str) -> str:
    """입력 계층 + 사이트 최종명을 계층 표기로 합친다."""
    parts = [x.strip() for x in excel_levels if (x or "").strip()]
    f = (final or "").strip()
    if f and (not parts or _normalize_top_key(f) != _normalize_top_key(parts[-1])):
        parts.append(f)
    return " > ".join(parts)


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


def path_matches_hierarchy(path: tuple[str, ...], levels: list[str]) -> bool:
    """경로가 입력 계층(순서 유지 부분열)과 일치하는지."""
    if not levels:
        return False
    idx = 0
    for level in levels:
        found = -1
        for i in range(idx, len(path)):
            if category_name_matches(path[i], level):
                found = i
                break
        if found < 0:
            return False
        idx = found + 1
    return True


def filter_subcategories_of(leaves: list[Leaf], names: list[str]) -> list[Leaf]:
    """하위 호환 — 단일 카테고리명 목록으로 하위 전부 수집."""
    specs = specs_from_flat_names(names)
    return [leaf for leaf, _spec in filter_by_hierarchy_specs(leaves, specs)]


def find_anchor_by_url(leaves: list[Leaf], url: str) -> Leaf | None:
    """하위 카테고리 URL과 동일한 노드(리프)를 찾는다."""
    for leaf in leaves:
        if category_urls_equivalent(leaf.category_url, url):
            return leaf
    return None


def path_under_prefix(path: tuple[str, ...], prefix: tuple[str, ...]) -> bool:
    """path 가 prefix 노드 아래(자기 자신 포함)인지."""
    if not prefix or len(path) < len(prefix):
        return False
    for i, p in enumerate(prefix):
        if _normalize_top_key(path[i]) == _normalize_top_key(p):
            continue
        if not category_name_matches(path[i], p):
            return False
    return True


def filter_by_hierarchy_specs(
    leaves: list[Leaf], specs: list[CategorySpec]
) -> list[tuple[Leaf, CategorySpec]]:
    """입력 스펙과 일치하는 최종 카테고리 전부 (leaf, 매칭스펙).

    - low_url 있으면: 해당 URL 노드 및 그 하위 전부 → 최종 카테고리명 리스트업
    - 없으면: 상위·중위·하위 명 계층 매칭
    """
    if not specs:
        return []
    out: list[tuple[Leaf, CategorySpec]] = []
    seen: set[str] = set()

    def _add(leaf: Leaf, spec: CategorySpec) -> None:
        path = leaf_path(leaf)
        key = "|".join([*path, leaf.cat_id or leaf.category_url])
        if key in seen:
            return
        seen.add(key)
        out.append((leaf, spec))

    for spec in specs:
        if spec.low_url:
            anchor = find_anchor_by_url(leaves, spec.low_url)
            if anchor is None:
                continue
            # 엑셀 하위명 = URL 노드의 사이트 카테고리명
            if not (spec.excel3 or "").strip():
                spec.excel3 = anchor.final
            if not (spec.match3 or "").strip():
                spec.match3 = anchor.final
            prefix = leaf_path(anchor)
            for leaf in leaves:
                lp = leaf_path(leaf)
                if path_under_prefix(lp, prefix) or category_urls_equivalent(
                    leaf.category_url, spec.low_url
                ):
                    _add(leaf, spec)
            continue

        levels = spec.match_levels()
        if not levels:
            continue
        for leaf in leaves:
            if path_matches_hierarchy(leaf_path(leaf), levels):
                _add(leaf, spec)
    return out


def filter_by_top(leaves: list[Leaf], tops: list[str]) -> list[Leaf]:
    """하위 호환 — 카테고리명 일치 시 하위 전부 수집."""
    return filter_subcategories_of(leaves, tops)


def hierarchy_row_from_match(
    site_name: str, leaf: Leaf, spec: CategorySpec
) -> HierarchyRow:
    """입력 상위·중위(+URL노드 하위명)를 엑셀에 반영하고 최종·URL은 사이트 값."""
    e1, e2, e3 = spec.excel_levels()
    final = leaf.final
    return HierarchyRow(
        site_name=site_name,
        top=e1,
        mid=e2,
        low=e3,
        final=final,
        top_final_label=hierarchy_output_label((e1, e2, e3), final),
        final_category_url=leaf.category_url,
    )


def _parse_int_count(raw: Any) -> int:
    if raw is None or isinstance(raw, bool):
        return 0
    if isinstance(raw, (int, float)):
        return max(0, int(raw))
    s = re.sub(r"[^\d]", "", str(raw))
    return int(s) if s else 0


def _product_unavailable(obj: dict) -> bool:
    """품절/비가용 여부 (가능하면 수집 제외)."""
    for key in ("availability", "availabilityType", "productAvailability"):
        val = str(obj.get(key) or "").upper()
        if val in {"OUT_OF_STOCK", "SOLD_OUT", "UNAVAILABLE", "COMING_SOON"}:
            return True
    if obj.get("isBuyable") is False:
        return True
    if obj.get("soldOut") is True:
        return True
    return False


def count_products_in_zara_payload(data: Any) -> tuple[int, int, int]:
    """ZARA category products JSON → (총상품수, 수집가능, 리뷰합).

    productGroups / commercialComponents / products 등 다양한 응답 형태를 지원.
    """
    # 명시적 total 필드 우선
    if isinstance(data, dict):
        for key in (
            "totalProducts",
            "totalProductsCount",
            "productsCount",
            "productCount",
            "totalCount",
            "total",
        ):
            if key in data and data[key] is not None:
                total = _parse_int_count(data[key])
                if total > 0:
                    return total, total, 0

    ids: set[str] = set()
    collectible_ids: set[str] = set()
    review_sum = 0

    def walk(node: Any) -> None:
        nonlocal review_sum
        if isinstance(node, dict):
            # 상품 후보
            comps = node.get("commercialComponents")
            if isinstance(comps, list):
                for c in comps:
                    if not isinstance(c, dict):
                        continue
                    cid = c.get("id") or c.get("productId") or c.get("reference")
                    if cid is None:
                        continue
                    key = str(cid)
                    ids.add(key)
                    if not _product_unavailable(c):
                        collectible_ids.add(key)
                    for rk in ("numReviews", "reviewCount", "reviewsCount"):
                        if c.get(rk) is not None:
                            review_sum += _parse_int_count(c.get(rk))
            # products 배열
            prods = node.get("products")
            if isinstance(prods, list):
                for c in prods:
                    if not isinstance(c, dict):
                        continue
                    cid = c.get("id") or c.get("productId") or c.get("reference")
                    if cid is None:
                        continue
                    key = str(cid)
                    ids.add(key)
                    if not _product_unavailable(c):
                        collectible_ids.add(key)
                    for rk in ("numReviews", "reviewCount", "reviewsCount"):
                        if c.get(rk) is not None:
                            review_sum += _parse_int_count(c.get(rk))
            for v in node.values():
                if isinstance(v, (dict, list)):
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    total = len(ids)
    collectible = len(collectible_ids) if collectible_ids else total
    return total, collectible, review_sum


def parse_product_count_from_zara_html(html: str) -> tuple[int, int, int]:
    """카테고리 HTML 내 임베디드 JSON/상품카드에서 수량 추출."""
    text = html or ""
    # __PRELOADED_STATE__ / JSON blob
    for m in re.finditer(
        r'(\{[^{}]{0,200}"(?:totalProducts|productGroups|commercialComponents)"[\s\S]{0,500000}?\})',
        text,
    ):
        blob = m.group(1)
        try:
            data = json.loads(blob)
        except json.JSONDecodeError:
            continue
        total, coll, rev = count_products_in_zara_payload(data)
        if total:
            return total, coll, rev
    # data-productid 카드 수 폴백
    ids = set(re.findall(r'data-product[-_]?id=["\']?(\d+)', text, re.I))
    if ids:
        n = len(ids)
        return n, n, 0
    m = re.search(
        r'(?:totalProducts|productsCount|productCount)\D{0,12}(\d+)',
        text,
        re.I,
    )
    if m:
        n = _parse_int_count(m.group(1))
        return n, n, 0
    return 0, 0, 0


def fetch_zara_category_stats(
    category_url: str,
    *,
    cat_id: str | None = None,
    session: requests.Session | None = None,
    progress: ProgressFn | None = None,
) -> CategoryStats:
    """카테고리 URL별 총상품수·상품수집가능개수·검색수·리뷰수.

    1) `/de/en/category/{id}/products?ajax=true`
    2) 카테고리 페이지 HTML 파싱
    3) Playwright HTML 폴백
    """
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    sess = session or _session()
    stats = CategoryStats()
    page_url = to_english_locale_url((category_url or "").split("?")[0].split("#")[0])
    cid = (cat_id or _cat_id_from_url(page_url) or "").strip()
    origin = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"

    # 1) products ajax
    if cid:
        api = f"{origin}{ZARA_LOCALE_PATH}/category/{cid}/products?ajax=true"
        try:
            log("상품수", f"API: {api}")
            text = fetch_text(api, sess)
            if text.strip().startswith("{") or text.strip().startswith("["):
                data = json.loads(text)
                total, coll, rev = count_products_in_zara_payload(data)
                if total or coll:
                    stats.total_product_count = total
                    stats.collectible_count = coll or total
                    stats.search_count = total
                    stats.review_count = rev
                    return stats
        except Exception as e:  # noqa: BLE001
            log("상품수", f"API 실패: {e}")

    # 2) 카테고리 페이지 HTML
    html = ""
    try:
        html = fetch_text(page_url, sess)
        total, coll, rev = parse_product_count_from_zara_html(html)
        if total or coll:
            stats.total_product_count = total
            stats.collectible_count = coll or total
            stats.search_count = total
            stats.review_count = rev
            return stats
    except Exception as e:  # noqa: BLE001
        log("상품수", f"HTML 실패: {e}")

    # 3) Playwright 폴백
    try:
        html = fetch_html_playwright(page_url, progress=progress)
        total, coll, rev = parse_product_count_from_zara_html(html)
        stats.total_product_count = total
        stats.collectible_count = coll or total
        stats.search_count = total
        stats.review_count = rev
    except Exception as e:  # noqa: BLE001
        log("상품수", f"Playwright 실패: {e}")
    return stats


def enrich_rows_with_product_stats(
    rows: list[HierarchyRow],
    matched: list[tuple[Leaf, CategorySpec]],
    *,
    session: requests.Session | None = None,
    progress: ProgressFn | None = None,
) -> list[str]:
    """각 행의 최종 카테고리 URL로 상품수·검색수·리뷰수를 채운다."""
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    sess = session or _session()
    warnings: list[str] = []
    fail = 0
    cache: dict[str, CategoryStats] = {}
    total_n = len(rows)
    log("상품수", f"카테고리 URL별 상품수 조회 시작 — {total_n}건")
    for i, (row, (leaf, _spec)) in enumerate(zip(rows, matched), start=1):
        key = to_english_locale_url(leaf.category_url)
        if key in cache:
            stats = cache[key]
        else:
            stats = fetch_zara_category_stats(
                leaf.category_url,
                cat_id=leaf.cat_id,
                session=sess,
                progress=None,  # 행마다 과도한 로그 방지
            )
            cache[key] = stats
            if i == 1 or i % 10 == 0 or i == total_n:
                log(
                    "상품수",
                    f"[{i}/{total_n}] {leaf.final}: 총{stats.total_product_count} "
                    f"수집가능{stats.collectible_count} 검색{stats.search_count} "
                    f"리뷰{stats.review_count}",
                )
        row.total_product_count = stats.total_product_count
        row.collectible_count = stats.collectible_count
        row.search_count = stats.search_count
        row.review_count = stats.review_count
        if stats.total_product_count == 0 and stats.collectible_count == 0:
            fail += 1
        if i % 15 == 0:
            time.sleep(0.05)
    if fail:
        warnings.append(
            f"상품수 조회 실패/0건 {fail}개 URL (총상품수·상품수집가능개수·검색수·리뷰수 확인)"
        )
    return warnings


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


def _slug_name_from_url(url: str) -> str:
    """URL slug 에서 대략적인 카테고리명 추출."""
    path = urlparse(url).path.rsplit("/", 1)[-1]
    slug = re.sub(r"-[lm]\d+\.html$", "", path, flags=re.I)
    slug = slug.replace("-", " ").strip()
    return clean_text(slug).title() if slug else ""


def page_category_name(html: str, page_url: str) -> str:
    """페이지에서 하위(앵커) 카테고리명 추출."""
    soup = BeautifulSoup(html or "", "html.parser")
    for sel in ("h1", "[data-qa-qualifier='product-list-title']", "title"):
        el = soup.select_one(sel)
        if not el:
            continue
        text = clean_text(el.get_text())
        if not text:
            continue
        # title 태그: "Name | Zara Germany" 형태
        if sel == "title":
            text = text.split("|")[0].strip()
        if text and len(text) <= 80 and "zara" not in text.lower():
            return text
        if text and len(text) <= 80 and sel != "title":
            return text
    return _slug_name_from_url(page_url)


def parse_final_category_links(
    html: str, page_url: str
) -> list[tuple[str, str]]:
    """페이지 HTML에서 최종(하위) 카테고리 (이름, URL) 목록."""
    soup = BeautifulSoup(html or "", "html.parser")
    origin = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        abs_url = _abs_zara_url(origin, href)
        if not abs_url:
            continue
        if category_urls_equivalent(abs_url, page_url):
            continue
        name = clean_text(a.get_text()) or clean_text(a.get("title") or "")
        if not name or len(name) > 80:
            continue
        key = abs_url.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append((name, abs_url))
    return out


def fetch_html_playwright(url: str, progress: ProgressFn | None = None) -> str:
    """사용자 URL을 Playwright로 열어 HTML 반환 (요청 차단 시 폴백)."""
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Playwright 미설치/로드 실패: {e}") from e

    log("경로", f"Playwright로 최종 경로 열기: {url}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="en-GB",
            user_agent=DEFAULT_UA,
            viewport={"width": 1440, "height": 900},
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=90_000)
        time.sleep(2.0)
        html = page.content()
        browser.close()
    return html or ""


def fetch_user_category_html(
    url: str, progress: ProgressFn | None = None
) -> tuple[str, list[str]]:
    """사용자 하위 URL HTML 가져오기 — HTTP 우선, 실패 시 Playwright."""
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    warnings: list[str] = []
    sess = _session()
    try:
        log("경로", f"사용자 URL 접속(HTTP): {url}")
        html = fetch_text(url, sess)
        if html and len(html) > 500:
            return html, warnings
        warnings.append(f"HTTP 응답이 짧음 — Playwright 재시도: {url}")
    except Exception as e:  # noqa: BLE001
        warnings.append(f"HTTP 접속 실패({url}): {e}")
        log("경로", f"HTTP 실패 → Playwright: {e}")

    html = fetch_html_playwright(url, progress=progress)
    if not html:
        raise RuntimeError(f"사용자 URL을 열 수 없습니다: {url}")
    return html, warnings


def leaves_from_user_category_page(
    spec: CategorySpec,
    html: str,
    page_url: str,
) -> list[Leaf]:
    """사용자 하위 URL 페이지 → 최종 카테고리 Leaf 목록.

    경로 = [입력상위, 입력중위, 페이지명, (자식명)] — 엑셀 계층용.
    """
    top = (spec.excel1 or spec.match1 or "").strip()
    mid = (spec.excel2 or spec.match2 or "").strip()
    page_name = page_category_name(html, page_url)
    if not (spec.excel3 or "").strip():
        spec.excel3 = page_name
    if not (spec.match3 or "").strip():
        spec.match3 = page_name

    base_path = [p for p in (top, mid, page_name) if p]
    leaves: list[Leaf] = []
    # 페이지 자체도 최종 후보
    leaves.append(
        _make_leaf(
            base_path or [page_name or "Category"],
            category_url=page_url,
            cat_id=_cat_id_from_url(page_url),
        )
    )
    for child_name, child_url in parse_final_category_links(html, page_url):
        leaves.append(
            _make_leaf(
                base_path + [child_name],
                category_url=child_url,
                cat_id=_cat_id_from_url(child_url),
            )
        )
    return _dedupe(leaves)


def collect_user_driven_matches(
    specs: list[CategorySpec],
    progress: ProgressFn | None = None,
) -> tuple[list[tuple[Leaf, CategorySpec]], list[str], str]:
    """★사용자 DRIVEN: 입력 하위 URL로 최종 경로에 직접 접근해 리스트업.

    Returns: (matched, warnings, last_opened_url)
    """
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    out: list[tuple[Leaf, CategorySpec]] = []
    warnings: list[str] = []
    seen: set[str] = set()
    last_url = ""

    url_specs = [s for s in specs if (s.low_url or "").strip()]
    log("경로", f"사용자 DRIVEN 최종경로 접근 — {len(url_specs)}개 URL")

    for i, spec in enumerate(url_specs, start=1):
        page_url = to_english_locale_url(spec.low_url)
        last_url = page_url
        log("경로", f"[{i}/{len(url_specs)}] {spec.label()}")
        try:
            html, w = fetch_user_category_html(page_url, progress=progress)
            warnings.extend(w)
        except Exception as e:  # noqa: BLE001
            warnings.append(f"URL 접근 실패: {page_url} — {e}")
            log("오류", f"URL 접근 실패: {e}")
            continue

        leaves = leaves_from_user_category_page(spec, html, page_url)
        if not leaves:
            warnings.append(f"최종 카테고리 없음: {page_url}")
            log("경로", f"최종 카테고리 없음: {page_url}")
            continue

        # 페이지 자신 + 하위 링크 전부 리스트업 (필터는 URL 단위로 이미 확정)
        added = 0
        for leaf in leaves:
            key = "|".join(
                [*leaf_path(leaf), leaf.cat_id or leaf.category_url, spec.low_url]
            )
            if key in seen:
                continue
            seen.add(key)
            out.append((leaf, spec))
            added += 1
        log("경로", f"최종 카테고리 {added}건 확보 — {page_url}")

    return out, warnings, last_url


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
    target_url: str | None = None,
) -> Path | None:
    """독일자라 영어 페이지 최종 스크린샷 (Playwright)."""
    def log(step: str, msg: str) -> None:
        if progress:
            progress(step, msg)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    shot_path = out_dir / "final.png"
    # 사용자 DRIVEN: 입력 하위 URL 우선. 없으면 영어 스토어 홈.
    if target_url:
        target = to_english_locale_url(target_url)
    else:
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
    top_categories: list[str] | None = None,
    progress: ProgressFn | None = None,
    take_screenshot: bool = True,
    run_root: Path | None = None,
    category_paths: list[tuple[str, str, str]] | None = None,
    category_grid_rows: list[tuple[str, ...] | list[str]] | None = None,
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

    if category_grid_rows is not None:
        specs = parse_grid_category_specs(category_grid_rows)
    elif category_paths is not None:
        specs = parse_category_specs(category_paths)
    else:
        specs = specs_from_flat_names(list(top_categories or []))
    applied = [s.label() for s in specs]
    if not specs:
        err = (
            f"카테고리 행을 1행 이상 입력하세요. "
            f"({TOP_GRID_ROWS}행 × {TOP_GRID_COLS}열: "
            f"상위 카테고리명 · 중위 카테고리명 · 하위 카테고리 URL)"
        )
        log("오류", err)
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=[],
            errors=[err],
            run_log_dir=str(run_dir),
        )
    log("입력", "카테고리 계층: " + " · ".join(applied))

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
            applied_tops=applied,
            errors=[err],
            run_log_dir=str(run_dir),
        )

    url_specs = [s for s in specs if (s.low_url or "").strip()]
    name_specs = [s for s in specs if not (s.low_url or "").strip()]
    matched: list[tuple[Leaf, CategorySpec]] = []
    warnings: list[str] = []
    shot_target = ""

    # ★요건: 사용자 DRIVEN — 입력 하위 URL로 최종 경로 직접 접근
    if url_specs:
        log(
            "경로",
            "사용자 DRIVEN 모드 — 전체 메뉴가 아니라 입력 URL로 최종경로 접근",
        )
        ud_matched, ud_warn, last_url = collect_user_driven_matches(
            url_specs, progress=progress
        )
        matched.extend(ud_matched)
        warnings.extend(ud_warn)
        shot_target = last_url

    # 하위 URL 없이 이름만 있는 행은 기존 메뉴 수집 후 계층 매칭
    if name_specs:
        log("필터", f"이름 계층 {len(name_specs)}건 — 스토어 메뉴 수집")
        try:
            leaves, warn_collect = collect_zara_leaves(url, progress=progress)
        except Exception as e:  # noqa: BLE001
            warnings.append(str(e))
            log("오류", str(e))
            leaves = []
            warn_collect = [str(e)]
        warnings.extend(warn_collect)
        if leaves:
            matched.extend(filter_by_hierarchy_specs(leaves, name_specs))
        elif not url_specs:
            err = (
                "카테고리 메뉴를 찾지 못했습니다. "
                "하위 카테고리 URL을 입력하면 사용자 DRIVEN으로 "
                "최종 경로에 직접 접근합니다."
            )
            log("오류", err)
            return CrawlResult(
                ok=False,
                site_name=name,
                site_url=url,
                applied_tops=applied,
                errors=[err],
                warnings=warnings,
                run_log_dir=str(run_dir),
            )

    if not matched:
        err = (
            "입력한 하위 URL/계층에서 최종 카테고리를 찾지 못했습니다. "
            "하위 카테고리 URL이 브라우저에서 열리는지 확인하세요."
        )
        log("오류", err)
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=applied,
            errors=[err],
            warnings=warnings,
            run_log_dir=str(run_dir),
        )

    # ★요건: 입력 카테고리명을 엑셀에 계층화 반영 (상위/중위/하위)
    rows = [
        hierarchy_row_from_match(name, leaf, spec) for leaf, spec in matched
    ]
    # ★요건(P1과 동일): 카테고리 URL별 총상품수·상품수집가능개수·검색수·리뷰수
    warnings.extend(
        enrich_rows_with_product_stats(
            rows, matched, session=_session(), progress=progress
        )
    )
    log("결과", f"최종 카테고리 {len(rows)}건 확정 (입력 계층 반영)")
    for i, r in enumerate(rows[:30], start=1):
        log(
            "결과",
            f"{i}. [{r.top} | {r.mid or '—'} | {r.low or '—'}] "
            f"{r.final} | {r.final_category_url} | "
            f"총{r.total_product_count} 수집가능{r.collectible_count} "
            f"검색{r.search_count} 리뷰{r.review_count}",
        )
    if len(rows) > 30:
        log("결과", f"… 외 {len(rows) - 30}건")

    shot_path = ""
    if take_screenshot:
        shot = capture_final_screenshot(
            url,
            run_dir,
            progress=progress,
            target_url=shot_target or None,
        )
        if shot is not None:
            shot_path = str(shot)
        else:
            warnings.append("최종 스크린샷 촬영에 실패했습니다.")

    mode = "사용자DRIVEN" if url_specs else "메뉴매칭"
    log("완료", f"수집 완료 — {len(rows)}건 · {mode} · 영어(/de/en)")
    return CrawlResult(
        ok=True,
        site_name=name,
        site_url=url,
        platform=f"독일자라 영어 (zara.com/de/en) · {mode}",
        applied_tops=applied,
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
        ws.append(
            [
                r.top,
                r.mid,
                r.low,
                r.final,
                r.top_final_label,
                r.final_category_url,
                r.total_product_count,
                r.collectible_count,
                r.search_count,
                r.review_count,
            ]
        )
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
