"""필터명 해석·카테고리 탐색 순서 테스트 (요건 예시 그대로)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import matching as mt  # noqa: E402

EXCEL = [
    "패션의류잡화 > 남성 > 모자 > 버킷햇",
    "패션의류잡화 > 남성 > 모자 > 비니",
    "패션의류잡화 > 남성 > 모자 > 캡모자",
    "패션의류잡화 > 남성 > 소품 > 선글라스",
    "패션의류잡화 > 여성 > 모자 > 버킷햇",
    "의류잡화 > 잡화 > 안경테",
    "스포츠 > 등산 > 등산모자",
]


# ── 필터명 해석 ──────────────────────────────────────────────────


def test_parse_ignores_brand_and_site():
    p = mt.parse_filter_name("아름트리-무신사-남성-모자-버킷/사파리 햇")
    assert p.ignored == ["아름트리", "무신사"]
    assert p.top == "남성"
    assert p.mid == "모자"


def test_low_variants_example1():
    """버킷/사파리 햇 → 버킷햇 · 버킷 · 햇 · 사파리"""
    p = mt.parse_filter_name("아름트리-무신사-남성-모자-버킷/사파리 햇")
    for want in ("버킷햇", "버킷", "햇", "사파리"):
        assert want in p.lows, f"{want} 누락: {p.lows}"


def test_low_variants_example2():
    """바라클라바 → 바라클라바 · 바라 · 클라바"""
    p = mt.parse_filter_name("아름트리-무신사-남성-모자-바라클라바")
    for want in ("바라클라바", "바라", "클라바"):
        assert want in p.lows, f"{want} 누락: {p.lows}"


def test_low_variants_example3():
    """선글라스/안경테 → 선글라스 · 안경테"""
    p = mt.parse_filter_name("아름트리-무신사-남성-소품-선글라스/안경테")
    assert p.top == "남성" and p.mid == "소품"
    assert "선글라스" in p.lows and "안경테" in p.lows


def test_top_and_mid_fallbacks():
    p = mt.parse_filter_name("아름트리-무신사-남성-소품-선글라스/안경테")
    assert p.tops[0] == "남성"
    for extra in ("패션잡화", "의류잡화", "패션의류잡화"):
        assert extra in p.tops
    assert "잡화" in p.mids  # 소품 ↔ 잡화


def test_parse_without_prefix_keeps_all():
    p = mt.parse_filter_name("남성-모자")
    assert p.top == "남성" and p.mid == "모자"


# ── 탐색 순서 ────────────────────────────────────────────────────


def test_example1_picks_bucket_hat():
    cat, step = mt.find_category("아름트리-무신사-남성-모자-버킷/사파리 햇", EXCEL)
    assert cat == "패션의류잡화 > 남성 > 모자 > 버킷햇"
    assert step.startswith(("1)", "2-1)"))


def test_example3_picks_sunglasses():
    cat, _ = mt.find_category("아름트리-무신사-남성-소품-선글라스/안경테", EXCEL)
    assert cat == "패션의류잡화 > 남성 > 소품 > 선글라스"


def test_women_filter_does_not_take_men_path():
    cat, _ = mt.find_category("아름트리-무신사-여성-모자-버킷햇", EXCEL)
    assert cat == "패션의류잡화 > 여성 > 모자 > 버킷햇"


def test_step_2_2_mid_only_when_top_missing():
    """상위(남성)가 없는 자료 → 중위(모자)로 전체 재검색."""
    cats = ["스포츠 > 등산 > 등산모자", "생활 > 주방 > 컵"]
    cat, step = mt.find_category("아름트리-무신사-남성-모자-비니", cats)
    assert cat == "스포츠 > 등산 > 등산모자"
    assert "중위" in step


def test_step_2_3_low_only():
    """상위·중위 모두 없고 하위(안경테)만 있는 자료."""
    cats = ["잡화모음 > 안경테"]
    cat, step = mt.find_category("아름트리-무신사-남성-소품-선글라스/안경테", cats)
    assert cat == "잡화모음 > 안경테"
    assert "하위" in step


def test_step_2_4_generic_for_accessory():
    """어디에도 없으면 품목별 포괄 카테고리 (모자 → 의류잡화·패션의류잡화)."""
    cats = ["패션의류잡화 > 기타", "식품 > 과일"]
    cat, step = mt.find_category("아름트리-무신사-남성-모자-바라클라바", cats)
    assert cat == "패션의류잡화 > 기타"
    assert step.startswith("2-4)")


def test_step_2_4_generic_for_shoes():
    """중위(슈즈)·하위(스니커즈) 어디에도 없으면 신발 포괄 카테고리."""
    cats = ["신발잡화 > 기타", "식품 > 과일"]
    cat, step = mt.find_category("아름트리-무신사-남성-슈즈-스니커즈", cats)
    assert cat == "신발잡화 > 기타"
    assert step == "2-4) 포괄(신발)"


def test_mid_name_matching_precedes_generic():
    """중위(신발)가 '신발잡화' 에 걸리면 2-2 에서 끝난다 (2-4 로 가지 않음)."""
    cats = ["신발잡화 > 기타", "식품 > 과일"]
    cat, step = mt.find_category("아름트리-무신사-남성-신발-스니커즈", cats)
    assert cat == "신발잡화 > 기타"
    assert step.startswith("2-2)")


def test_no_match_returns_empty():
    cat, step = mt.find_category("아름트리-무신사-남성-모자-버킷햇", ["식품 > 과일 > 사과"])
    assert cat == ""
    assert step == "미검출"


def test_empty_excel():
    assert mt.find_category("아름트리-무신사-남성-모자-버킷햇", []) == ("", "자료 없음")


# ── 보조 ─────────────────────────────────────────────────────────


def test_level_hit_is_partial_and_space_insensitive():
    assert mt.level_hit("남성 잡화", "남성잡화") is True
    assert mt.level_hit("모자", "버킷햇") is False
    assert mt.level_hit("버킷햇", "버킷") is True


def test_kind_detection():
    assert mt.kind_of(mt.parse_filter_name("a-b-남성-모자-비니")) == "잡화"
    assert mt.kind_of(mt.parse_filter_name("a-b-남성-신발-운동화")) == "신발"
    assert mt.kind_of(mt.parse_filter_name("a-b-남성-의류-티셔츠")) == "의류"


def test_pick_best_prefers_more_specific():
    paths = ["패션의류잡화 > 남성", "패션의류잡화 > 남성 > 모자 > 버킷햇"]
    parsed = mt.parse_filter_name("아름트리-무신사-남성-모자-버킷햇")
    assert mt.pick_best(paths, parsed) == "패션의류잡화 > 남성 > 모자 > 버킷햇"
