"""P3_필터_갱신 단위테스트 — 저장상품수 매핑·URL정규화·엑셀 읽기."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import openpyxl  # noqa: E402
from update_filters import (  # noqa: E402
    DEFAULT_MANGO_URL,
    click_edit_on_row,
    click_modified_confirm,
    click_save_button,
    excel_by_url,
    filter_compare_note,
    find_excel_by_demango_url,
    filters_equal,
    is_modify_page_open,
    list_demango_rows,
    load_mango_url_default,
    map_save_count,
    normalize_url,
    page_shows_not_found,
    read_excel_rows,
    save_mango_url,
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


def test_mango_url_default_and_save(tmp_path: Path, monkeypatch):
    """망고 URL 고정 초기값 = getGoodsCategory.php(filter_delete·zara_de)."""
    import update_filters as uf

    path = tmp_path / ".last_mango_url"
    monkeypatch.setattr(uf, "LAST_MANGO_URL_PATH", path)
    want = (
        "https://tmg1898.cafe24.com/mall/admin/shop/getGoodsCategory.php"
        "?pmode=filter_delete&uids=&pg=1&date_type=modify"
        "&start_yy=2026&start_mm=8&start_dd=12"
        "&end_yy=2026&end_mm=8&end_dd=12"
        "&site_id=zara_de&sales_yn=&sch_keyword="
        "&ft_num=all&ft_show=&ft_sort=modify_asc"
    )
    assert DEFAULT_MANGO_URL == want
    assert load_mango_url_default() == want
    # .last 에 다른 값이 있어도 초기값은 고정
    path.write_text("https://abcmart.a-rt.com/?track=W0009\n", encoding="utf-8")
    assert load_mango_url_default() == want
    save_mango_url(want)
    assert path.read_text(encoding="utf-8").strip() == want


def test_reveal_browser_page_brings_front():
    """현재 Chrome 탭/팝업을 bring_to_front 로 보여 준다 (화면상세 로그는 억제)."""
    from playwright.sync_api import sync_playwright
    from update_filters import attach_current_mango_page, describe_page_state, reveal_browser_page

    assert callable(attach_current_mango_page)
    fronts: list[str] = []

    class Wrap:
        def __init__(self, page):
            self._p = page

        def __getattr__(self, name):
            return getattr(self._p, name)

        def bring_to_front(self):
            fronts.append("front")
            return self._p.bring_to_front()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(
            "<html><head><title>팝업테스트</title></head>"
            "<body>스토어팝업</body></html>"
        )
        wrapped = Wrap(page)
        reveal_browser_page(
            wrapped, None, step_no="2", action="스토어 팝업 표시", dwell_s=0
        )
        state = describe_page_state(page)
        browser.close()

    assert fronts == ["front"]
    assert "팝업테스트" in state or "url=" in state


def test_attach_mango_browser_uses_p2_connect_browser():
    """P3는 P2 connect_browser 로 망고 Chrome을 연결·표시한다."""
    from update_filters import attach_mango_browser_like_p2

    calls: list[str] = []

    class FakePage:
        url = "https://tmg1898.cafe24.com/mall/admin/admin.php"
        context = None

        def __init__(self):
            self.context = self

        def new_cdp_session(self, _page):
            class S:
                def send(self, *_a, **_k):
                    return {"windowId": 1}

                def detach(self):
                    return None

            return S()

        def set_default_timeout(self, *_a, **_k):
            return None

        def bring_to_front(self):
            calls.append("front")

        def evaluate(self, *_a, **_k):
            return None

        def is_closed(self):
            return False

        def title(self):
            return "mango"

    class FakeP2:
        @staticmethod
        def connect_browser(_pw):
            calls.append("connect")
            return object(), FakePage()

        @staticmethod
        def refresh_if_closed(page):
            return page

    _browser, page = attach_mango_browser_like_p2(FakeP2(), object(), progress=None)
    assert "connect" in calls
    assert "front" in calls
    assert isinstance(page, FakePage)


def test_maximize_mango_chrome_window_logs_and_cdp():
    """목록 복귀 후 행 재탐색 전 — 망고 창 최대화 CDP (화면상세 로그는 억제)."""
    from update_filters import maximize_mango_chrome_window

    cdp_states: list[str] = []

    class FakePage:
        url = "https://tmg1898.cafe24.com/mall/admin/shop/getGoodsCategory.php"
        context = None

        def __init__(self):
            self.context = self

        def new_cdp_session(self, _page):
            class S:
                def send(self, method, params=None):
                    if method == "Browser.getWindowForTarget":
                        return {"windowId": 7}
                    if method == "Browser.setWindowBounds":
                        cdp_states.append(
                            (params or {}).get("bounds", {}).get("windowState")
                        )
                        return {}
                    return {}

                def detach(self):
                    return None

            return S()

        def bring_to_front(self):
            return None

        def evaluate(self, *_a, **_k):
            return None

        def is_closed(self):
            return False

        def title(self):
            return "더망고"

    maximize_mango_chrome_window(FakePage(), None, dwell_s=0)
    assert "maximized" in cdp_states


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


def test_no_coordinate_click_logic_in_source():
    """'전체저장 우측 N글자 이동 클릭' 좌표계산 로직은 완전히 삭제되어야 함."""
    src = (ROOT / "update_filters.py").read_text(encoding="utf-8")
    assert "EDIT_CLICK_FIXED_CHARS" not in src
    assert "EDIT_CLICK_CHAR_PAD_X" not in src
    assert "_edit_click_point_from_allsave" not in src
    assert "_find_allsave_anchor_geometry" not in src
    assert "page.mouse.click(x, y)" not in src


def test_find_edit_button_with_log_marks_real_element():
    """LABEL '수집조건수정'의 실제 버튼요소를 찾아 마킹 — 좌표 없이 요소 자체를 반환."""
    from playwright.sync_api import sync_playwright
    from update_filters import _find_edit_button_with_log

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(DEMANGO_LIST_WITH_DECOY_HTML)
        rows = list_demango_rows(page)
        info = _find_edit_button_with_log(
            page,
            int(rows[0]["index"]),
            rows[0]["url"],
            log_find=False,
        )
        assert info.get("ok") is True
        assert info.get("allsave_found") is True
        assert info.get("matched_label") == "수집조건수정"
        # 실제 DOM 요소가 마킹되어 locator로 곧바로 클릭 가능해야 함
        assert page.locator('[data-p3-edit-target="1"]').count() == 1
        browser.close()


def test_find_edit_button_with_log_logs_text_and_screenshots(tmp_path: Path):
    """전체저장/수집조건수정 찾기 전·후 — 텍스트·버튼명 + 스크린샷 로그."""
    from playwright.sync_api import sync_playwright
    from update_filters import _find_edit_button_with_log, _is_major_log

    logs: list[tuple[str, str]] = []

    def progress(step: str, msg: str) -> None:
        logs.append((step, msg))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(DEMANGO_LIST_WITH_DECOY_HTML)
        rows = list_demango_rows(page)
        shot_dir = tmp_path / "shots"
        info = _find_edit_button_with_log(
            page,
            int(rows[0]["index"]),
            rows[0]["url"],
            progress=progress,
            shot_dir=shot_dir,
            row_no=1,
            log_find=True,
        )
        assert info.get("ok") is True
        browser.close()

    texts = [m for s, m in logs]
    assert any("텍스트 찾기 전" in m and "전체저장" in m for m in texts)
    assert any("텍스트 찾기 후" in m and "전체저장" in m for m in texts)
    assert any("버튼명 찾기 전" in m and "수집조건수정" in m for m in texts)
    assert any("버튼명 찾기 후" in m and "수집조건수정" in m for m in texts)
    shots = list(shot_dir.glob("*.png"))
    assert len(shots) >= 4
    assert _is_major_log("주요", "6) 텍스트 찾기 전 · 텍스트=전체저장")
    assert not _is_major_log("화면", "망고 Chrome 창 표시")


def test_click_edit_on_row_uses_real_locator_click_not_coordinates(tmp_path: Path):
    """click_edit_on_row 는 마킹된 실제 버튼 요소를 locator.click() 으로 클릭한다."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.set_content(DEMANGO_LIST_WITH_DECOY_HTML)
        rows = list_demango_rows(page)
        ok = click_edit_on_row(
            page,
            int(rows[0]["index"]),
            row_url=rows[0]["url"],
            progress=None,
            shot_dir=tmp_path / "shots",
            row_no=1,
            max_tries=2,
            try_interval_s=0.2,
        )
        assert ok is True
        # onclick 핸들러가 실행되어 실제 클릭이 일어났음을 증명
        assert page.locator("body").get_attribute("data-clicked") == "real-777"
        browser.close()


