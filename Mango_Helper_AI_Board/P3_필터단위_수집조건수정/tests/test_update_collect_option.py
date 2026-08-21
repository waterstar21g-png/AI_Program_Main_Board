"""P3_필터단위_수집조건수정 단위테스트 — 브라우저 없이 로직만 검증."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import update_collect_option as uco  # noqa: E402

# 스크린샷(망고 「번역 후 저장」 드롭다운) 목록 — 순서 그대로
MANGO_OPTIONS = [
    "번역안함",
    "더망고 무료 번역기 사용",
    "구글 번역기 사용",
    "DeepL 번역기 사용",
    "네이버(클라우드) 번역기 사용",
]
MANGO_VALUES = ["0", "1", "2", "3", "4"]


class FakeSelect:
    """select[name=translate_method] 흉내 — 라벨/값 선택과 현재값 읽기."""

    def __init__(self, options, values, selected=0):
        self.options = list(options)
        self.values = list(values)
        self.selected = selected
        self.calls: list[tuple] = []

    @property
    def first(self):  # Playwright Locator.first
        return self

    def count(self) -> int:
        return 1

    def evaluate(self, script, *args):
        if "Array.from(el.options)" in script:
            return [
                {"text": t, "value": v} for t, v in zip(self.options, self.values)
            ]
        if "selectedIndex" in script:
            return self.options[self.selected]
        raise AssertionError(f"예상 못한 스크립트: {script[:40]}")

    def select_option(self, value=None, *, label=None, timeout=None):
        self.calls.append((value, label))
        if label is not None:
            if label not in self.options:
                raise RuntimeError("no such label")
            self.selected = self.options.index(label)
            return
        if value in self.values:
            self.selected = self.values.index(value)
            return
        raise RuntimeError("no such value")


class MissingLocator:
    @property
    def first(self):
        return self

    def nth(self, _idx):
        return self

    def count(self) -> int:
        return 0


class FakeButton:
    def __init__(self, present=True):
        self.present = present
        self.clicks = 0
        self.presses: list[str] = []
        self.selectors: list[str] = []

    @property
    def first(self):
        return self

    def count(self) -> int:
        return 1 if self.present else 0

    def click(self, timeout=None):
        if not self.present:
            raise RuntimeError("없음")
        self.clicks += 1

    def press(self, key, timeout=None):
        self.presses.append(key)


class FakePage:
    def __init__(self, select=None, scan_result=None, site_select=None, search=None):
        self._select = select
        self._scan = scan_result
        self._site = site_select
        self._search = search
        self.locators: list[str] = []
        self.waited = False

    def locator(self, selector):
        self.locators.append(selector)
        if self._select is not None and uco.TRANSLATE_SELECT_NAME in selector:
            return self._select
        if self._site is not None and uco.SITE_SELECT_NAME in selector:
            return self._site
        if self._search is not None and (
            "bt_type" in selector or "검색" in selector or "sch_keyword" in selector
        ):
            self._search.selectors.append(selector)
            return self._search
        return MissingLocator()

    def evaluate(self, script, *args):
        return self._scan

    def wait_for_load_state(self, state, timeout=None):
        self.waited = True


def _select_page(selected=0):
    return FakePage(FakeSelect(MANGO_OPTIONS, MANGO_VALUES, selected))


# ── 리스트박스 기본 목록 (사용자 지정: 스크린샷 그대로) ───────────


def test_default_options_match_mango_screen():
    assert list(uco.DEFAULT_TRANSLATE_OPTIONS) == MANGO_OPTIONS


def test_cached_options_fall_back_to_defaults(monkeypatch, tmp_path):
    monkeypatch.setattr(uco, "OPTIONS_CACHE_PATH", tmp_path / "none.json")
    assert uco.load_cached_options() == MANGO_OPTIONS


def test_cached_options_round_trip(monkeypatch, tmp_path):
    monkeypatch.setattr(uco, "OPTIONS_CACHE_PATH", tmp_path / "opts.json")
    uco.save_cached_options(["구글 번역기 사용", "번역안함"])
    assert uco.load_cached_options() == ["구글 번역기 사용", "번역안함"]


# ── 옵션 이름 매칭 ────────────────────────────────────────────────


def test_match_option_exact_and_normalized():
    assert uco.match_option(MANGO_OPTIONS, "구글 번역기 사용") == "구글 번역기 사용"
    assert uco.match_option(MANGO_OPTIONS, " 구글번역기사용 ") == "구글 번역기 사용"


def test_match_option_partial_and_miss():
    assert uco.match_option(MANGO_OPTIONS, "DeepL") == "DeepL 번역기 사용"
    assert uco.match_option(MANGO_OPTIONS, "파파고 번역") is None
    assert uco.match_option(MANGO_OPTIONS, "") is None


# ── 컨트롤 검출 ──────────────────────────────────────────────────


def test_detect_uses_translate_method_select():
    page = _select_page()
    control = uco.detect_translate_control(page)
    assert control is not None
    assert control.kind == "select"
    assert control.options == MANGO_OPTIONS
    assert control.values == MANGO_VALUES
    assert any(uco.TRANSLATE_SELECT_NAME in s for s in page.locators)


def test_detect_returns_none_without_control():
    assert uco.detect_translate_control(FakePage()) is None


def test_detect_radio_fallback():
    scan = {
        "kind": "radio",
        "options": ["번역안함", "구글 번역기 사용"],
        "name": "trans",
        "values": ["0", "2"],
    }
    control = uco.detect_translate_control(FakePage(scan_result=scan))
    assert control is not None and control.kind == "radio"
    assert [label for label, _loc in control.choices] == scan["options"]


def test_detect_checkbox_fallback():
    scan = {"kind": "checkbox", "options": ["사용", "미사용"], "name": "trans", "id": ""}
    control = uco.detect_translate_control(FakePage(scan_result=scan))
    assert control is not None and control.kind == "checkbox"


# ── 적용 ─────────────────────────────────────────────────────────


def test_read_current_option_returns_label_not_value():
    control = uco.detect_translate_control(_select_page(selected=2))
    assert uco.read_current_option(control) == "구글 번역기 사용"


def test_apply_option_selects_by_label():
    page = _select_page(selected=0)
    control = uco.detect_translate_control(page)
    logs: list[str] = []
    assert uco.apply_option(control, "DeepL 번역기 사용", progress=logs.append) is True
    assert control.locator.selected == 3
    assert control.locator.calls[0] == (None, "DeepL 번역기 사용")
    assert any("번역안함" in l and "DeepL 번역기 사용" in l for l in logs)


def test_apply_option_accepts_partial_pick():
    control = uco.detect_translate_control(_select_page())
    assert uco.apply_option(control, "네이버") is True
    assert control.locator.selected == 4


def test_apply_option_unknown_choice_fails():
    control = uco.detect_translate_control(_select_page())
    logs: list[str] = []
    assert uco.apply_option(control, "파파고", progress=logs.append) is False
    assert control.locator.selected == 0
    assert any("미검출" in l for l in logs)


def test_apply_option_falls_back_to_value():
    select = FakeSelect(MANGO_OPTIONS, MANGO_VALUES)

    def label_fails(value=None, *, label=None, timeout=None):
        if label is not None:
            raise RuntimeError("label 선택 불가")
        FakeSelect.select_option(select, value, label=None, timeout=timeout)

    control = uco.detect_translate_control(FakePage(select))
    select.select_option = label_fails  # type: ignore[assignment]
    assert uco.apply_option(control, "구글 번역기 사용") is True
    assert select.selected == 2


def test_checkbox_on_off_words():
    assert uco.wants_on("사용") is True
    assert uco.wants_on("미사용") is False
    assert uco.wants_on("번역안함") is False


# ── 보드 연동 (옵션 목록 주고받기) ────────────────────────────────


def test_option_lines_round_trip():
    text = uco.format_option_lines(MANGO_OPTIONS)
    assert uco.parse_option_lines("잡음\n" + text + "\n기타 로그") == MANGO_OPTIONS


def test_parse_option_lines_ignores_other_output():
    assert uco.parse_option_lines("##MAIN##필터 3행\n[오류] 없음") == []


# ── 수집사이트 리스트박스 (스크린샷: select[name=site_id]) ────────


MANGO_SITES = [
    "-- 수집사이트 --",
    "4910.kr",
    "ABCmart.a-rt.com",
    "HIVER.co.kr",
    "MUSINSA.com",
    "Zara.com/de",
]


def test_default_sites_match_mango_screen():
    assert list(uco.DEFAULT_SITE_OPTIONS) == MANGO_SITES


def test_cached_sites_round_trip(monkeypatch, tmp_path):
    monkeypatch.setattr(uco, "SITES_CACHE_PATH", tmp_path / "sites.json")
    assert uco.load_cached_sites() == MANGO_SITES
    uco.save_cached_sites(["MUSINSA.com"])
    assert uco.load_cached_sites() == ["MUSINSA.com"]


def test_is_all_sites():
    assert uco.is_all_sites("") is True
    assert uco.is_all_sites("-- 수집사이트 --") is True
    assert uco.is_all_sites("MUSINSA.com") is False


def test_read_site_options_from_select():
    page = FakePage(site_select=FakeSelect(MANGO_SITES, ["", "1", "2", "3", "4", "5"]))
    assert uco.read_site_options(page) == MANGO_SITES


def test_apply_site_filter_selects_and_searches():
    site_select = FakeSelect(MANGO_SITES, ["", "1", "2", "3", "4", "5"])
    search = FakeButton()
    page = FakePage(site_select=site_select, search=search)
    logs: list[str] = []
    assert uco.apply_site_filter(page, "MUSINSA.com", progress=logs.append) is True
    assert site_select.selected == 4
    assert search.clicks == 1
    assert page.waited is True


def test_apply_site_filter_all_skips_screen():
    page = FakePage()
    assert uco.apply_site_filter(page, "-- 수집사이트 --") is True
    assert page.locators == []  # 화면을 건드리지 않음


def test_apply_site_filter_missing_select_fails():
    assert uco.apply_site_filter(FakePage(), "MUSINSA.com") is False


def test_click_search_uses_select_condition_button_first():
    search = FakeButton()
    page = FakePage(search=search)
    logs: list[str] = []
    assert uco.click_search(page, progress=logs.append) is True
    assert uco.SEARCH_BUTTON_LABEL in search.selectors[0]
    assert search.clicks == 1
    assert any(uco.SEARCH_BUTTON_LABEL in l for l in logs)


def test_click_search_falls_back_to_enter():
    keyword = FakeButton(present=False)
    page = FakePage(search=keyword)
    assert uco.click_search(page) is True
    assert keyword.presses == ["Enter"]


# ── 수집조건수정 팝업 (열기 → 저장하기 → 닫기) ───────────────────


def test_default_list_url_is_first_screen():
    assert (
        uco.DEFAULT_LIST_URL
        == "https://tmg1898.cafe24.com/mall/admin/shop/getGoodsCategory.php"
    )


def test_build_modify_url_sits_under_admin_not_shop():
    url = uco.build_modify_url(uco.DEFAULT_LIST_URL, "720")
    assert url == (
        "https://tmg1898.cafe24.com/mall/admin/admin_group_modify.php"
        "?ps_mode=modify_filter&ps_fuid=720"
    )


def test_build_modify_url_keeps_query_of_list_out():
    url = uco.build_modify_url(uco.DEFAULT_LIST_URL + "?site_id=zara_de&pg=2", "13")
    assert url.endswith("admin_group_modify.php?ps_mode=modify_filter&ps_fuid=13")


def test_build_modify_url_needs_host():
    assert uco.build_modify_url("", "720") == ""


class FakePopup:
    def __init__(self, options=MANGO_OPTIONS, save=True, closes=True):
        self.select = FakeSelect(options, MANGO_VALUES)
        self.save_btn = FakeButton(present=save)
        self.closes = closes
        self.closed = False
        self.dialog_handler = None
        self.waited_selector = ""

    def on(self, event, handler):
        if event == "dialog":
            self.dialog_handler = handler

    def locator(self, selector):
        if uco.TRANSLATE_SELECT_NAME in selector:
            return self.select
        if "set_save" in selector or "저장하기" in selector:
            return self.save_btn
        return MissingLocator()

    def evaluate(self, script, *args):
        return None

    def wait_for_selector(self, selector, timeout=None):
        self.waited_selector = selector

    def wait_for_event(self, event, timeout=None):
        if not self.closes:
            raise RuntimeError("안 닫힘")
        self.closed = True

    def is_closed(self):
        return self.closed

    def close(self):
        self.closed = True


class PopupHost:
    """팝업을 돌려주는 목록 페이지 대역."""

    def __init__(self, popup):
        self.popup = popup

    def expect_popup(self, timeout=None):
        host = self

        class Ctx:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            @property
            def value(self):
                return host.popup

        return Ctx()

    def locator(self, selector):
        return FakeButton()


def test_apply_option_in_popup_full_flow():
    popup = FakePopup()
    logs: list[str] = []
    ok = uco.apply_option_in_popup(
        PopupHost(popup), "720", "구글 번역기 사용", progress=logs.append
    )
    assert ok is True
    assert popup.select.selected == 2          # 번역옵션 선택
    assert popup.save_btn.clicks == 1          # 저장하기
    assert popup.closed is True                # 모달 닫기
    assert popup.dialog_handler is not None    # 저장 알림 자동 확인
    assert uco.TRANSLATE_SELECT_NAME in popup.waited_selector


def test_apply_option_in_popup_save_button_missing_uses_set_save():
    popup = FakePopup(save=False)
    calls: list[str] = []
    popup.evaluate = lambda script, *a: calls.append(script)  # type: ignore[assignment]
    assert uco.apply_option_in_popup(PopupHost(popup), "720", "번역안함") is True
    assert any("set_save" in c for c in calls)


def test_apply_option_in_popup_closes_even_if_window_stays():
    popup = FakePopup(closes=False)
    assert uco.apply_option_in_popup(PopupHost(popup), "720", "번역안함") is True
    assert popup.closed is True


def test_apply_option_in_popup_bad_option_fails_without_save():
    popup = FakePopup()
    assert uco.apply_option_in_popup(PopupHost(popup), "720", "파파고") is False
    assert popup.save_btn.clicks == 0


# ── 실행 인자 검증 ───────────────────────────────────────────────


def test_run_requires_option():
    result = uco.run_update_collect_option("   ")
    assert result.ok is False
    assert "선택" in result.errors[0]


def test_option_lines_include_sites():
    text = uco.format_option_lines(MANGO_OPTIONS, MANGO_SITES)
    assert uco.parse_option_lines(text) == MANGO_OPTIONS
    assert uco.parse_site_lines(text) == MANGO_SITES
