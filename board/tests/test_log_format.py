"""실행로그 1~5단 들여쓰기 포맷 단위테스트 (tk 불필요)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from log_format import format_log_display, log_depth  # noqa: E402

FW = "\u3000"


def test_depth_levels():
    assert log_depth("====================") == 1
    assert log_depth("수집 시작 (검증): x.xlsx") == 1
    assert log_depth("[OK] 엑셀1행 성공") == 1
    assert log_depth("0. 초기화 : 상품데이터수집 -> 대량데이터수집") == 2
    assert log_depth("더망고 로그인창에서 직접 로그인하세요.") == 2
    assert log_depth("2-B. ★ [버튼2] 모달 하단 '저장하기' 클릭") == 2
    assert log_depth("★★★ 최종 팝업화면이 닫힐 때까지 대기") == 3
    assert log_depth("  [샷] 01. 확장프로그램") == 4
    assert log_depth("  [진단] foo") == 5


def test_indent_visible_with_fullwidth():
    samples = [
        ("수집 시작: a.xlsx", 1, 0),
        ("0. 초기화 : 상품데이터수집", 2, 1),
        ("★ [버튼2] 저장하기 클릭", 3, 2),
        ("  [샷] 03. 로그인 대기", 4, 3),
        ("  [진단] bar", 5, 4),
    ]
    for text, want_depth, want_fw in samples:
        depth, stage, display, _tag = format_log_display(text)
        assert depth == want_depth, text
        assert stage == f"{want_depth}단", text
        # 전각 들여쓰기 개수
        assert display.startswith(FW * want_fw), (text, display)
        # 단 번호 원문자
        marks = ("①", "②", "③", "④", "⑤")
        assert marks[want_depth - 1] in display, display
        # 내용이 왼쪽 끝에 붙지 않음 (2단 이상)
        if want_depth >= 2:
            assert not display[0].isalnum(), display


def test_screenshot_style_lines_not_flush():
    """사용자 스크린샷에 나온 유형 — 평평하게 나오면 실패."""
    lines = [
        "====================",
        "더망고 로그인창에서 직접 로그인하세요.",
        "사용자 로그인 대기 중... (브라우저에서 로그인 후 이 창이 닫힐 때까지 대기)",
        "[샷] 03. 로그인 대기 — 02_i0_r0_login_wait.png",
        "0. 초기화 : 상품데이터수집 -> 대량데이터수집",
    ]
    displays = [format_log_display(s)[2] for s in lines]
    # 1단과 2단+ 의 시작 위치가 달라야 함
    d1 = displays[0]
    d2 = displays[1]
    assert d1.startswith("①"), d1
    assert d2.startswith(FW + "②"), d2
    assert format_log_display(lines[3])[0] == 4
    assert format_log_display(lines[3])[2].startswith(FW * 3 + "④")


if __name__ == "__main__":
    failed = 0
    for name, fn in [
        ("depth", test_depth_levels),
        ("indent", test_indent_visible_with_fullwidth),
        ("screenshot_style", test_screenshot_style_lines_not_flush),
    ]:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as e:
            failed += 1
            print(f"FAIL {name}: {type(e).__name__}: {e}")
    raise SystemExit(failed)
