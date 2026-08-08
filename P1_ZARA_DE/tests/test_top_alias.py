"""P1_ZARA_DE 카테고리명 매칭·하위 전부 수집 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    DEFAULT_SITE,
    DEFAULT_URL,
    TOP_CELL_MAX_LEN,
    TOP_GRID_COLS,
    TOP_GRID_ROWS,
    _make_leaf,
    excel_top_name,
    filter_subcategories_of,
    is_zara_de_platform,
    parse_top_cell,
    parse_tops,
    parse_zara_html_links,
    to_english_locale_url,
    zara_store_homes,
)


def test_defaults():
    assert DEFAULT_SITE == "독일자라"
    assert DEFAULT_URL == "https://www.zara.com/de/en/user/order"
    assert TOP_GRID_ROWS == 3
    assert TOP_GRID_COLS == 10
    assert TOP_CELL_MAX_LEN == 15


def test_parse_alias():
    assert parse_top_cell("WOMAN:여성") == ("WOMAN", "여성")
    names, rename = parse_tops(["WOMAN:여성", "MAN", "KIDS"])
    assert names == ["WOMAN", "MAN", "KIDS"]
    assert excel_top_name("WOMAN", rename) == "여성"


def test_platform_and_homes_english_only():
    assert is_zara_de_platform("", DEFAULT_URL)
    homes = zara_store_homes(DEFAULT_URL)
    assert homes == ["https://www.zara.com/de/en/"]
    assert to_english_locale_url(
        "https://www.zara.com/de/de/dresses-l1001.html"
    ) == "https://www.zara.com/de/en/dresses-l1001.html"


def test_filter_subcategories_under_match():
    """입력명과 일치하는 노드의 하위(경로에 포함된 leaf)를 전부 수집."""
    leaves = [
        _make_leaf(
            ["WOMAN", "CLOTHING", "DRESSES"],
            category_url="https://www.zara.com/de/en/dresses-l1.html",
            cat_id="1",
        ),
        _make_leaf(
            ["WOMAN", "CLOTHING", "TOPS"],
            category_url="https://www.zara.com/de/en/tops-l2.html",
            cat_id="2",
        ),
        _make_leaf(
            ["WOMAN", "SHOES"],
            category_url="https://www.zara.com/de/en/shoes-l3.html",
            cat_id="3",
        ),
        _make_leaf(
            ["MAN", "JEANS"],
            category_url="https://www.zara.com/de/en/jeans-l4.html",
            cat_id="4",
        ),
    ]
    # WOMAN → 하위 3건
    assert len(filter_subcategories_of(leaves, ["WOMAN"])) == 3
    # 중간명 CLOTHING → Dresses·Tops 2건
    assert len(filter_subcategories_of(leaves, ["CLOTHING"])) == 2
    # 최종명 DRESSES → 1건
    assert len(filter_subcategories_of(leaves, ["DRESSES"])) == 1
    # 동의어 DAMEN ≡ WOMAN
    assert len(filter_subcategories_of(leaves, ["DAMEN"])) == 3
    # MAN + WOMAN
    assert len(filter_subcategories_of(leaves, ["WOMAN", "MAN"])) == 4


def test_html_link_parse_english():
    html = """
    <html><body>
      <a href="/de/en/woman-dresses-l1001.html">Dresses</a>
      <a href="/de/de/man-jeans-l2002.html">Jeans</a>
      <a href="/about">무시</a>
    </body></html>
    """
    leaves = parse_zara_html_links(html, "https://www.zara.com/de/en/")
    assert len(leaves) == 2
    tops = {x.top for x in leaves}
    assert "WOMAN" in tops
    assert "MAN" in tops
    assert all(x.path for x in leaves)
    assert all("/de/en/" in x.category_url for x in leaves)


if __name__ == "__main__":
    test_defaults()
    test_parse_alias()
    test_platform_and_homes_english_only()
    test_filter_subcategories_under_match()
    test_html_link_parse_english()
    print("ok")
