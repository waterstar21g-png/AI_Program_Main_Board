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


class FakePage:
    def __init__(self, select=None, scan_result=None):
        self._select = select
        self._scan = scan_result
        self.locators: list[str] = []

    def locator(self, selector):
        self.locators.append(selector)
        if self._select is not None and uco.TRANSLATE_SELECT_NAME in selector:
            return self._select
        return MissingLocator()

    def evaluate(self, script, *args):
        return self._scan


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


# ── 실행 인자 검증 ───────────────────────────────────────────────


def test_run_requires_option():
    result = uco.run_update_collect_option("   ")
    assert result.ok is False
    assert "선택" in result.errors[0]
