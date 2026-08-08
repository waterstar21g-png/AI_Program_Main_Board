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
    to_english_locale_url,
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
    assert parse_top_cell("WOMAN:여성") == ("WOMAN", "여성")
    names, rename = parse_tops(["WOMAN:여성", "MAN", "KIDS"])
    assert names == ["WOMAN", "MAN", "KIDS"]
    assert excel_top_name("WOMAN", rename) == "여성"


def test_platform_and_homes_english_only():
    assert is_zara_de_platform("", DEFAULT_URL)
    assert is_zara_de_platform("", "https://www.zara.com/de/en/user/order")
    assert not is_zara_de_platform("", "https://abcmart.a-rt.com/")
    homes = zara_store_homes(DEFAULT_URL)
    assert homes == ["https://www.zara.com/de/en/"]
    assert all("/de/de/" not in h for h in homes)
    assert to_english_locale_url(
        "https://www.zara.com/de/de/dresses-l1001.html"
    ) == "https://www.zara.com/de/en/dresses-l1001.html"


def test_filter_aliases():
    leaves = [
        Leaf("WOMAN", "", "", "Dresses", "https://www.zara.com/de/en/dresses-l123.html"),
        Leaf("DAMEN", "", "", "Shoes", "https://www.zara.com/de/en/shoes-l456.html"),
        Leaf("MAN", "", "", "Jeans", "https://www.zara.com/de/en/jeans-l789.html"),
    ]
    out = filter_by_top(leaves, ["WOMAN", "MAN"])
    assert len(out) == 3  # DAMEN ≡ WOMAN


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
    assert all("/de/en/" in x.category_url for x in leaves)
    assert all("/de/de/" not in x.category_url for x in leaves)


if __name__ == "__main__":
    test_defaults()
    test_parse_alias()
    test_platform_and_homes_english_only()
    test_filter_aliases()
    test_html_link_parse_english()
    print("ok")
