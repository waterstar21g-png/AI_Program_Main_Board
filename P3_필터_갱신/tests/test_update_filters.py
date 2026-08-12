"""P3_필터_갱신 단위테스트 — 저장상품수 매핑·URL정규화·엑셀 읽기."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import openpyxl  # noqa: E402
from update_filters import (  # noqa: E402
    click_edit_on_row,
    click_modified_confirm,
    click_save_button,
    excel_by_url,
    filter_compare_note,
    find_excel_by_demango_url,
    filters_equal,
    is_modify_page_open,
    list_demango_rows,
    map_save_count,
    normalize_url,
    page_shows_not_found,
    read_excel_rows,
    set_save_count,
    screenshot_after_edit_click_series,
    wait_modify_page_closed,
)

DEMANGO_LIST_HTML = """
<html><body>
<table>
<tr>
  <th><input type="checkbox"></th>
  <th>사이트</th>
  <th>필터이름(수정가능)</th>
  <th>검색필터(저장조건)</th>
  <th>저장상품/휴지통</th>
</tr>
<tr>
  <td><input type="checkbox"></td>
  <td>Zara.com/de</td>
  <td><input type="text" value="여성헤어_헤어"></td>
  <td>
    <b>URL 검색:</b>
    <a href="https://www.zara.com/de/en/woman-zara-hair-groom-mkt17602.html?v1=2662755">
      https://www.zara.com/de/en/woman-zara-hair-groom-mkt17602.html?v1=2662755
    </a>
    | <span style="background:#2563eb;color:#fff">수집개수: 3개 | 전체저장</span>
    <button type="button" id="edit-correct-352"
      onclick="document.body.setAttribute('data-clicked','352'); location.href='admin_group_modify.php?ps_mode=modify_filter&amp;ps_fuid=352'">
      수집조건수정
    </button>
  </td>
  <td>0개 / 0개<br>상품확인 (0원)</td>
</tr>
<tr>
  <td><input type="checkbox"></td>
  <td>Zara.com/de</td>
  <td><input type="text" value="여성향수_향수"></td>
  <td>
    URL 검색:
    <a href="https://www.zara.com/de/en/woman-perfumes-l123.html">
      https://www.zara.com/de/en/woman-perfumes-l123.html
    </a>
    | <span>수집개수: 3개 | 전체저장</span>
    <input type="button" id="edit-correct-353" value="수집조건수정" onclick="document.body.setAttribute('data-clicked','353'); go(353)">
  </td>
  <td>2개 / 0개</td>
</tr>
</table>
</body></html>
"""

# 사용자 스크린샷 구조: URL | 수집개수: 3개 | 전체저장 | 수집조건수정
# 행 앞쪽에 엉뚱한 '수집조건수정'/not-found 링크가 있어도 옆 버튼만 눌러야 함
# 옆 버튼은 window.open 으로 수정 팝업을 띄움
DEMANGO_LIST_WITH_DECOY_HTML = """
<html><body>
<table>
<tr>
  <th>필터이름(수정가능)</th>
  <th>검색필터(저장조건)</th>
</tr>
<tr>
  <td><input type="text" value="남성의류_니트"></td>
  <td>
    <a href="admin_group_modify.php?ps_mode=modify_filter&amp;ps_fuid=999"
       id="decoy-wrong">수집조건수정</a>
    URL 검색:
    <a href="https://www.zara.com/de/en/man-knitwear-long-sleeve-l15978.html?v1=2432237">
      https://www.zara.com/de/en/man-knitwear-long-sleeve-l15978.html?v1=2432237
    </a>
    |
    <span style="background:#2b6cb0;color:#fff;padding:2px 6px">수집개수: 3개 | 전체저장</span>
    <input type="button" id="edit-real" value="수집조건수정"
      onclick="document.body.setAttribute('data-clicked','real-777'); window.open('about:blank','mod777');">
  </td>
</tr>
</table>
<script>
// about:blank 팝업에 수정화면 골격 주입 (Playwright expect_popup 검증용)
(function() {
  const _open = window.open;
  window.open = function(url, name) {
    const w = _open.call(window, url, name);
    try {
      w.document.write('<html><body><h1>검색필터 수정</h1>'
        + '<div>저장상품수</div><div>검색결과 상위 <input value="3"> 개</div>'
        + '<input type="button" value="저장하기"></body></html>');
      w.document.close();
    } catch (e) {}
    return w;
  };
})();
</script>
</body></html>
"""

MODIFY_HTML = """
<html><body>
<h1>검색필터 수정</h1>
<table>
  <tr><th>검색 URL</th>
      <td><input value="https://www.zara.com/de/en/woman-zara-hair-groom-mkt17602.html?v1=2662755"></td></tr>
  <tr>
    <th>저장상품수</th>
    <td>검색결과 상위 <input type="text" name="ps_save_cnt" value="3"> 개 상품만 저장</td>
  </tr>
