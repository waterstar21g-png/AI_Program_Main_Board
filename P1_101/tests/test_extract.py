"""P1_101 상품수 파싱 · 엑셀 열 탐지 · 팝업대기 상수 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import openpyxl  # noqa: E402
from extract import (  # noqa: E402
    COUNT_HEADER,
    POST_POPUP_WAIT_SEC,
    ensure_column,
    find_header_index,
    parse_product_count_from_html,
    read_url_jobs,
)


def test_post_popup_wait_is_3_seconds():
    assert POST_POPUP_WAIT_SEC == 3.0


def test_parse_art_total_count():
    html = """
    <div>
      <input type="hidden" name="totalCount" value="930" />
      <span class="spot result-cnt">930</span>
    </div>
    """
    assert parse_product_count_from_html(html) == 930


def test_parse_korean_and_english_labels():
    assert parse_product_count_from_html("총 상품 수: 1,234") == 1234
    assert parse_product_count_from_html("상품 88개") == 88
    assert parse_product_count_from_html('{"productCount": 42}') == 42
    assert parse_product_count_from_html("Showing 15 products") == 15


def test_find_url_and_ensure_count_column(tmp_path: Path):
    fp = tmp_path / "sample.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["상위 최종 카테고리명", "최종 카테고리 URL주소"])
    ws.append(["MEN", "https://example.com/a"])
    ws.append(["목차", "https://example.com/toc"])
    ws.append(["WOMEN", "https://example.com/b"])
    wb.save(fp)

    wb2 = openpyxl.load_workbook(fp)
    ws2 = wb2.active
    headers, url_idx, jobs = read_url_jobs(ws2)
    assert url_idx == 1
    assert len(jobs) == 2
    assert jobs[0].url.endswith("/a")
    assert jobs[1].label == "WOMEN"

    count_idx = ensure_column(headers, ws2, COUNT_HEADER)
    assert headers[count_idx] == COUNT_HEADER
    assert find_header_index(headers, (COUNT_HEADER,)) == count_idx
    wb2.close()


if __name__ == "__main__":
    import tempfile

    test_post_popup_wait_is_3_seconds()
    test_parse_art_total_count()
    test_parse_korean_and_english_labels()
    with tempfile.TemporaryDirectory() as d:
        test_find_url_and_ensure_count_column(Path(d))
    print("PASS P1_101 tests")
