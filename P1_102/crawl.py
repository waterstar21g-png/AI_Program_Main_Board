"""
P1_102_Category_Url_Extract — P1 복제본 + 일부 수정
(A-RT(ABC마트 계열) GNB → 계층 카테고리 URL 엑셀)

★요건(2026-08-19): "P1_102 프로그램 기능"
1. 기능: 수집사이트 추출 — P1과 유사하나 일부가 다름.
2. 입력: 홈페이지 주소 / 상위 카테고리명 1,2,... / 중위 카테고리명
   (상위 카테고리명 1의 하위목록 1-1,1-2,... · 상위 카테고리명 2의 하위목록 2-1,2-2,...)
3. 위 입력을 바탕으로,
   1) 하위 카테고리를 추출하되, 최종 카테고리명 = "하위 카테고리명" 으로 함
      (P1은 하위 카테고리 밑에 더 깊은 카테고리가 있으면 그 이름을 최종 카테고리명으로
       쓰지만, P1_102는 항상 "하위 카테고리명" 자체를 최종 카테고리명으로 고정한다.)
   2) 결과물(엑셀 헤더·형식)은 P1과 동일한 OUTPUT.

★요건(2026-08-19, 추가1): 보드 입력 화면 — 4개 행 구성
    상위 카테고리 : <입력칸> 1개
    중위 카테고리 : <입력그리드> 20개
    상위 카테고리 : <입력칸> 1개
    중위 카테고리 : <입력그리드> 20개
→ 상위 카테고리 그룹 2개(TOP_GROUP_COUNT), 그룹별 중위 카테고리 최대 20개(MID_PER_TOP).

★요건(2026-08-19, 추가2): "INPUT으로 입력된 값은 프로그램 종료후 재실행시도
초기값으로 그대로 보여줘" → 입력값(사업자명·사이트명·URL·저장폴더·상위/중위 카테고리명)을
``.last_input.json``에 저장해두고, 보드 재실행 시 이 값을 그대로 초기값으로 표시한다.

★요건(2026-08-19, 추가3):
1. 입력항목명에 추가 — 사이트명 옆에 "사업자명" 입력칸 추가.
2. 최종카테고리명 재정의 —
   사업자명 + '-' + 사이트명 + 상위카테고리명 + '-' + 중위 카테고리명 + '-' + 하위 카테고리명
   (사용자 원문 그대로: 사이트명과 상위카테고리명 사이에는 구분자를 넣지 않는다.)

★요건(2026-08-19, 추가4): 무신사(musinsa.com) 지원 —
사이트 URL이 musinsa.com 이면 A-RT(ABC마트) 대신 무신사 카테고리 메뉴
(https://www.musinsa.com/menu/category) 를 사용한다.
    - 상위 카테고리명 = 성별 탭("전체"/"남성"/"여성")
    - 중위 카테고리명 = 카테고리 메뉴 좌측 목록(뷰티·신발·상의·아우터·바지 등,
      화면에 표시되는 것만 인식 — data-section-name="catemenu_left")
    - 하위 카테고리명 = 상위·중위 선택 시 우측에 나타나는 버튼들(같은 화면에서
      data-section-name="catemenu_right" 로 한 번에 노출) 중 "신상품 보기"·
      "전체 보기"(전체보기) 는 제외하고 나머지 버튼 레이블 전부
    - 각 하위 카테고리 버튼의 URL(상품수집필터 URL)을 사이트 리다이렉트로 확정하여
      "최종 카테고리 URL주소" 칸에 쓰고, "최종카테고리명"은 위 조합식 그대로 적용한다.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from openpyxl import Workbook

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DEFAULT_SITE = "ABC마트"
# ★요건: 사이트명 옆에 사업자명 입력칸 추가 — 기본값은 빈칸(미지정)
DEFAULT_BIZ_NAME = ""
DEFAULT_URL = "https://abcmart.a-rt.com/?track=W0009"
DEFAULT_OUTDIR = r"D:\My_Project\AI_Program_Main_Board"
# ★요건: 상위 카테고리 그룹 2개, 그룹별 중위 카테고리 입력 — 기본 프리필 없음
DEFAULT_TOP_NAMES: list[str] = ["", ""]
DEFAULT_MID_NAMES: list[list[str]] = [[], []]

# ★요건: 입력값(사이트명·URL·저장폴더·상위/중위 카테고리명)을 저장해두고
# 보드 재실행 시 초기값으로 그대로 표시한다.
LAST_INPUT_PATH = Path(__file__).resolve().parent / ".last_input.json"

# P1과 동일한 엑셀 출력 형식(★요건: "결과물은 P1과 동일한 OUTPUT")
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

# ★요건: 보드 입력 화면 4개 행 — (상위 카테고리 1개 + 중위 카테고리 20개) × 2그룹
TOP_GROUP_COUNT = 2
MID_PER_TOP = 20
# 중위 카테고리 20개를 보드에 표시할 때의 그리드 형태(행×열 = 20)
MID_GRID_ROWS = 2
MID_GRID_COLS = 10
TOP_CELL_MAX_LEN = 15
# 하위 호환(보드 P1 탭과 동일한 상수명으로도 노출)
TOP_GRID_ROWS = MID_GRID_ROWS
TOP_GRID_COLS = MID_GRID_COLS

# ★요건: 무신사(musinsa.com) 지원 — 카테고리 메뉴 화면(스크린샷)에 실제 표시되는
# 상위(성별 탭)·중위(좌측 목록)·하위(우측 버튼)만 인식한다.
MUSINSA_MENU_URL = "https://www.musinsa.com/menu/category"
MUSINSA_GENDER_LABEL: dict[str, str] = {"A": "전체", "M": "남성", "F": "여성"}
MUSINSA_GENDER_CODE: dict[str, str] = {
    "전체": "A", "ALL": "A", "A": "A",
    "남성": "M", "MEN": "M", "MALE": "M", "M": "M",
    "여성": "F", "WOMEN": "F", "FEMALE": "F", "F": "F",
}
# ★요건(매우 중요): 하위 카테고리명 버튼에서 "신상품 보기"·"전체 보기"는 제외
MUSINSA_EXCLUDED_LOW_LABELS = {"신상품 보기", "전체 보기", "전체보기"}
# 신발·스포츠/레저·키즈·어스 등은 하위 버튼이 "품목별"/"인기 라인업"/"종목별"/"연령별"/
# "테마별" 등 여러 그룹으로 나뉘어 나타난다 — 실제 품목 하위 카테고리인 "품목별" 그룹만 인식
# ("인기 라인업" 등은 브랜드/테마 모음이라 하위 카테고리명이 아니므로 제외).
MUSINSA_SUBGROUP_ALLOWED = {"품목별"}


@dataclass
class Leaf:
    top: str
    mid: str
    low: str
    final: str
    category_url: str
    ctgr_no: str | None = None
    brand_no: str | None = None
    kind: Literal["category", "brand"] = "category"


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
class CategoryPair:
    """입력 1행 = 상위·중위 카테고리명 (사이트 매칭명 + 엑셀 출력명)."""

    match_top: str
    match_mid: str
    excel_top: str
    excel_mid: str

    def label(self) -> str:
        return f"{self.match_top} > {self.match_mid}"


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


def normalize_url(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        raise ValueError("사이트 URL이 비어 있습니다.")
    return s if s.startswith("http") else f"https://{s}"


def _default_last_input() -> dict:
    return {
        "site": DEFAULT_SITE,
        "biz": DEFAULT_BIZ_NAME,
        "url": DEFAULT_URL,
        "outdir": DEFAULT_OUTDIR,
        "top_names": list(DEFAULT_TOP_NAMES),
        "mid_names": [list(m) for m in DEFAULT_MID_NAMES],
    }


def load_last_input(path: Path | str | None = None) -> dict:
    """마지막 입력값 로드 — 파일이 없거나 손상되면 기본값.

    ★요건: "INPUT으로 입력된 값은 프로그램 종료후 재실행시도 초기값으로
    그대로 보여줘" — 반환값을 보드 입력 필드의 초기값으로 사용한다.
    """
    p = Path(path) if path is not None else LAST_INPUT_PATH
    out = _default_last_input()
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return out
    if not isinstance(data, dict):
        return out
    site = data.get("site")
    if isinstance(site, str) and site.strip():
        out["site"] = site
    biz = data.get("biz")
    if isinstance(biz, str):
        out["biz"] = biz
    url = data.get("url")
    if isinstance(url, str) and url.strip():
        out["url"] = url
    outdir = data.get("outdir")
    if isinstance(outdir, str) and outdir.strip():
        out["outdir"] = outdir
    top_names = data.get("top_names")
    if isinstance(top_names, list):
        names = [str(x) if x is not None else "" for x in top_names][:TOP_GROUP_COUNT]
        names.extend([""] * (TOP_GROUP_COUNT - len(names)))
        out["top_names"] = names
    mid_names = data.get("mid_names")
    if isinstance(mid_names, list):
        groups: list[list[str]] = []
        for i in range(TOP_GROUP_COUNT):
            raw_group = mid_names[i] if i < len(mid_names) and isinstance(mid_names[i], list) else []
            names = [str(x) if x is not None else "" for x in raw_group][:MID_PER_TOP]
            names.extend([""] * (MID_PER_TOP - len(names)))
            groups.append(names)
        out["mid_names"] = groups
    return out


def save_last_input(
    site: str,
    url: str,
    outdir: str,
    top_names: list[str],
    mid_names_by_group: list[list[str]],
    *,
    biz: str = "",
    path: Path | str | None = None,
) -> None:
    """현재 입력값을 저장 (보드 재실행 시 초기값 복원용). 실패해도 조용히 무시."""
    p = Path(path) if path is not None else LAST_INPUT_PATH
    payload = {
        "site": site or "",
        "biz": biz or "",
        "url": url or "",
        "outdir": outdir or "",
        "top_names": [str(x or "") for x in top_names][:TOP_GROUP_COUNT],
        "mid_names": [
            [str(x or "") for x in group][:MID_PER_TOP] for group in mid_names_by_group[:TOP_GROUP_COUNT]
        ],
    }
    try:
        p.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def parse_top_cell(raw: str) -> tuple[str, str] | None:
    """상위·중위 카테고리 칸 1개 해석 (P1과 동일 규칙).

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