</table>
<input type="button" value="저장하기">
<input type="button" value="닫기">
</body></html>
"""


def test_map_save_count_rules():
    assert map_save_count(0) == 0
    assert map_save_count(200) == 200
    assert map_save_count(201) == 300
    assert map_save_count(500) == 300
    assert map_save_count(501) == 400
    assert map_save_count(900) == 400


def test_normalize_url():
    a = normalize_url("https://WWW.Example.com/path/")
    b = normalize_url("https://www.example.com/path")
    assert a == b


def test_filters_equal():
    assert filters_equal("MEN 스니커즈", "MEN 스니커즈")
    assert not filters_equal("A", "B")
    # 불일치 → 엑셀 중간 공백을 _ 로 바꿔 재비교
    assert filters_equal("MEN 스니커즈", "MEN_스니커즈")
    assert filters_equal("A B C", "A_B_C")
    assert not filters_equal("MEN스니커즈", "MEN_스니커즈")  # 엑셀에 공백 없음
    assert filter_compare_note("MEN 스니커즈", "MEN_스니커즈")
    assert filter_compare_note("SAME", "SAME") == ""


def test_read_excel_and_lookup(tmp_path: Path):
    fp = tmp_path / "sample.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(
        ["상위 최종 카테고리명", "최종 카테고리 URL주소", "상품수집가능개수"]
    )
    ws.append(["MEN A", "https://shop.example/a", 150])
    ws.append(["MEN B", "https://shop.example/b", 350])
    ws.append(["MEN C", "https://shop.example/c", 600])
    wb.save(fp)

    rows = read_excel_rows(fp)
    assert len(rows) == 3
    by = excel_by_url(rows)
    r = by[normalize_url("https://shop.example/b")]
    assert r.filter_name == "MEN B"
    assert map_save_count(r.collectible) == 300
    assert map_save_count(by[normalize_url("https://shop.example/c")].collectible) == 400
    # 더망고 URL 기준으로 엑셀 검색
    found = find_excel_by_demango_url(by, "https://shop.example/a/")
    assert found is not None
    assert found.filter_name == "MEN A"
    assert find_excel_by_demango_url(by, "https://shop.example/nope") is None


def test_list_demango_rows_filter_input_and_url():
    """스크린샷 구조: 필터이름(수정가능) input · URL 검색 · 수집조건수정."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(DEMANGO_LIST_HTML)
        rows = list_demango_rows(page)
        browser.close()

    assert len(rows) == 2
    assert rows[0]["filterName"] == "여성헤어_헤어"
    assert "woman-zara-hair-groom" in rows[0]["url"]
    assert "ps_fuid=352" in (rows[0].get("editHref") or "")
    assert rows[0]["hasEdit"] is True
    # 사이트열(Zara.com/de)을 필터값으로 오인하지 않음
    assert "Zara" not in rows[0]["filterName"]
    assert rows[1]["filterName"] == "여성향수_향수"
    assert "woman-perfumes" in rows[1]["url"]
    assert "ps_fuid=353" in (rows[1].get("editHref") or "")


