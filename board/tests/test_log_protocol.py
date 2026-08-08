"""main/sub 그리드 프로토콜 파싱 단위테스트 (tk 불필요)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from log_protocol import (  # noqa: E402
    META_FIELDS,
    format_meta_line,
    parse_line,
    step_tag,
    strip_timestamp,
    sub_time_range,
)


def test_strip_timestamp_extracts_prefix():
    t, rest = strip_timestamp("[01:02:03] ##MAIN##1##2##초기화")
    assert t == "01:02:03"
    assert rest == "##MAIN##1##2##초기화"


def test_strip_timestamp_without_prefix_still_returns_something():
    t, rest = strip_timestamp("no timestamp here")
    assert len(t) == 8 and t.count(":") == 2
    assert rest == "no timestamp here"


def test_parse_main_line():
    parsed = parse_line("##MAIN##7##3##상품수집 URL정보 입력")
    assert parsed == ("main", 7, 3, "상품수집 URL정보 입력")


def test_parse_sub_line():
    parsed = parse_line("##SUB##7##최종 카테고리 URL주소: https://example.com/a")
    assert parsed == ("sub", 7, "최종 카테고리 URL주소: https://example.com/a")


def test_parse_subshot_line():
    parsed = parse_line(r"##SUBSHOT##7##C:\shots\01_i1_r1_init.png##초기화 화면")
    assert parsed == ("subshot", 7, r"C:\shots\01_i1_r1_init.png", "초기화 화면")


def test_parse_unrecognized_line_returns_none():
    """마커 없는 줄은 화면에 출력하지 않음 — None 이어야 함."""
    assert parse_line("아무 마커 없는 잡다한 로그") is None
    assert parse_line("") is None
    assert parse_line("[경고] 뭔가 실패") is None


def test_step_tag_mapping():
    assert step_tag(0) == "meta"  # 엑셀 5필드 한 줄
    assert step_tag(1) == "login"
    assert step_tag(2) == "init"
    assert step_tag(13) == "init"
    assert step_tag(9) == "save"
    assert step_tag(10) == "save"
    assert step_tag(11) == "save"
    assert step_tag(12) == "done"
    assert step_tag(3) == "normal"
    assert step_tag(7) == "normal"


def test_parse_meta_line():
    parsed = parse_line("##META##총건수##42")
    assert parsed == ("meta", "총건수", "42")


def test_meta_fields_order():
    assert len(META_FIELDS) == 5
    assert "총건수" in META_FIELDS
    assert "카테고리 URL" in META_FIELDS


def test_format_meta_line_one_row():
    line = format_meta_line(
        {
            "총건수": "2",
            "완료건": "0",
            "순번": "2",
            "수집 필드": "MEN 스니커즈",
            "카테고리 URL": "https://example.com/cat",
        }
    )
    assert "총건수 2" in line
    assert "완료건 0" in line
    assert "순번 2" in line
    assert "MEN 스니커즈" in line
    assert "https://example.com/cat" in line
    assert line.count(" | ") == 4


def test_strip_timestamp_range():
    t, rest = strip_timestamp("[10:20:30~10:21:05] ##SUB##3##상세")
    assert t == "10:20:30~10:21:05"
    assert rest.startswith("##SUB##")


def test_sub_time_range():
    assert sub_time_range("10:20:30", "10:21:05") == "10:20:30~10:21:05"
    assert sub_time_range("10:20:30", "10:20:30") == "10:20:30"
    assert len(sub_time_range("", None)) == 8


def test_full_pipeline_timestamp_then_parse():
    """실제 collect.py 출력 형태 전체 파이프라인."""
    raw = "[10:20:30] ##MAIN##3##9##수집 상품 DB저장하기 시작 : 하단 '저장하기' 클릭"
    t, rest = strip_timestamp(raw)
    assert t == "10:20:30"
    parsed = parse_line(rest)
    assert parsed[0] == "main"
    assert parsed[2] == 9
    assert "저장하기" in parsed[3]


if __name__ == "__main__":
    failed = 0
    tests = [
        ("strip_ts_prefix", test_strip_timestamp_extracts_prefix),
        ("strip_ts_none", test_strip_timestamp_without_prefix_still_returns_something),
        ("parse_main", test_parse_main_line),
        ("parse_sub", test_parse_sub_line),
        ("parse_subshot", test_parse_subshot_line),
        ("parse_meta", test_parse_meta_line),
        ("format_meta_line", test_format_meta_line_one_row),
        ("meta_fields", test_meta_fields_order),
        ("strip_ts_range", test_strip_timestamp_range),
        ("sub_time_range", test_sub_time_range),
        ("parse_unrecognized_none", test_parse_unrecognized_line_returns_none),
        ("step_tag_map", test_step_tag_mapping),
        ("full_pipeline", test_full_pipeline_timestamp_then_parse),
    ]
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as e:
            failed += 1
            print(f"FAIL {name}: {type(e).__name__}: {e}")
    raise SystemExit(failed)