def parse_category_groups(
    top_names: list[str],
    mid_names_by_group: list[list[str]],
    max_groups: int = TOP_GROUP_COUNT,
    max_mid: int = MID_PER_TOP,
) -> list[CategoryPair]:
    """보드 입력 화면(4개 행) → CategoryPair 목록.

    ★요건:
        상위 카테고리 : <입력칸> 1개
        중위 카테고리 : <입력그리드> 20개
        상위 카테고리 : <입력칸> 1개
        중위 카테고리 : <입력그리드> 20개

    즉 상위 카테고리 그룹(``top_names``) 최대 ``max_groups``개, 그룹별
    중위 카테고리(``mid_names_by_group[i]``) 최대 ``max_mid``개를 입력받아
    (상위, 중위) 쌍 목록으로 펼친다. 중복(상위,중위) 쌍은 제거한다.
    """
    seen: set[tuple[str, str]] = set()
    out: list[CategoryPair] = []
    n = min(max_groups, len(top_names), len(mid_names_by_group))
    for i in range(n):
        top_parsed = parse_top_cell(top_names[i])
        if top_parsed is None:
            continue
        match_top, excel_top = top_parsed
        for mid_raw in mid_names_by_group[i][:max_mid]:
            mid_parsed = parse_top_cell(mid_raw)
            if mid_parsed is None:
                continue
            match_mid, excel_mid = mid_parsed
            key = (match_top.upper(), match_mid.upper())
            if key in seen:
                continue
            seen.add(key)
            out.append(CategoryPair(match_top, match_mid, excel_top, excel_mid))
    return out


