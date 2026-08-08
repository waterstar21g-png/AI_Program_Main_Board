"""P1_ZARA_DE 3행×12열(상위·중위·하위1~10) · 하위 수집 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    COL_LABELS,
    DEFAULT_SITE,
    DEFAULT_URL,
    LOW_SLOT_COUNT,
    TOP_GRID_COLS,
    TOP_GRID_ROWS,
    _make_leaf,
    expand_grid_rows_to_paths,
    fill_hierarchy_from_previous,
    filter_by_hierarchy_specs,
    hierarchy_row_from_match,
    parse_category_specs,
    parse_grid_category_specs,
    parse_zara_html_links,
    to_english_locale_url,
)


def test_grid_shape():
    assert TOP_GRID_ROWS == 3
    assert TOP_GRID_COLS == 12
    assert LOW_SLOT_COUNT == 10
    assert len(COL_LABELS) == 12
    assert COL_LABELS[0] == "상위 카테고리"
    assert COL_LABELS[1] == "중위 카테고리"
    assert COL_LABELS[2] == "하위 카테고리1"
    assert COL_LABELS[11] == "하위 카테고리10"
    assert DEFAULT_SITE == "독일자라"
    assert DEFAULT_URL == "https://www.zara.com/de/en/user/order"


def test_expand_grid_rows_to_paths():
    """한 행 = 상위·중위·하위1~10 → 경로 전개. 상위/중위 생략 시 이전 행 복사."""
    row1 = ["WOMAN", "CLOTHING", "Dresses", "Tops"] + [""] * 8
    row2 = ["", "", "Skirts"] + [""] * 9  # → WOMAN, CLOTHING, Skirts
    row3 = ["MAN", "SHOES"] + [""] * 10  # 하위 없음 → MAN > SHOES 전체
    paths = expand_grid_rows_to_paths([row1, row2, row3])
    assert paths == [
        ("WOMAN", "CLOTHING", "Dresses"),
        ("WOMAN", "CLOTHING", "Tops"),
        ("WOMAN", "CLOTHING", "Skirts"),
        ("MAN", "SHOES", ""),
    ]


def test_fill_hierarchy_from_previous():
    """상위·중위 생략 시 이전 경로 값을 복사."""
    raw = [
        ("WOMAN", "CLOTHING", "Dresses"),
        ("", "", "Tops"),
        ("", "SHOES", "Boots"),
        ("MAN", "", "Jeans"),
        ("", "", ""),
        ("", "", "Shirts"),
    ]
    filled = fill_hierarchy_from_previous(raw)
    assert filled[0] == ("WOMAN", "CLOTHING", "Dresses")
    assert filled[1] == ("WOMAN", "CLOTHING", "Tops")
    assert filled[2] == ("WOMAN", "SHOES", "Boots")
    assert filled[3] == ("MAN", "SHOES", "Jeans")
    assert filled[4] == ("MAN", "SHOES", "Shirts")


def test_parse_grid_specs_and_excel_hierarchy():
    row = ["WOMAN", "CLOTHING", "Dresses", "Tops"] + [""] * 8
    specs = parse_grid_category_specs([row])
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
    row_out = hierarchy_row_from_match("독일자라", leaf, matched[0][1])
    assert row_out.top == "WOMAN"
    assert row_out.mid == "CLOTHING"
    assert row_out.low == "Tops"
    assert "WOMAN" in row_out.top_final_label
    assert "CLOTHING" in row_out.top_final_label


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
    test_expand_grid_rows_to_paths()
    test_fill_hierarchy_from_previous()
    test_parse_grid_specs_and_excel_hierarchy()
    test_parse_specs_applies_fill_and_excel_hierarchy()
    test_html_link_parse_english()
    print("ok")
