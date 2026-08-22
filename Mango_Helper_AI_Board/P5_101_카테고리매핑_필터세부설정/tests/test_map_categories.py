"""P5_101 단위테스트 — 매칭 로직·선택자·행 파싱을 브라우저 없이 검증."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import map_categories as mc  # noqa: E402

AUCTION = [
    "패션의류/잡화 > 남성패션 > 남성잡화 > 모자 > 비니",
    "패션의류/잡화 > 여성패션 > 여성잡화 > 모자 > 캡모자",
    "e쿠폰/모바일상품권 > 교육/어학이용권 > 온라인교육/외국어",
    "스포츠/레저 > 등산 > 등산모자",
]


# ── 매칭 로직 ────────────────────────────────────────────────────


def test_tokenize_splits_separators():
    assert mc.tokenize("남성패션 > 남성잡화_모자/비니") == [
        "남성패션",
        "남성잡화",
        "모자",
        "비니",
    ]


def test_leaf_of():
    assert mc.leaf_of("A > B > C") == "C"
    assert mc.leaf_of("단일") == "단일"
    assert mc.leaf_of("") == ""


def test_similarity_prefers_leaf_match():
    high = mc.similarity("남성 비니", "패션의류/잡화 > 남성패션 > 남성잡화 > 모자 > 비니")
    low = mc.similarity("남성 비니", "e쿠폰/모바일상품권 > 교육/어학이용권 > 온라인교육/외국어")
    assert high > low
    assert 0.0 <= low <= high <= 1.0


def test_best_category_picks_expected():
    cat, score = mc.best_category("남성 비니", AUCTION)
    assert cat.endswith("비니")
    assert score >= mc.MIN_SCORE


def test_best_category_returns_empty_when_unrelated():
    cat, score = mc.best_category("자동차 타이어 공기압 센서", AUCTION)
    assert cat == ""
    assert score < mc.MIN_SCORE


def test_search_keyword_is_leaf():
    assert mc.search_keyword_for("A > B > 비니") == "비니"


def test_pick_option_exact_then_leaf():
    options = [
        "패션잡화 > 모자 > 비니",
        "패션의류/잡화 > 남성패션 > 남성잡화 > 모자 > 비니",
    ]
    target = "패션의류/잡화 > 남성패션 > 남성잡화 > 모자 > 비니"
    assert mc.pick_option(options, target) == target          # 완전일치
    assert mc.pick_option(["잡화 > 모자 > 비니"], target).endswith("비니")  # 리프일치
    assert mc.pick_option([], target) == ""


# ── 엑셀 로딩 ────────────────────────────────────────────────────


def _write_excel(path: Path, rows: list[list[str]], headers: list[str]) -> None:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    wb.save(str(path))


def test_load_categories_from_p5_format(tmp_path):
    path = tmp_path / "카테고리분류표_옥션2.0_20260822.xlsx"
    _write_excel(
        path,
        [
            ["옥션2.0", "", "패션의류/잡화", "남성패션", "", "", "", "", "패션의류/잡화 > 남성패션"],
            ["옥션2.0", "", "스포츠/레저", "등산", "", "", "", "", "스포츠/레저 > 등산"],
        ],
        ["마켓", "구분", "1단계", "2단계", "3단계", "4단계", "5단계", "6단계", "전체경로"],
    )
    cats = mc.load_categories(path)
    assert cats == ["패션의류/잡화 > 남성패션", "스포츠/레저 > 등산"]


def test_load_categories_falls_back_to_levels(tmp_path):
    path = tmp_path / "cat.xlsx"
    _write_excel(
        path,
        [["패션", "모자", "비니"], ["스포츠", "등산", ""]],
        ["1단계", "2단계", "3단계"],
    )
    assert mc.load_categories(path) == ["패션 > 모자 > 비니", "스포츠 > 등산"]


def test_market_from_filename():
    assert mc.market_from_filename("카테고리분류표_옥션2.0_20260822.xlsx") == "AUC20"
    assert mc.market_from_filename("11ST_categories.xlsx") == "11ST"
    assert mc.market_from_filename("무관한파일.xlsx") == ""


def test_discover_market_excels(tmp_path):
    for name in ("카테고리분류표_옥션2.0_1.xlsx", "카테고리분류표_쿠팡_1.xlsx", "기타.xlsx"):
        _write_excel(tmp_path / name, [["A"]], ["1단계"])
    found = mc.discover_market_excels(tmp_path)
    assert set(found) == {"AUC20", "COUP"}


def test_load_market_excels_reports(tmp_path):
    path = tmp_path / "카테고리분류표_쿠팡_1.xlsx"
    _write_excel(path, [["패션", "모자"]], ["1단계", "2단계"])
    logs: list[str] = []
    data = mc.load_market_excels({"COUP": path}, progress=logs.append)
    assert data["COUP"] == ["패션 > 모자"]
    assert any("쿠팡" in l for l in logs)


# ── 화면 선택자 (스크린샷 DOM) ────────────────────────────────────


def test_mapping_url_uses_category_set_page():
    url = mc.build_mapping_url("655")
    assert url.endswith("admin_category_set.php?tm=F&ps_ftid=655")
    assert "/mall/admin/" in url


def test_markets_are_six():
    assert list(mc.MARKETS) == ["AUC20", "11ST", "GMK20", "SMART", "COUP", "LTON"]


def test_screen_hooks_match_screenshots():
    assert mc.SEARCH_FILTER_JS == "search_filter('search')"
    assert mc.SETTING_EDIT_JS == "market_mapping_new"
    assert mc.AI_MAPPING_JS == "search_recommend_category_all"
    assert mc.CONFIG_SAVE_JS == "config_save"


class FakeLoc:
    def __init__(self, page, name, present=True):
        self.page = page
        self.name = name
        self.present = present

    @property
    def first(self):
        return self

    def count(self):
        return 1 if self.present else 0

    def click(self, timeout=None):
        self.page.actions.append(("click", self.name))

    def fill(self, value, timeout=None):
        self.page.actions.append(("fill", self.name, value))

    def select_option(self, value=None, *, label=None, timeout=None):
        self.page.actions.append(("select", self.name, label or value))


class FakePopup:
    def __init__(self, options):
        self.options = list(options)
        self.actions: list[tuple] = []
        self.asked_ids = None

    def locator(self, selector):
        for code in mc.MARKETS:
            if f"search_text_{code}" in selector:
                return FakeLoc(self, f"input_{code}")
            if f"search_list_{code}" in selector and selector.startswith("#"):
                return FakeLoc(self, f"list_{code}")
            if f"search_category('{code}'" in selector:
                return FakeLoc(self, f"searchbtn_{code}")
        if "config_save" in selector:
            return FakeLoc(self, "save")
        if "search_recommend_category_all" in selector:
            return FakeLoc(self, "ai")
        return FakeLoc(self, "none", present=False)

    def evaluate(self, script, *args):
        self.asked_ids = args[0] if args else None
        return {"texts": self.options, "id": "openmarket_category_search_list_AUC20"}

    def wait_for_timeout(self, ms):
        return None


def test_map_one_market_full_sequence():
    target = "패션의류/잡화 > 남성패션 > 남성잡화 > 모자 > 비니"
    popup = FakePopup([target, "패션 > 모자 > 캡모자"])
    logs: list[str] = []

    item = mc.map_one_market(popup, "AUC20", "남성 비니", AUCTION, progress=logs.append)

    assert item.ok is True
    assert item.category == target
    kinds = [a[0] for a in popup.actions]
    assert kinds == ["fill", "click", "select"]      # 입력 → 검색 → 선택
    assert popup.actions[0][2] == "비니"              # 검색어 = 리프
    assert popup.actions[1][1] == "searchbtn_AUC20"
    assert popup.actions[2][2] == target


def test_map_one_market_without_excel_is_skipped():
    item = mc.map_one_market(FakePopup([]), "COUP", "남성 비니", [])
    assert item.ok is False
    assert "엑셀" in item.reason


def test_map_one_market_no_search_result(monkeypatch):
    monkeypatch.setattr(mc, "T_LIST", 300)
    popup = FakePopup([])
    item = mc.map_one_market(popup, "AUC20", "남성 비니", AUCTION)
    assert item.ok is False
    assert item.reason == "검색 결과 없음"


# ── 목록 행 파싱 ─────────────────────────────────────────────────


class RowsPage:
    def __init__(self, rows):
        self.rows = rows
        self.frames = [self]

    def evaluate(self, script, *args):
        if "location.href" in script:
            return {"url": "u", "table": True, "rows": 3, "checkboxes": 0,
                    "mappingLinks": len(self.rows), "sample": []}
        return self.rows


def test_list_rows_parses_checked_and_ftid():
    page = RowsPage(
        [
            {"index": 3, "ftid": "721", "filterName": "남성 비니", "checked": True},
            {"index": 4, "ftid": "722", "filterName": "여성 캡모자", "checked": False},
        ]
    )
    rows = mc.list_rows(page)
    assert [r.ftid for r in rows] == ["721", "722"]
    assert rows[0].checked is True and rows[1].checked is False
    assert rows[0].filter_name == "남성 비니"


def test_list_rows_js_reads_market_mapping_new():
    assert "market_mapping_new" in mc.LIST_ROWS_JS
    assert "checkbox" in mc.LIST_ROWS_JS


# ── 드라이런 ─────────────────────────────────────────────────────


def test_run_dry_reports_per_market():
    logs: list[str] = []
    out = mc.run_dry(["남성 비니"], {"AUC20": AUCTION}, progress=logs.append)
    assert out[0]["filter"] == "남성 비니"
    assert out[0]["items"][0]["market"] == "AUC20"
    assert out[0]["items"][0]["category"].endswith("비니")
    assert any("옥션2.0" in l for l in logs)


def test_market_input_ids_match_screenshots():
    """스크린샷 1~6: 마켓별 카테고리 검색 입력필드 id."""
    expect = {
        "AUC20": "openmarket_category_search_text_AUC20",
        "GMK20": "openmarket_category_search_text_GMK20",
        "SMART": "openmarket_category_search_text_SMART",
        "COUP": "openmarket_category_search_text_COUP",
        "LTON": "openmarket_category_search_text_LTON",
        "11ST": "openmarket_category_search_text_11ST",
    }
    for code, expected_id in expect.items():
        popup = FakePopup([])
        loc = mc.market_search_input(popup, code)
        assert loc is not None and loc.name == f"input_{code}"
        assert expected_id == f"openmarket_category_search_text_{code}"


def test_market_search_button_selector_per_market():
    for code in mc.MARKETS:
        popup = FakePopup([])
        assert mc.click_market_search(popup, code) is True
        assert popup.actions[-1] == ("click", f"searchbtn_{code}")


def test_result_select_ids_cover_both_variants():
    """11번가·롯데ON 은 결과 리스트박스도 list_/list2_ 두 벌 (스크린샷 2·6)."""
    assert mc.result_select_ids("11ST") == [
        "openmarket_category_search_list_11ST",
        "openmarket_category_search_list2_11ST",
    ]
    assert mc.result_select_ids("LTON")[1].endswith("list2_LTON")


def test_read_result_options_asks_both_ids_and_prefers_visible():
    popup = FakePopup(["A > B"])
    options, select_id = mc.read_result_options(popup, "LTON")
    assert options == ["A > B"]
    assert popup.asked_ids == mc.result_select_ids("LTON")
    assert select_id  # 사용한 select id 반환
    js = mc.RESULT_OPTIONS_JS
    assert "getComputedStyle" in js and "offsetParent" in js


# ── 작업 한정·범위 (요건 2026-08-22 14:46) ────────────────────────


def test_only_musinsa_is_allowed():
    assert mc.ALLOWED_SITES == ("musinsa.com",)
    assert mc.DEFAULT_SITE == "MUSINSA.com"
    assert mc.is_allowed_site("MUSINSA.com") is True
    assert mc.is_allowed_site("www.musinsa.com") is True
    assert mc.is_allowed_site("ABCmart.a-rt.com") is False
    assert mc.is_allowed_site("") is False


def test_run_rejects_other_sites():
    logs: list[str] = []
    result = mc.run_mapping(
        site_id="Zara.com/de",
        excels={"AUC20": AUCTION},
        progress=logs.append,
    )
    assert result.ok is False
    assert "musinsa.com" in result.errors[0]
    assert any("제한" in l for l in logs)


def test_row_range_applies(monkeypatch):
    """체크 여부와 무관하게 [부터]~[까지] 범위만 처리한다."""
    seen: list[str] = []
    rows = [
        mc.RowInfo(index=i, ftid=str(700 + i), filter_name=f"f{i}", checked=(i % 2 == 0))
        for i in range(10)
    ]

    monkeypatch.setattr(mc, "list_rows", lambda page: rows)
    monkeypatch.setattr(mc, "select_site", lambda *a, **k: True)
    monkeypatch.setattr(mc, "click_search_filter", lambda *a, **k: True)

    def fake_map_one_row(page, row, excels, **kwargs):
        seen.append(row.ftid)
        return {"ftid": row.ftid, "filter": row.filter_name, "items": [{"ok": True}]}

    monkeypatch.setattr(mc, "map_one_row", fake_map_one_row)

    class FakeP2:
        @staticmethod
        def connect_browser(pw):
            return None, FakeBrowserPage()

    class FakeBrowserPage:
        def goto(self, *a, **k):
            return None

    class FakePW:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setitem(sys.modules, "collect", FakeP2)
    monkeypatch.setitem(
        sys.modules,
        "playwright.sync_api",
        type("M", (), {"sync_playwright": lambda: FakePW()}),
    )

    result = mc.run_mapping(
        site_id="MUSINSA.com", excels={"AUC20": AUCTION}, row_from=2, row_to=4
    )
    assert seen == ["701", "702", "703"]   # 2~4행 (1부터, 양끝 포함)
    assert result.rows == 3


def test_invalid_row_range_falls_back_to_default(monkeypatch):
    monkeypatch.setattr(mc, "list_rows", lambda page: [])
    monkeypatch.setattr(mc, "select_site", lambda *a, **k: True)
    monkeypatch.setattr(mc, "click_search_filter", lambda *a, **k: True)

    class FakeP2:
        @staticmethod
        def connect_browser(pw):
            return None, type("P", (), {"goto": lambda self, *a, **k: None})()

    class FakePW:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setitem(sys.modules, "collect", FakeP2)
    monkeypatch.setitem(
        sys.modules,
        "playwright.sync_api",
        type("M", (), {"sync_playwright": lambda: FakePW()}),
    )

    result = mc.run_mapping(
        site_id="MUSINSA.com", excels={"AUC20": AUCTION}, row_from=0, row_to=-2
    )
    assert "작업 대상 행이 없습니다" in result.errors[0]  # 기본값(1~5)으로 진행하다 행 없음


# ── 작업 범위 · 수집사이트 제한 (요건 2026-08-22 14:46/14:49) ─────


def test_site_restricted_to_musinsa():
    assert mc.ALLOWED_SITES == ("musinsa.com",)
    assert mc.DEFAULT_SITE == "MUSINSA.com"
    assert mc.is_allowed_site("MUSINSA.com") is True
    assert mc.is_allowed_site("musinsa.com") is True
    assert mc.is_allowed_site("ABCmart.a-rt.com") is False
    assert mc.is_allowed_site("") is False


def test_run_mapping_blocks_other_sites():
    result = mc.run_mapping(site_id="ABCmart.a-rt.com", excels={"AUC20": ["A > B"]})
    assert result.ok is False
    assert "musinsa.com" in result.errors[0]


def test_row_range_defaults_and_normalization():
    assert (mc.DEFAULT_ROW_FROM, mc.DEFAULT_ROW_TO) == (1, 5)
    assert mc.row_range() == (1, 5)
    assert mc.row_range("3", "7") == (3, 7)
    assert mc.row_range(9, 2) == (2, 9)      # 뒤집혀 있으면 바로잡는다
    assert mc.row_range("", "") == (1, 5)
    assert mc.row_range(0, -3) == (1, 5)


def test_slice_rows_is_inclusive_and_one_based():
    rows = list("ABCDEFG")
    assert mc.slice_rows(rows, 1, 5) == list("ABCDE")
    assert mc.slice_rows(rows, 2, 4) == list("BCD")
    assert mc.slice_rows(rows, 6, 99) == list("FG")
    assert mc.slice_rows(rows, 10, 12) == []


def test_unchecked_rows_are_processed(monkeypatch):
    """체크가 하나도 없어도 범위 안의 행을 처리한다 (요건 2026-08-22 15:03)."""
    seen: list[str] = []
    rows = [
        mc.RowInfo(index=i, ftid=str(800 + i), filter_name=f"g{i}", checked=False)
        for i in range(4)
    ]
    monkeypatch.setattr(mc, "list_rows", lambda page: rows)
    monkeypatch.setattr(mc, "select_site", lambda *a, **k: True)
    monkeypatch.setattr(mc, "click_search_filter", lambda *a, **k: True)
    monkeypatch.setattr(
        mc,
        "map_one_row",
        lambda page, row, excels, **k: seen.append(row.ftid)
        or {"ftid": row.ftid, "items": [{"ok": True}]},
    )

    class FakeP2:
        @staticmethod
        def connect_browser(pw):
            return None, type("P", (), {"goto": lambda self, *a, **k: None})()

    class FakePW:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setitem(sys.modules, "collect", FakeP2)
    monkeypatch.setitem(
        sys.modules, "playwright.sync_api", type("M", (), {"sync_playwright": lambda: FakePW()})
    )

    result = mc.run_mapping(
        site_id="MUSINSA.com", excels={"AUC20": AUCTION}, row_from=1, row_to=2
    )
    assert seen == ["800", "801"]
    assert result.rows == 2


class FramedRowsPage:
    """목록이 하위 프레임에 있는 화면."""

    def __init__(self, rows):
        self.inner = RowsPage(rows)
        self.frames = [self, self.inner]

    def evaluate(self, script, *args):
        if "location.href" in script:
            return {"url": "outer", "table": False, "rows": 0, "checkboxes": 0,
                    "mappingLinks": 0, "sample": []}
        return []


def test_list_rows_searches_frames():
    page = FramedRowsPage([{"index": 0, "ftid": "900", "filterName": "f", "checked": False}])
    rows = mc.list_rows(page)
    assert [r.ftid for r in rows] == ["900"]


def test_diagnose_list_logs_counts():
    page = RowsPage([{"index": 0, "ftid": "900", "filterName": "f", "checked": False}])
    logs: list[str] = []
    mc.diagnose_list(page, progress=logs.append)
    assert any("설정수정링크" in l for l in logs)