def top_final_label(top: str, final: str) -> str:
    t, f = top.strip(), final.strip()
    if not t:
        return f
    if not f:
        return t
    return f"{t} {f}"


def build_final_category_name(
    biz_name: str, site_name: str, top: str, mid: str, low: str
) -> str:
    """★요건: 최종카테고리명 재정의.

    사업자명 + '-' + 사이트명 + 상위카테고리명 + '-' + 중위 카테고리명 + '-' + 하위 카테고리명
    (사용자 원문 그대로 — 사이트명과 상위카테고리명 사이에는 구분자를 넣지 않는다.)
    """
    biz = (biz_name or "").strip()
    site = (site_name or "").strip()
    t = (top or "").strip()
    m = (mid or "").strip()
    low_v = (low or "").strip()
    return f"{biz}-{site}{t}-{m}-{low_v}"


def _qs(href: str, key: str) -> str | None:
    if not href:
        return None
    try:
        q = parse_qs(urlparse(href).query)
        vals = q.get(key) or q.get(key.lower())
        return vals[0] if vals else None
    except Exception:
        m = re.search(rf"{key}=([^&]+)", href, re.I)
        return m.group(1) if m else None


def parse_ctgr_no(href: str | None) -> str | None:
    if not href:
        return None
    v = _qs(href, "ctgrNo") or _qs(href, "cat_id")
    return v if v and v.isdigit() else None


def parse_brand_no(href: str | None) -> str | None:
    return _qs(href or "", "brandNo")


