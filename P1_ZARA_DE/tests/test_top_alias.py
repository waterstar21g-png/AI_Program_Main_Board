"""P1_ZARA_DE 3계층×20 · 이전 열 복사 · 하위 수집 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    DEFAULT_SITE,
    DEFAULT_URL,
    TOP_GRID_COLS,
    TOP_GRID_LEVELS,
    _make_leaf,
    fill_hierarchy_from_previous,
    filter_by_hierarchy_specs,
    hierarchy_row_from_match,
    parse_category_specs,
    parse_zara_html_links,
    to_english_locale_url,
)


def test_grid_shape():
    assert TOP_GRID_LEVELS == 3
    assert TOP_GRID_COLS == 20
    assert DEFAULT_SITE == "독일자라"
    assert DEFAULT_URL == "https://www.zara.com/de/en/user/order"


def test_fill_hierarchy_from_previous():
    """1·2계층 생략 시 이전 열 값을 복사."""
    raw = [
        ("WOMAN", "CLOTHING", "Dresses"),
        ("", "", "Tops"),  # → WOMAN, CLOTHING, Tops
        ("", "SHOES", "Boots"),  # → WOMAN, SHOES, Boots
        ("MAN", "", "Jeans"),  # → MAN, SHOES(이전투영), Jeans — 단순 복사 규칙
        ("", "", ""),  # skip
        ("", "", "Shirts"),  # → MAN, SHOES, Shirts
    ]
    filled = fill_hierarchy_from_previous(raw)
    assert filled[0] == ("WOMAN", "CLOTHING", "Dresses")
    assert filled[1] == ("WOMAN", "CLOTHING", "Tops")
    assert filled[2] == ("WOMAN", "SHOES", "Boots")
    assert filled[3] == ("MAN", "SHOES", "Jeans")
    assert filled[4] == ("MAN", "SHOES", "Shirts")


def test_parse_specs_applies_fill_and_excel_hierarchy():
    specs = parse_category_specs(
        [
            ("WOMAN", "CLOTHING", "Dresses"),
            ("", "", "Tops"),
        ]
    )
    assert len(specs) == 2
    assert specs[1].match1 == "WOMAN"
    assert specs[1].match2 == "CLOTHING"
    assert specs[1].match3 == "Tops"
    leaf = _make_leaf(
        ["WOMAN", "CLOTHING", "Tops"],
        category_url="https://www.zara.com/de/en/tops-l1.html",
        cat_id="1",
    )
    matched = filter_by_hierarchy_specs([leaf], specs)
    assert len(matched) == 1
    row = hierarchy_row_from_match("독일자라", leaf, matched[0][1])
    assert row.top == "WOMAN"
    assert row.mid == "CLOTHING"
    assert row.low == "Tops"
    assert "WOMAN" in row.top_final_label
    assert "CLOTHING" in row.top_final_label


def test_html_link_parse_english():
    html = """
    <html><body>
      <a href="/de/en/woman-dresses-l1001.html">Dresses</a>
      <a href="/de/de/man-jeans-l2002.html">Jeans</a>
    </body></html>
    """
    leaves = parse_zara_html_links(html, "https://www.zara.com/de/en/")
    assert len(leaves) == 2
    assert all("/de/en/" in x.category_url for x in leaves)
    assert to_english_locale_url(
        "https://www.zara.com/de/de/x-l1.html"
    ) == "https://www.zara.com/de/en/x-l1.html"


if __name__ == "__main__":
    test_grid_shape()
    test_fill_hierarchy_from_previous()
    test_parse_specs_applies_fill_and_excel_hierarchy()
    test_html_link_parse_english()
    print("ok")
