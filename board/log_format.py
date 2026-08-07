"""실행로그 1~5단 들여쓰기·색상 분류 (tk 없이 단위테스트 가능).

ttk.Treeview 는 일반 공백 들여쓰기를 거의 안 보여 주므로
전각 공백(　) + 단 번호 접두로 계층을 강제 표시한다.
"""

from __future__ import annotations

import re

# 전각 공백 — Windows Treeview 에서도 폭이 눈에 보임
_FW = "\u3000"
_LOG_INDENT = ("", _FW, _FW * 2, _FW * 3, _FW * 4)
# 메시지 앞에 단을 다시 박아, 단 열을 안 봐도 들여쓰기·계층이 보이게
_LOG_MARK = ("①", "②", "③", "④", "⑤")


def log_depth(text: str) -> int:
    """로그 한 줄의 계층 깊이 1~5."""
    raw = text or ""
    lead = len(raw) - len(raw.lstrip(" \t\u3000"))
    s = raw.strip()
    if not s:
        return 5

    # 1단: 입력 경계·전체 요약
    if (
        s.startswith("---")
        or s.startswith("====")
        or s.startswith("[입력목록]")
        or s.startswith("처리대상")
        or s.startswith("수집 시작")
        or s.startswith("수집 종료")
        or re.match(r"^\[OK\]|^\[FAIL\]|^\[중단", s)
    ):
        return 1

    # 2단: 0~4 주요 단계 / 시도 헤더
    if re.match(
        r"^(0\.|1\.|2-A\.|2-B\.|2\.|3\.|4\.|"
        r"2-A\b|2-B\b)",
        s,
    ):
        return 2
    if re.match(r"^> 시도\b", s):
        return 2
    if s.startswith("사용자 로그인") or "로그인창에서 직접" in s:
        return 2
    if "솔루션" in s and ("설정" in s or "URL" in s or "KEY" in s):
        return 2

    # 3단: 핵심 액션(버튼·별표)
    if "[버튼1]" in s or "[버튼2]" in s or "★★" in s or s.startswith("★"):
        return 3
    if "저장하기" in s and ("클릭" in s or "서버" in s):
        return 3

    # 5단: 진단·부가
    if "[진단]" in s or s.startswith("· ") or lead >= 4:
        return 5

    # 4단: 경고·세부·샷·기본 들여쓰기
    if (
        "[경고]" in s
        or "[정보]" in s
        or "[확인]" in s
        or "[망고" in s
        or "[dialog]" in s
        or "[샷]" in s
        or "[샷폴더]" in s
        or "[갤러리]" in s
        or lead >= 2
    ):
        return 4

    return 3


def log_color_tag(text: str, depth: int) -> str:
    """상태 우선 색상 태그 (오류>중단>경고>성공>저장>버튼>단)."""
    s = text or ""
    low = s.lower()
    if (
        "[FAIL]" in s
        or "오류" in s
        or "실패" in s
        or "error" in low
        or "미확인" in s
        or "찾지 못" in s
    ):
        return "err"
    if "중단" in s or "수집 종료" in s:
        return "stop"
    if "[경고]" in s or "경고" in s:
        return "warn"
    if (
        "[OK]" in s
        or "성공" in s
        or "완료 확인" in s
        or "수집건수 OK" in s
        or "서버 최종 갱신 완료" in s
    ):
        return "ok"
    if "[버튼2]" in s or (
        "저장하기" in s and ("하단" in s or "서버" in s or "클릭" in s)
    ):
        return "save"
    if "[버튼1]" in s or "모두저장" in s:
        return "btn"
    return f"d{max(1, min(5, depth))}"


def format_log_display(text: str) -> tuple[int, str, str, str]:
    """(depth, stage_label, display_message, color_tag).

    display_message 예:
      ① 수집 시작 ...
      　② 0. 초기화 ...
      　　③ ★ [버튼2] ...
    """
    raw = text or ""
    stripped = raw.strip()
    # strip 전에 lead 를 쓰도록 원문을 depth 에 전달
    depth = max(1, min(5, log_depth(raw)))
    indent = _LOG_INDENT[depth - 1]
    mark = _LOG_MARK[depth - 1]
    display = f"{indent}{mark} {stripped}"
    tag = log_color_tag(stripped, depth)
    return depth, f"{depth}단", display, tag