def build_art_browse_url(origin: str, href: str, kind: Literal["category", "brand"]) -> str:
    if kind == "brand":
        brand = parse_brand_no(href)
        if not brand:
            return urljoin(origin, href or "")
        return f"{origin}/product/brand/page/main?brandNo={brand}"
    ctgr = parse_ctgr_no(href)
    if not ctgr:
        return urljoin(origin, href or "")
    gender = _qs(href, "genderGbnCode") or "10000"
    return f"{origin}/display/category/main?genderGbnCode={gender}&ctgrNo={ctgr}&page=1"


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def is_art_platform(html: str, url: str) -> bool:
    u = url.lower()
    return (
        "a-rt.com" in u
        or "gnb-menu-depth1" in html
        or "abcmart" in html.lower()
        or "abc.biz.category" in html
    )


def is_musinsa_platform(url: str) -> bool:
    """★요건: 사이트 URL이 musinsa.com 이면 무신사 카테고리 메뉴 방식을 사용한다."""
    return "musinsa.com" in (url or "").lower()


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": DEFAULT_UA,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9",
        }
    )
    return s


def fetch_html(url: str, session: requests.Session | None = None) -> str:
    sess = session or _session()
    res = sess.get(
        url,
        timeout=60,
        allow_redirects=True,
    )
    if not res.ok:
        raise RuntimeError(f"페이지 요청 실패 ({res.status_code}): {url}")
    res.encoding = res.apparent_encoding or res.encoding or "utf-8"
    return res.text


def _parse_int_count(raw: str | int | float | None) -> int:
    if raw is None:
        return 0
    if isinstance(raw, bool):
        return 0
    if isinstance(raw, (int, float)):
        return max(0, int(raw))
    s = re.sub(r"[^\d]", "", str(raw))
    return int(s) if s else 0


def parse_total_count_from_html(html: str) -> int:
    """A-RT 상품목록 HTML의 totalCount / result-cnt 파싱 (P1과 동일)."""
    soup = BeautifulSoup(html or "", "html.parser")
    inp = soup.select_one('input[name="totalCount"]')
    if inp and inp.get("value") is not None:
        return _parse_int_count(inp.get("value"))
    spot = soup.select_one(".result-cnt")
    if spot:
        return _parse_int_count(spot.get_text())
    m = re.search(
        r'name=["\']totalCount["\'][^>]*value=["\']([^"\']*)["\']',
        html or "",
        re.I,
    )
    if m:
        return _parse_int_count(m.group(1))
    m = re.search(
        r'value=["\']([^"\']*)["\'][^>]*name=["\']totalCount["\']',
        html or "",
        re.I,
    )
    if m:
        return _parse_int_count(m.group(1))
    return 0


def parse_review_count_from_html(html: str) -> int:
    """목록/상세 HTML에서 리뷰수 합·표기 추출 (없으면 0, P1과 동일)."""
    text = html or ""
    nums = [
        _parse_int_count(x)
        for x in re.findall(r"리뷰\s*\(?\s*([\d,]+)\s*\)?", text)
    ]
    if nums:
        return sum(nums)
    m = re.search(r'reviewCnt["\']?\s*[:=]\s*["\']?(\d+)', text, re.I)
    if m:
        return _parse_int_count(m.group(1))
    return 0


def fetch_art_category_stats(
    category_url: str,
    *,
    ctgr_no: str | None = None,
    brand_no: str | None = None,
    session: requests.Session | None = None,
) -> CategoryStats:
    """카테고리 URL별 총상품수·상품수집가능개수·검색수·리뷰수 (P1과 동일)."""
    sess = session or _session()
    origin = f"{urlparse(category_url).scheme}://{urlparse(category_url).netloc}"
    ctgr = ctgr_no or parse_ctgr_no(category_url)
    brand = brand_no or parse_brand_no(category_url)
    stats = CategoryStats()

    try:
        if ctgr:
            list_url = urljoin(origin, "/display/category/product/list")
            res = sess.get(
                list_url,
                params={
                    "ctgrNo": ctgr,
                    "pagingSortType": "",
                    "rowsPerPage": 1,
                    "pageNum": 1,
                },
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": category_url,
                    "Accept": "text/html, */*;q=0.8",
                },
                timeout=45,
            )
            if res.ok:
                html = res.text
                total = parse_total_count_from_html(html)
                review = parse_review_count_from_html(html)
                stats.total_product_count = total
                stats.search_count = total
                stats.collectible_count = total
                stats.review_count = review
                return stats

        html = fetch_html(category_url, session=sess)
        total = parse_total_count_from_html(html)
        review = parse_review_count_from_html(html)
        if total or review:
            stats.total_product_count = total
            stats.search_count = total
            stats.collectible_count = total
            stats.review_count = review
            return stats

        _ = brand
    except Exception:
        return stats
    return stats