def test_click_edit_prefers_button_beside_collect_count(tmp_path: Path):
    """수집개수|전체저장 옆 버튼 클릭 → 수정 팝업 + 클릭후 샷 3장."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.set_content(DEMANGO_LIST_WITH_DECOY_HTML)
        rows = list_demango_rows(page)
        assert len(rows) == 1
        href = rows[0].get("editHref") or ""
        assert "999" not in href
        shot_dir = tmp_path / "shots"
        ok = click_edit_on_row(
            page,
            int(rows[0]["index"]),
            href,
            row_url=rows[0]["url"],
            progress=None,
            shot_dir=shot_dir,
            row_no=7,
            shot_count=0,
            max_tries=5,
            try_interval_s=0.2,
        )
        assert ok is True
        assert page.locator("body").get_attribute("data-clicked") == "real-777"
        assert len(context.pages) >= 2
        browser.close()


def test_edit_click_offset_moves_right():
    """시도마다 URL 오른쪽 오프셋이 증가한다."""
    from update_filters import edit_click_offset_x

    xs = [edit_click_offset_x(i) for i in range(1, 6)]
    assert xs == sorted(xs)
    assert xs[0] < xs[1] < xs[2] < xs[3] < xs[4]
    assert xs[1] - xs[0] == xs[2] - xs[1]


def test_find_edit_marks_right_of_url():
    """수집조건수정이 URL 오른쪽에 있으면 rightOfUrl=Y."""
    from playwright.sync_api import sync_playwright
    from update_filters import _find_and_mark_edit_button

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(DEMANGO_LIST_WITH_DECOY_HTML)
        rows = list_demango_rows(page)
        info = _find_and_mark_edit_button(page, int(rows[0]["index"]), rows[0]["url"])
        assert info.get("ok") is True
        assert info.get("rightOfUrl") is True
        assert page.locator('[data-p3-edit-target="1"]').count() == 1
        browser.close()


def test_screenshot_after_edit_click_series(tmp_path: Path):
    """클릭 후 샷 시리즈가 로그용 PNG 3장을 만든다."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content("<html><body><h1>검색필터 수정</h1><div>저장상품수</div></body></html>")
        shot_dir = tmp_path / "s"
        paths = screenshot_after_edit_click_series(
            page,
            shot_dir,
            row_no=1,
            progress=None,
            count=3,
            interval_s=0,
        )
        assert len(paths) == 3
        for pth in paths:
            assert pth.is_file() and pth.stat().st_size > 0
        browser.close()


def test_click_edit_fails_when_popup_does_not_open():
    """클릭은 되나 팝업이 없으면 False — href 대체 없이 실패."""
    from playwright.sync_api import sync_playwright

    html = """
    <html><body>
    <table><tr>
      <td><input type="text" value="테스트_필터"></td>
      <td>
        URL 검색: <a href="https://www.zara.com/de/en/x.html">https://www.zara.com/de/en/x.html</a>
        | <span>수집개수: 3개 | 전체저장</span>
        <input type="button" value="수집조건수정" onclick="document.body.setAttribute('data-clicked','1')">
      </td>
    </tr></table>
    </body></html>
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html)
        rows = list_demango_rows(page)
        # editHref 가 있어도 사용하지 않고 실패해야 함
        fake_href = "admin_group_modify.php?ps_mode=modify_filter&ps_fuid=999"
        ok = click_edit_on_row(
            page,
            int(rows[0]["index"]),
            fake_href,
            row_url=rows[0]["url"],
            progress=None,
            max_tries=3,
            try_interval_s=0.1,
        )
        assert ok is False
        # 같은 탭이 href 로 이동하지 않았는지
        assert "admin_group_modify" not in (page.url or "")
        browser.close()


def test_no_href_fallback_in_click_edit_source():
    """수집조건수정 클릭 경로에 href 재시도 코드가 없어야 함."""
    src = (ROOT / "update_filters.py").read_text(encoding="utf-8")
    assert "_open_modify_via_href" not in src
    assert "href로 재시도" not in src
    assert "href 폴백" not in src
    # click_edit_on_row 본문에 금지 문구 명시
    assert "href 재시도 금지" in src or "href 대체 없음" in src


def test_find_alive_mango_and_dismiss_keeps_other_tab():
    """스토어 레이어 닫기가 더망고 탭을 닫지 않고, 재연결이 된다."""
    from playwright.sync_api import sync_playwright
    from update_filters import (
        dismiss_store_layers_only,
        find_alive_mango_page,
        page_is_usable,
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        mango = context.new_page()
        mango.goto("https://example.com/demango/admin_group_list.php?x=1")
        store = context.new_page()
        store.set_content(
            "<html><body>"
            "<button aria-label='Close'>X</button>"
            "<div>zara store</div></body></html>"
        )
        n_before = len(context.pages)
        closed = dismiss_store_layers_only(store)
        assert closed >= 1
        assert len(context.pages) == n_before
        assert not mango.is_closed()
        found = find_alive_mango_page(
            context,
            "https://example.com/demango/admin_group_list.php?x=1",
            prefer=mango,
        )
        assert found is mango
        assert page_is_usable(found) is True
        # 스토어만 닫은 뒤에도 더망고 재연결
        store.close()
        found2 = find_alive_mango_page(
            context,
            "https://example.com/demango/admin_group_list.php?x=1",
            prefer=mango,
        )
        assert found2 is mango
        assert page_is_usable(found2) is True
        browser.close()


def test_resolve_demango_row_index_by_url():
    """복귀 후 URL로 행 index를 다시 찾는다."""
    from playwright.sync_api import sync_playwright
    from update_filters import resolve_demango_row_index_by_url

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(DEMANGO_LIST_HTML)
        rows = list_demango_rows(page)
        assert len(rows) >= 2
        want = rows[1]["url"]
        idx = resolve_demango_row_index_by_url(
            page, want, fallback_index=999, progress=None
        )
        assert idx == int(rows[1]["index"])
        browser.close()


def test_page_shows_not_found():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(
            "<html><body><h1>Not Found</h1><p>페이지를 찾을 수 없습니다</p></body></html>"
        )
        assert page_shows_not_found(page) is True
        page.set_content(
            "<html><body><h1>검색필터 수정</h1><div>저장상품수</div>"
            "<div>검색결과 상위 3 개</div><button>저장하기</button></body></html>"
        )
        assert page_shows_not_found(page) is False
        browser.close()


def test_modify_popup_save_count_and_save_button():
    """저장상품수: 값 '3' 칸을 찾아 상품수값으로 대체."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(MODIFY_HTML)
        before = page.locator("td:has-text('검색결과 상위') input").input_value()
        assert before == "3"
        assert set_save_count(page, 44)
        val = page.locator("td:has-text('검색결과 상위') input").input_value()
        assert val == "44"
        url_val = page.locator("tr:has-text('검색 URL') input").input_value()
        assert "zara.com" in url_val
        assert click_save_button(page)
        assert is_modify_page_open(page) is True
        browser.close()