def test_run_update_uses_canonical_7step_log_messages():
    """run_update 본문이 사용자 지정 1)~7) 단계 문구·중요정보를 사용해야 함."""
    src = (ROOT / "update_filters.py").read_text(encoding="utf-8")
    assert "1) 망고 수집 URL 링크로 진입" in src
    assert "2) KEY매칭 성공 · 필터=" in src
    assert "4) 상품노출수(카드수) 추출 — 건너뛰고 수행" in src
    assert "'저장하기' 클릭 완료" in src
    assert "6) '수정되었습니다' 확인 클릭 완료" in src
    assert "7) 갱신성공 → 다음 행 반복" in src
    # 매칭되지 않는 행 정보는 로그에 남기지 않음 (KEY/필터 불일치 시 조용히 skip)
    assert "매칭되지 않는 정보는 로그에 남기지 않는다" in src
    # 옛 Logger 세부로그 클래스·미사용 비교로그는 완전히 제거됨
    assert "class Logger" not in src
    assert "DETAIL_EXCEL_ROWS" not in src
    assert "log_first10_compare" not in src
    # '저장'이 아닌 '저장하기' 라벨을 찾아 클릭 (요건 정정 반영)
    assert 'value="저장하기"' in src
    assert "click_save_button" in src


def test_major_log_filter_keeps_steps_drops_noise():
    """1)~7) 로 시작하는 단계 로그 + 오류/중단/완료/샷만 유지, 나머지는 억제."""
    from update_filters import _is_major_log

    assert _is_major_log("로직", "5) LABEL '수집조건수정' 버튼 찾아 실제 클릭")
    assert _is_major_log("오류", "행1 실패")
    assert not _is_major_log("준비", "스크린샷 폴더: /tmp/x")
    assert not _is_major_log("화면", "필터일치 목록행 표시 · filter=x")
    # reveal_browser_page 등은 major=False 로 명시 호출되어 _is_major_log 판단 자체를 건너뜀
    # (여기서는 순수 함수 동작만 검증: 숫자로 시작하지 않으면 항상 억제됨)


def test_store_count_call_disabled_but_function_kept():
    """상품수 카운트 함수·로그는 유지, CALL 플래그만 False (테스트시간 절약)."""
    import update_filters as uf

    assert uf.ENABLE_STORE_COUNT_CALL is False
    assert callable(uf.browse_store_count_cards)
    src = (ROOT / "update_filters.py").read_text(encoding="utf-8")
    assert "def browse_store_count_cards" in src
    assert "상품수 카드 갯수=" in src
    assert "if ENABLE_STORE_COUNT_CALL:" in src


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