def enrich_rows_with_product_stats(
    rows: list[HierarchyRow],
    leaves: list[Leaf],
    *,
    session: requests.Session | None = None,
) -> list[str]:
    """각 행의 카테고리 URL로 상품수·검색수·리뷰수를 채워 넣는다 (P1과 동일)."""
    sess = session or _session()
    warnings: list[str] = []
    fail = 0
    for i, (row, leaf) in enumerate(zip(rows, leaves), start=1):
        stats = fetch_art_category_stats(
            leaf.category_url,
            ctgr_no=leaf.ctgr_no,
            brand_no=leaf.brand_no,
            session=sess,
        )
        row.total_product_count = stats.total_product_count
        row.collectible_count = stats.collectible_count
        row.search_count = stats.search_count
        row.review_count = stats.review_count
        if (
            stats.total_product_count == 0
            and stats.collectible_count == 0
            and (leaf.ctgr_no or leaf.brand_no)
        ):
            fail += 1
        if i % 20 == 0:
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
                leaf.top,
                leaf.mid,
                leaf.low,
                leaf.final,
                leaf.ctgr_no or leaf.brand_no or leaf.category_url,
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(leaf)
    return out


def parse_art_gnb_low_as_final(html: str, base_url: str) -> list[Leaf]:
    """A-RT GNB → 계층 Leaf 목록.

    ★요건(P1과 다른 부분): 하위 카테고리(depth3, "하위 카테고리명") 아래에 더
    깊은 depth4 메뉴가 있어도 그 안으로 더 내려가지 않고, 하위 카테고리명
    자체를 최종 카테고리명으로 확정한다. (P1은 depth4가 있으면 그 이름을
    최종 카테고리명으로 쓰고 depth3명은 "하위 카테고리명"으로만 남긴다.)
    """
    soup = BeautifulSoup(html, "lxml")
    origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
    leaves: list[Leaf] = []

    for el in soup.select("ul.gnb-menu > li.gnb-menu-depth1"):
        classes = el.get("class") or []
        if "menu-brand" in classes:
            for a in el.select('.all-brand-list-wrap a[href*="brandNo"]'):
                href = a.get("href") or ""
                brand_name_el = a.select_one(".brand-name")
                name = (
                    clean_text(brand_name_el.get_text() if brand_name_el else "")
                    or clean_text(a.get("title") or "")
                    or clean_text(a.get_text())
                )
                if not name or not href:
                    continue
                leaves.append(
                    Leaf(
                        top="BRAND",
                        mid="",
                        low="",
                        final=name,
                        category_url=build_art_browse_url(origin, href, "brand"),
                        brand_no=parse_brand_no(href),
                        kind="brand",
                    )
                )
            continue

        top = ""
        for child in el.children:
            if getattr(child, "name", None) in ("button", "a") and "menu-name" in (child.get("class") or []):
                top = clean_text(child.get_text())
                break
        if not top:
            continue

        for d2 in el.select(".sub-depth2"):
            mid_a = d2.select_one(".depth2-title a")
            mid = clean_text(mid_a.get_text() if mid_a else "")

            items = d2.select(".sub-depth3 > li.item")
            if not items and mid:
                mid_href = mid_a.get("href") if mid_a else ""
                leaves.append(
                    Leaf(
                        top=top,
                        mid="",
                        low="",
                        final=mid,
                        category_url=build_art_browse_url(origin, mid_href or "", "category"),
                        ctgr_no=parse_ctgr_no(mid_href),
                    )
                )
                continue

            for d3li in items:
                low_link = None
                for child in d3li.children:
                    if getattr(child, "name", None) == "a" and "depth3-title" in (child.get("class") or []):
                        low_link = child
                        break
                low = clean_text(low_link.get_text() if low_link else "")
                low_href = low_link.get("href") if low_link else ""
                if not low:
                    continue
                # ★요건: depth4 존재 여부와 무관하게 하위 카테고리명을 최종 카테고리명으로 확정
                leaves.append(
                    Leaf(
                        top=top,
                        mid=mid,
                        low="",
                        final=low,
                        category_url=build_art_browse_url(origin, low_href or "", "category"),
                        ctgr_no=parse_ctgr_no(low_href),
                    )
                )

    return _dedupe(leaves)


