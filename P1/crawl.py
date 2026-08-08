"""
P1_Category_Url_Extract — A-RT(ABC마트 계열) GNB → 계층 카테고리 URL 엑셀
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse, urlencode

import requests
from bs4 import BeautifulSoup
from openpyxl import Workbook

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

EXCEL_HEADERS = [
    "상위 카테고리명",
    "중위 카테고리명",
    "하위 카테고리명",
    "최종 카테고리명",
    "상위 최종 카테고리명",
    "최종 카테고리 URL주소",
]

# 보드 입력 그리드: 3행 × 10칸 = 최대 30개, 칸당 한글 15자
TOP_GRID_ROWS = 3
TOP_GRID_COLS = 10
MAX_TOP = TOP_GRID_ROWS * TOP_GRID_COLS
TOP_CELL_MAX_LEN = 15


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
    """입력 칸 목록 → (사이트 매칭용 상위명 목록, 대문자키→엑셀명 맵)."""
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
    """하위 호환 — 사이트 매칭용 상위명만 반환."""
    names, _rename = parse_tops(raw, max_n=max_n)
    return names


def excel_top_name(site_top: str, rename: dict[str, str]) -> str:
    """사이트 상위명 → 엑셀에 쓸 상위명(별칭 있으면 치환)."""
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


def fetch_html(url: str) -> str:
    res = requests.get(
        url,
        headers={
            "User-Agent": DEFAULT_UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ko-KR,ko;q=0.9",
        },
        timeout=60,
        allow_redirects=True,
    )
    if not res.ok:
        raise RuntimeError(f"페이지 요청 실패 ({res.status_code}): {url}")
    res.encoding = res.apparent_encoding or res.encoding or "utf-8"
    return res.text


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


def parse_art_gnb(html: str, base_url: str) -> list[Leaf]:
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
                d4_links = d3li.select(".sub-depth4 > li.item > a.depth4-title")
                if d4_links:
                    for d4a in d4_links:
                        href = d4a.get("href") or ""
                        leaves.append(
                            Leaf(
                                top=top,
                                mid=mid,
                                low=low,
                                final=clean_text(d4a.get_text()),
                                category_url=build_art_browse_url(origin, href, "category"),
                                ctgr_no=parse_ctgr_no(href),
                            )
                        )
                elif low:
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


def filter_by_top(leaves: list[Leaf], tops: list[str]) -> list[Leaf]:
    allowed = {t.strip().upper() for t in tops if t.strip()}
    if not allowed:
        return []
    return [leaf for leaf in leaves if leaf.top.strip().upper() in allowed]


def crawl_site(site_name: str, site_url: str, top_categories: list[str]) -> CrawlResult:
    name = (site_name or "").strip() or "사이트"
    try:
        url = normalize_url(site_url)
    except ValueError as e:
        return CrawlResult(ok=False, site_name=name, site_url=site_url or "", errors=[str(e)])

    tops, rename = parse_tops(top_categories)
    if not tops:
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=[],
            errors=[f"상위 카테고리를 1개 이상 입력하세요. (최대 {MAX_TOP}개)"],
        )

    try:
        html = fetch_html(url)
    except Exception as e:
        return CrawlResult(
            ok=False, site_name=name, site_url=url, applied_tops=tops, errors=[str(e)]
        )

    if not is_art_platform(html, url):
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=["지원하지 않는 사이트 형식입니다. 현재 A-RT 계열(ABC마트 등)만 지원합니다."],
        )

    all_leaves = parse_art_gnb(html, url)
    if not all_leaves:
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=["카테고리 메뉴(GNB)를 찾지 못했습니다."],
        )

    leaves = filter_by_top(all_leaves, tops)
    if not leaves:
        return CrawlResult(
            ok=False,
            site_name=name,
            site_url=url,
            applied_tops=tops,
            errors=[f"지정한 상위 카테고리({', '.join(tops)})에 해당하는 메뉴를 찾지 못했습니다."],
        )

    warnings: list[str] = []
    if len(leaves) < len(all_leaves):
        warnings.append(
            f"상위 필터: 전체 {len(all_leaves)}건 중 {len(leaves)}건 ({', '.join(tops)})"
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
        for leaf in leaves
    ]
    return CrawlResult(
        ok=True,
        site_name=name,
        site_url=url,
        platform="A-RT (ABC마트 계열)",
        applied_tops=tops,
        rows=rows,
        total=len(rows),
        warnings=warnings,
    )


def save_excel(rows: list[HierarchyRow], site_name: str, out_dir: Path | str) -> Path:
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
        ws.append([r.top, r.mid, r.low, r.final, r.top_final_label, r.final_category_url])
    wb.save(path)
    return path


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(description="P1 카테고리 URL 추출")
    p.add_argument("--site", default="ABC마트")
    p.add_argument("--url", default="https://abcmart.a-rt.com/?track=W0009")
    p.add_argument(
        "--tops",
        default="MEN,WOMEN,KIDS",
        help="쉼표 구분 상위 카테고리 (명1:명2 = 사이트명1→엑셀명2 치환)",
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
