"""P1 상위 카테고리 칸 파싱 · 엑셀 치환 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    TOP_CELL_MAX_LEN,
    TOP_GRID_COLS,
    TOP_GRID_ROWS,
    excel_top_name,
    parse_top_cell,
    parse_tops,
    top_final_label,
)


def test_grid_shape():
    assert TOP_GRID_ROWS == 3
    assert TOP_GRID_COLS == 10
    assert TOP_CELL_MAX_LEN == 15


def test_parse_plain():
    assert parse_top_cell("MEN") == ("MEN", "MEN")
    assert parse_top_cell("  WOMEN  ") == ("WOMEN", "WOMEN")
    assert parse_top_cell("") is None
    assert parse_top_cell("   ") is None


def test_parse_alias():
    assert parse_top_cell("카테고리명1:카테고리명2") == ("카테고리명1", "카테고리명2")
    assert parse_top_cell("MEN:남성") == ("MEN", "남성")
    assert parse_top_cell("MEN:") == ("MEN", "MEN")


def test_parse_tops_and_rename():
    names, rename = parse_tops(["MEN:남성", "WOMEN", "", "KIDS:키즈", "MEN:무시"])
    assert names == ["MEN", "WOMEN", "KIDS"]
    assert rename["MEN"] == "남성"
    assert rename["WOMEN"] == "WOMEN"
    assert rename["KIDS"] == "키즈"
    assert excel_top_name("MEN", rename) == "남성"
    assert excel_top_name("men", rename) == "남성"
    assert top_final_label(excel_top_name("MEN", rename), "스니커즈") == "남성 스니커즈"


def test_cell_max_len_truncate():
    long = "가" * 20
    parsed = parse_top_cell(long)
    assert parsed is not None
    assert len(parsed[0]) == TOP_CELL_MAX_LEN


if __name__ == "__main__":
    test_grid_shape()
    test_parse_plain()
    test_parse_alias()
    test_parse_tops_and_rename()
    test_cell_max_len_truncate()
    print("ok")
