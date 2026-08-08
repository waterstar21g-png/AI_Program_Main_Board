"""P1_ZARA_DE 20행×3열(상위·중위·하위URL) · 최종 카테고리 리스트업 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    COL_LABELS,
    DEFAULT_SITE,
    DEFAULT_URL,
    NAME_ENTRY_WIDTH,
    TOP_GRID_COLS,
    TOP_GRID_ROWS,
    URL_ENTRY_WIDTH,
    _make_leaf,
    expand_grid_rows_to_paths,
    filter_by_hierarchy_specs,
    hierarchy_row_from_match,
    parse_grid_category_specs,
    parse_zara_html_links,
    to_english_locale_url,
)


def test_grid_shape():
    assert TOP_GRID_ROWS == 20
    assert TOP_GRID_COLS == 3
    assert len(COL_LABELS) == 3
    assert COL_LABELS[0] == "상위 카테고리명"
    assert COL_LABELS[1] == "중위 카테고리명"
    assert COL_LABELS[2] == "하위 카테고리 URL"
    assert URL_ENTRY_WIDTH == NAME_ENTRY_WIDTH * 10
    assert DEFAULT_SITE == "독일자라"
    assert DEFAULT_URL == "https://www.zara.com/de/en/user/order"


def test_expand_grid_rows_requires_url():
    """한 행 = 상위·중위·하위URL. URL 있는 행만 채택, 상위/중위 생략 시 이전 행 복사."""
    rows = [
        ("WOMAN", "CLOTHING", "https://www.zara.com/de/en/dresses-l1001.html"),
        ("", "", "https://www.zara.com/de/en/tops-l1002.html"),
        ("MAN", "SHOES", ""),  # URL 없음 → skip
        ("", "BAGS", "https://www.zara.com/de/de/bags-l2001.html"),
    ]
    paths = expand_grid_rows_to_paths(rows)
    assert paths == [
        ("WOMAN", "CLOTHING", "https://www.zara.com/de/en/dresses-l1001.html"),
        ("WOMAN", "CLOTHING", "https://www.zara.com/de/en/tops-l1002.html"),
        ("MAN", "BAGS", "https://www.zara.com/de/de/bags-l2001.html"),
    ]


def test_url_spec_lists_final_categories():
    """하위 URL 입력 시 해당 노드·하위 최종 카테고리를 리스트업하고 엑셀 계층 반영."""
    anchor_url = "https://www.zara.com/de/en/clothing-l10.html"
    leaves = [
        _make_leaf(
            ["WOMAN", "CLOTHING"],
            category_url=anchor_url,
            cat_id="10",
        ),
        _make_leaf(
            ["WOMAN", "CLOTHING", "Dresses"],
            category_url="https://www.zara.com/de/en/dresses-l11.html",
            cat_id="11",
        ),
        _make_leaf(
            ["WOMAN", "CLOTHING", "Tops"],
            category_url="https://www.zara.com/de/en/tops-l12.html",
            cat_id="12",
        ),
        _make_leaf(
            ["MAN", "SHOES", "Boots"],
            category_url="https://www.zara.com/de/en/boots-l20.html",
            cat_id="20",
        ),
    ]
    specs = parse_grid_category_specs(
        [("WOMAN", "CLOTHING", "https://www.zara.com/de/de/clothing-l10.html")]
    )
    assert len(specs) == 1
    assert specs[0].low_url.endswith("/de/en/clothing-l10.html")
    matched = filter_by_hierarchy_specs(leaves, specs)
    finals = [leaf.final for leaf, _ in matched]
    assert "CLOTHING" in finals
    assert "Dresses" in finals
    assert "Tops" in finals
    assert "Boots" not in finals
    row = hierarchy_row_from_match("독일자라", matched[1][0], matched[1][1])
    assert row.top == "WOMAN"
    assert row.mid == "CLOTHING"
    assert row.low == "CLOTHING"  # URL 노드명
    assert row.final in ("Dresses", "Tops", "CLOTHING")


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
    test_expand_grid_rows_requires_url()
    test_url_spec_lists_final_categories()
    test_html_link_parse_english()
    print("ok")
