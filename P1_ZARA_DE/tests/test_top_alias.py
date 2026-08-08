"""P1_ZARA_DE 상위 칸 파싱 · 플랫폼 판별 단위테스트."""

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
    excel_top_name,
    filter_by_top,
    is_zara_de_platform,
    parse_top_cell,
    parse_tops,
    parse_zara_html_links,
    zara_store_homes,
    Leaf,
)


def test_defaults():
    assert DEFAULT_SITE == "독일자라"
    assert DEFAULT_URL == "https://www.zara.com/de/en/user/order"
    assert TOP_GRID_ROWS == 3
    assert TOP_GRID_COLS == 10
    assert TOP_CELL_MAX_LEN == 15


def test_parse_alias():
    assert parse_top_cell("DAMEN:여성") == ("DAMEN", "여성")
    names, rename = parse_tops(["DAMEN:여성", "HERREN", "KINDER"])
    assert names == ["DAMEN", "HERREN", "KINDER"]
    assert excel_top_name("DAMEN", rename) == "여성"


def test_platform_and_homes():
    assert is_zara_de_platform("", DEFAULT_URL)
    assert is_zara_de_platform("", "https://www.zara.com/de/en/user/order")
    assert is_zara_de_platform("", "https://www.zara.com/de/de/damen-mkt1000.html")
    assert not is_zara_de_platform("", "https://abcmart.a-rt.com/")
    homes = zara_store_homes(DEFAULT_URL)
    assert any("/de/en/" in h for h in homes)


def test_filter_aliases():
    leaves = [
        Leaf("DAMEN", "", "", "Kleider", "https://www.zara.com/de/en/kleider-l123.html"),
        Leaf("WOMAN", "", "", "Schuhe", "https://www.zara.com/de/en/schuhe-l456.html"),
        Leaf("HERREN", "", "", "Jeans", "https://www.zara.com/de/en/jeans-l789.html"),
    ]
    out = filter_by_top(leaves, ["DAMEN", "HERREN"])
    assert len(out) == 3  # WOMAN ≡ DAMEN


def test_html_link_parse():
    html = """
    <html><body>
      <a href="/de/en/damen-kleider-l1001.html">Kleider</a>
      <a href="/de/en/herren-jeans-l2002.html">Jeans</a>
      <a href="/about">무시</a>
    </body></html>
    """
    leaves = parse_zara_html_links(html, "https://www.zara.com/de/en/")
    assert len(leaves) == 2
    tops = {x.top for x in leaves}
    assert "DAMEN" in tops
    assert "HERREN" in tops


if __name__ == "__main__":
    test_defaults()
    test_parse_alias()
    test_platform_and_homes()
    test_filter_aliases()
    test_html_link_parse()
    print("ok")