def fetch_musinsa_menu_html(gender_code: str) -> str:
    """무신사 카테고리 메뉴 화면을 렌더링해 HTML을 가져온다.

    ★요건: 메뉴 화면은 클라이언트 렌더링이라 성별 탭(전체/남성/여성)을 실제로
    클릭해야 좌측(중위)·우측(하위) 목록이 성별에 맞게 바뀐다 — Playwright 필요.
    """
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Playwright 미설치/로드 실패: {e}") from e

    label = MUSINSA_GENDER_LABEL.get(gender_code, "전체")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="ko-KR", user_agent=DEFAULT_UA, viewport={"width": 1440, "height": 900}
        )
        page = context.new_page()
        page.goto(MUSINSA_MENU_URL, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(1500)
        if label != "전체":
            sel = f'[data-section-name="gender_tab"][data-button-name="{label}"]'
            page.locator(sel).first.click(timeout=10_000)
            page.wait_for_timeout(1200)
        html = page.content()
        browser.close()
    return html


def parse_musinsa_menu_tree(html: str, top_label: str) -> tuple[set[str], list[Leaf]]:
    """무신사 카테고리 메뉴 HTML → (인식된 중위 후보 집합, 하위 카테고리 Leaf 목록).

    ★요건(매우 중요): 카테고리 메뉴 화면(스크린샷)에 실제로 표시되는 버튼만
    상위·중위 카테고리명으로 인식한다.
        - 중위 후보: data-section-name="catemenu_left" 의 1depth_cate 항목만
        - 하위 후보: data-section-name="catemenu_right" 의 2depth_cate(또는 하위그룹이
          있는 경우 3depth_cate 중 "품목별" 그룹) 항목만
          ("신상품 보기"/"전체 보기" 버튼과 "인기 라인업" 등 비품목 그룹은 제외)
    """
    soup = BeautifulSoup(html or "", "html.parser")

    mid_names: set[str] = set()
    for el in soup.select('[data-section-name="catemenu_left"][data-button-id="1depth_cate"]'):
        name = clean_text(el.get("data-category-name") or el.get_text())
        if name:
            mid_names.add(name)

    leaves: list[Leaf] = []
    selector = (
        '[data-section-name="catemenu_right"][data-button-id="2depth_cate"],'
        '[data-section-name="catemenu_right"][data-button-id="3depth_cate"]'
    )
    for a in soup.select(selector):
        label = clean_text(a.get_text())
        if not label or label in MUSINSA_EXCLUDED_LOW_LABELS:
            continue
        cat_name = a.get("data-category-name") or ""
        parts = [clean_text(p) for p in cat_name.split("|")]
        if not parts or not parts[0]:
            continue
        mid = parts[0]
        if len(parts) >= 3:
            # ★요건: "품목별" 그룹만 하위 카테고리로 인식 (인기 라인업/종목별/연령별/테마별 등 제외)
            if parts[1] not in MUSINSA_SUBGROUP_ALLOWED:
                continue
            low_label = parts[-1]
        else:
            low_label = parts[1] if len(parts) > 1 else label
        if not mid or mid not in mid_names or not low_label or low_label in MUSINSA_EXCLUDED_LOW_LABELS:
            continue
        href = a.get("href") or ""
        if not href or "/category/" not in href:
            continue
        leaves.append(
            Leaf(top=top_label, mid=mid, low="", final=low_label, category_url=href, ctgr_no=None)
        )
    return mid_names, _dedupe(leaves)


def resolve_musinsa_category_url(
    href: str, gender_code: str, session: requests.Session | None = None
) -> str:
    """★요건: 하위 카테고리 버튼 클릭 시 실제 이동하는 URL(상품수집필터 URL)을 확정한다.

    무신사는 ``/category/{code}[?기존파라미터]&gf={M|F|A}`` 요청을 실제 상품목록 URL
    (``/category/{code}/goods?...&gf=...``) 로 서버 리다이렉트(307) 하므로, 요청을
    보내 최종 이동 URL을 그대로 사용한다. 버튼의 기존 쿼리(예: separatorId)는 그대로 보존한다.
    """
    sess = session or _session()
    sep = "&" if "?" in (href or "") else "?"
    base = f"{href}{sep}gf={gender_code}"
    try:
        res = sess.get(base, timeout=30, allow_redirects=True)
        if res.url:
            return res.url
    except Exception:
        pass
    return base


def _crawl_musinsa(
    site_name: str,
    site_url: str,
    pairs: list[CategoryPair],
    applied: list[str],
    biz_name: str,
) -> CrawlResult:
    """무신사(musinsa.com) 카테고리 메뉴 방식 수집."""
    gender_cache: dict[str, tuple[set[str], list[Leaf]]] = {}
    warnings: list[str] = []
    matched: list[tuple[Leaf, CategoryPair]] = []
    seen: set[str] = set()

    for pair in pairs:
        gender_code = MUSINSA_GENDER_CODE.get(pair.match_top.strip().upper())
        if not gender_code:
            warnings.append(
                f"인식할 수 없는 상위 카테고리(성별): {pair.match_top} "
                "(전체/남성/여성 중 하나로 입력하세요)"
            )
            continue
        if gender_code not in gender_cache:
            try:
                html = fetch_musinsa_menu_html(gender_code)
                gender_cache[gender_code] = parse_musinsa_menu_tree(html, pair.match_top)
            except Exception as e:  # noqa: BLE001
                warnings.append(f"무신사 카테고리 메뉴 수집 실패({pair.match_top}): {e}")
                gender_cache[gender_code] = (set(), [])
                continue
        mid_names, leaves = gender_cache[gender_code]
        mid_key = pair.match_mid.strip().upper()
        if not any(m.upper() == mid_key for m in mid_names):
            warnings.append(
                f"중위 카테고리를 찾지 못했습니다: {pair.match_top} > {pair.match_mid} "
                "(카테고리 메뉴 화면에 표시되는 이름만 인식합니다)"
            )
            continue
        for leaf in leaves:
            if leaf.mid.strip().upper() != mid_key:
                continue
            key = "|".join([pair.match_top, leaf.mid, leaf.final, leaf.ctgr_no or leaf.category_url])
            if key in seen:
                continue
            seen.add(key)
            matched.append((leaf, pair))

    if not matched:
        return CrawlResult(
            ok=False,
            site_name=site_name,
            site_url=site_url,
            applied_tops=applied,
            errors=[f"입력한 상위·중위 카테고리({', '.join(applied)})에 해당하는 메뉴를 찾지 못했습니다."],
            warnings=warnings,
        )

    sess = _session()
    rows: list[HierarchyRow] = []
    for leaf, pair in matched:
        gender_code = MUSINSA_GENDER_CODE.get(pair.match_top.strip().upper(), "A")
        final_url = resolve_musinsa_category_url(leaf.category_url, gender_code, session=sess)
        rows.append(
            HierarchyRow(
                site_name=site_name,
                top=pair.excel_top,
                mid=pair.excel_mid,
                low=leaf.final,
                # ★요건: 최종카테고리명 = 사업자명-사이트명상위카테고리명-중위카테고리명-하위카테고리명
                final=build_final_category_name(
                    biz_name, site_name, pair.excel_top, pair.excel_mid, leaf.final
                ),
                top_final_label=top_final_label(pair.excel_top, leaf.final),
                final_category_url=final_url,
            )
        )

    return CrawlResult(
        ok=True,
        site_name=site_name,
        site_url=site_url,
        platform="무신사(MUSINSA)",
        applied_tops=applied,
        rows=rows,
        total=len(rows),
        warnings=warnings,
    )


def filter_by_top_mid(
    leaves: list[Leaf], pairs: list[CategoryPair]
) -> list[tuple[Leaf, CategoryPair]]:
    """입력된 (상위, 중위) 쌍과 일치하는 하위 카테고리(leaf) 전부."""
    if not pairs:
        return []
    out: list[tuple[Leaf, CategoryPair]] = []
    seen: set[str] = set()
    for pair in pairs:
        top_key = pair.match_top.strip().upper()
        mid_key = pair.match_mid.strip().upper()
        for leaf in leaves:
            if leaf.top.strip().upper() != top_key:
                continue
            if leaf.mid.strip().upper() != mid_key:
                continue
            key = "|".join(
                [leaf.top, leaf.mid, leaf.final, leaf.ctgr_no or leaf.brand_no or leaf.category_url]
            )
            if key in seen:
                continue
            seen.add(key)
            out.append((leaf, pair))
    return out


def crawl_site(
    site_name: str,
    site_url: str,
    top_names: list[str],
    mid_names_by_group: list[list[str]],
    biz_name: str = "",
) -> CrawlResult:
    """
    top_names: 상위 카테고리명 그룹별 1개씩 (최대 TOP_GROUP_COUNT개)
    mid_names_by_group: 그룹별 중위 카테고리명 목록 (그룹당 최대 MID_PER_TOP개)
    biz_name: 사업자명 — ★요건: 최종카테고리명 조합에 사용
    """
    name = (site_name or "").strip() or "사이트"
    biz = (biz_name or "").strip()
    try:
        url = normalize_url(site_url)
    except ValueError as e:
        return CrawlResult(ok=False, site_name=name, site_url=site_url or "", errors=[str(e)])

    pairs = parse_category_groups(top_names, mid_names_by_group)
    applied = [p.label() for p in pairs]
    if not pairs:
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=[],
            errors=[
                "상위 카테고리별 중위 카테고리를 1개 이상 입력하세요. "
                f"(상위 카테고리 {TOP_GROUP_COUNT}개 × 중위 카테고리 최대 {MID_PER_TOP}개)"
            ],
        )

    # ★요건: 사이트 URL이 musinsa.com 이면 무신사 카테고리 메뉴 방식으로 수집
    if is_musinsa_platform(url):
        return _crawl_musinsa(name, url, pairs, applied, biz)

    try:
        html = fetch_html(url)
    except Exception as e:
        return CrawlResult(
            ok=False, site_name=name, site_url=url, applied_tops=applied, errors=[str(e)]
        )

    if not is_art_platform(html, url):
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=applied,
            errors=["지원하지 않는 사이트 형식입니다. 현재 A-RT 계열(ABC마트 등)만 지원합니다."],
        )

    all_leaves = parse_art_gnb_low_as_final(html, url)
    if not all_leaves:
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=applied,
            errors=["카테고리 메뉴(GNB)를 찾지 못했습니다."],
        )

    matched = filter_by_top_mid(all_leaves, pairs)
    if not matched:
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=applied,
            errors=[f"입력한 상위·중위 카테고리({', '.join(applied)})에 해당하는 메뉴를 찾지 못했습니다."],
        )

    warnings: list[str] = []
    aliased = [
        f"{pair.match_top}:{pair.match_mid}→{pair.excel_top}:{pair.excel_mid}"
        for pair in pairs
        if pair.excel_top != pair.match_top or pair.excel_mid != pair.match_mid
    ]
    if aliased:
        warnings.append("엑셀 상위·중위명 치환: " + ", ".join(aliased))

    rows = [
        HierarchyRow(
            site_name=name,
            top=pair.excel_top,
            mid=pair.excel_mid,
            low=leaf.final,
            # ★요건: 최종카테고리명 재정의 — 사업자명-사이트명상위카테고리명-중위카테고리명-하위카테고리명
            final=build_final_category_name(biz, name, pair.excel_top, pair.excel_mid, leaf.final),
            top_final_label=top_final_label(pair.excel_top, leaf.final),
            final_category_url=leaf.category_url,
        )
        for leaf, pair in matched
    ]
    leaves_for_stats = [leaf for leaf, _pair in matched]
    # ★요건: 카테고리 URL별 총상품수·상품수집가능개수·검색수·리뷰수 입력 (P1과 동일)
    sess = _session()
    warnings.extend(enrich_rows_with_product_stats(rows, leaves_for_stats, session=sess))
    return CrawlResult(
        ok=True,
        site_name=name,
        site_url=url,
        platform="A-RT (ABC마트 계열)",
        applied_tops=applied,
        rows=rows,
        total=len(rows),
        warnings=warnings,
    )