def test_screenshot_step_and_save_count_grid(tmp_path: Path):
    """필터일치 단계 샷 + 저장상품수 입력그리드 근접 샷."""
    from playwright.sync_api import sync_playwright
    from update_filters import screenshot_save_count_grid, screenshot_step

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(MODIFY_HTML)
        shot_dir = tmp_path / "shots"
        p1 = screenshot_step(
            page,
            shot_dir,
            step_tag="02_modify_opened",
            label="2)검색필터 수정 화면",
            row_no=1,
            progress=None,
        )
        assert p1 is not None and p1.is_file()
        loc = page.locator("td:has-text('검색결과 상위') input").first
        p2 = screenshot_save_count_grid(
            page,
            loc,
            shot_dir,
            tag="before",
            row_no=1,
            note="현재값=3",
            progress=None,
        )
        assert p2 is not None and p2.is_file()
        browser.close()


def test_set_save_count_always_before_after_shots(tmp_path: Path):
    """3)저장상품수 갱신 전·후 스크린샷이 항상 생성된다."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(MODIFY_HTML)
        shot_dir = tmp_path / "shots"
        assert set_save_count(page, 63, shot_dir=shot_dir, row_no=10)
        before = shot_dir / "r010_03_save_count_before.png"
        after = shot_dir / "r010_03_save_count_after.png"
        assert before.is_file() and before.stat().st_size > 0
        assert after.is_file() and after.stat().st_size > 0
        assert (shot_dir / "r010_save_count_before.png").is_file()
        assert (shot_dir / "r010_save_count_after.png").is_file()
        assert page.locator("td:has-text('검색결과 상위') input").input_value() == "63"
        browser.close()


def test_modified_confirm_click_after_popup_close():
    """저장 후 '수정되었습니다' 팝업의 확인 버튼 클릭."""
    from playwright.sync_api import sync_playwright

    html = """
    <html><body>
      <div class="ui-dialog" role="dialog">
        <div>수정되었습니다</div>
        <input type="button" id="okbtn" value="확인">
      </div>
      <script>
        document.getElementById('okbtn').onclick = function() {
          document.body.setAttribute('data-confirmed', '1');
          this.closest('.ui-dialog').remove();
        };
      </script>
    </body></html>
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html)
        assert wait_modify_page_closed(page, timeout_ms=2000) is True
        assert click_modified_confirm(page, timeout_ms=5000) is True
        assert page.locator("body").get_attribute("data-confirmed") == "1"
        assert page.locator("text=수정되었습니다").count() == 0
        browser.close()


if __name__ == "__main__":
    import tempfile

    test_map_save_count_rules()
    test_normalize_url()
    test_filters_equal()
    with tempfile.TemporaryDirectory() as d:
        test_read_excel_and_lookup(Path(d))
    test_list_demango_rows_filter_input_and_url()
    test_modify_popup_save_count_and_save_button()
    with tempfile.TemporaryDirectory() as d2:
        test_screenshot_step_and_save_count_grid(Path(d2))
    test_modified_confirm_click_after_popup_close()
    print("PASS P3_필터_갱신 tests")
