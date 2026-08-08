"""P2(collect.py) stdout ↔ 보드 main/sub 그리드 프로토콜 (tk 불필요, 테스트 가능).

collect.py 는 화면에 보여야 하는 줄만 다음 마커로 표준출력에 보낸다:
  ##META##<field>##<value>       main 상단 고정 5항목(총건수·완료건·순번·수집필드·URL)
  ##MAIN##<seq>##<n>##<msg>      1~13단계 (main 그리드, 발생마다 새 seq)
  ##SUB##<seq>##<msg>            그 발생(seq)에 딸린 추가정보 (sub 그리드)
  ##SUBSHOT##<seq>##<path>##<label>   그 발생(seq)에 딸린 스크린샷

이 마커가 아닌 줄은 화면에 출력하지 않는다(요건: main엔 13단계만·
sub엔 그 추가정보만, 그 외 잡다한 로그는 안 보임).
"""

from __future__ import annotations

import re
import time

META_FIELDS: tuple[str, ...] = (
    "총건수",
    "완료건",
    "순번",
    "수집 필드",
    "카테고리 URL",
)

META_RE = re.compile(r"^##META##([^#]+)##(.*)$")
MAIN_RE = re.compile(r"^##MAIN##(\d+)##(\d+)##(.*)$")
SUB_RE = re.compile(r"^##SUB##(\d+)##(.*)$")
SUBSHOT_RE = re.compile(r"^##SUBSHOT##(\d+)##(.*?)##(.*)$")

# 단계번호 → 색상태그 (1=로그인, 2·13=초기화, 9~11=저장, 12=완료, 그 외=normal)
STEP_TAG: dict[int, str] = {
    1: "login",
    2: "init",
    13: "init",
    9: "save",
    10: "save",
    11: "save",
    12: "done",
}


def strip_timestamp(text: str) -> tuple[str, str]:
    """"[HH:MM:SS] 또는 [HH:MM:SS~HH:MM:SS] 나머지" → (시각, 나머지).

    접두 없으면 현재시각을 채운다.
    """
    m = re.match(
        r"^\[(\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)\]\s*(.*)$",
        text or "",
    )
    if m:
        return m.group(1), m.group(2)
    return time.strftime("%H:%M:%S"), (text or "")


def sub_time_range(start: str, end: str | None) -> str:
    """sub 시각 — 현단계 MAIN 진입~다음 MAIN 진입."""
    if not start:
        return end or time.strftime("%H:%M:%S")
    if end and end != start:
        return f"{start}~{end}"
    return start


def parse_line(text: str) -> tuple | None:
    """마커 있는 줄만 해석. 없으면 None(화면에 출력 안 함).

    반환:
      ("meta", field, value)
      ("main", seq, n, msg)
      ("sub", seq, msg)
      ("subshot", seq, path, label)
    """
    raw = text or ""
    m = META_RE.match(raw)
    if m:
        return ("meta", m.group(1), m.group(2))
    m = MAIN_RE.match(raw)
    if m:
        return ("main", int(m.group(1)), int(m.group(2)), m.group(3))
    m = SUB_RE.match(raw)
    if m:
        return ("sub", int(m.group(1)), m.group(2))
    m = SUBSHOT_RE.match(raw)
    if m:
        return ("subshot", int(m.group(1)), m.group(2), m.group(3))
    return None


def step_tag(n: int) -> str:
    return STEP_TAG.get(n, "normal")