def save_excel(rows: list[HierarchyRow], site_name: str, out_dir: Path | str) -> Path:
    """P1과 동일한 엑셀 형식·파일명 규칙으로 저장한다."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r'[\\/:*?"<>|]', "_", site_name or "사이트")[:40]
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

    p = argparse.ArgumentParser(description="P1_102 카테고리 URL 추출 (P1 복제본)")
    p.add_argument("--site", default=DEFAULT_SITE)
    p.add_argument("--biz", default=DEFAULT_BIZ_NAME, help="사업자명 (최종카테고리명 조합에 사용)")
    p.add_argument("--url", default=DEFAULT_URL)
    p.add_argument(
        "--pairs",
        default="",
        help=(
            "상위:중위 쌍, 쉼표구분. 예: MEN:상의,MEN:하의,WOMEN:상의 "
            "(각 칸에 명1:명2 입력 시 사이트매칭명1→엑셀출력명2 치환)"
        ),
    )
    p.add_argument("--out", default=DEFAULT_OUTDIR, help="엑셀 저장 폴더")
    args = p.parse_args()

    top_names: list[str] = []
    mid_names_by_group: list[list[str]] = []
    for chunk in args.pairs.split(","):
        chunk = chunk.strip()
        if not chunk or ":" not in chunk:
            continue
        top_raw, mid_raw = chunk.split(":", 1)
        top_raw, mid_raw = top_raw.strip(), mid_raw.strip()
        if top_raw not in top_names:
            if len(top_names) >= TOP_GROUP_COUNT:
                continue
            top_names.append(top_raw)
            mid_names_by_group.append([])
        mid_names_by_group[top_names.index(top_raw)].append(mid_raw)

    result = crawl_site(args.site, args.url, top_names, mid_names_by_group, biz_name=args.biz)
    if not result.ok:
        print("실패:", "; ".join(result.errors))
        raise SystemExit(1)
    path = save_excel(result.rows, result.site_name, args.out)
    print(f"완료 {result.total}행 → {path}")
    try:
        save_last_input(args.site, args.url, args.out, top_names, mid_names_by_group, biz=args.biz)
    except Exception:
        pass


if __name__ == "__main__":
    main()
