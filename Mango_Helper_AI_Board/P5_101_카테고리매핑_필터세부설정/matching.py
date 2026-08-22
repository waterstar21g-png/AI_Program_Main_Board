"""
필터명 → 최적 카테고리 찾기 (요건 2026-08-22 14:26 명세 그대로).

필터명 해석
  `아름트리-무신사-남성-모자-버킷/사파리 햇`
    → 앞 2조각(브랜드-사이트)은 **무시**
    → 상위=남성 · 중위=모자 · 하위=[버킷햇, 버킷, 햇, 사파리]

찾는 순서
  1) 망고 단계수 == 엑셀 단계수  → 상위 → 중위 → 하위 로 단계별 대조
  2) 단계수가 다르면
     2-1) 상위가 있는 목록에서 (없으면 중위 목록에서)
            → 중위 일치 목록으로 좁히고 (없으면 하위로)
              → 하위 일치 목록에서 고른다
     2-2) 못 찾으면 중위 이름으로 전체 재검색
     2-3) 못 찾으면 하위 이름으로 전체 재검색
     2-4) 그래도 없으면 품목별 포괄 카테고리에서 찾는다
          의류 → 패션잡화 · 의류잡화 · 패션의류잡화
          신발 → 신발잡화 · 의류잡화 · 패션의류잡화
          선글라스/안경테/모자/햇/손수건/비니 → 의류잡화 · 패션의류잡화
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable, Sequence

# 필터명 앞부분(브랜드-사이트)은 무시
IGNORED_LEAD_SEGMENTS = 2

# 상위 카테고리 보조 후보 (요건 예시3)
TOP_FALLBACKS = ("패션잡화", "의류잡화", "패션의류잡화")

# 중위 동의어
MID_SYNONYMS: dict[str, tuple[str, ...]] = {
    "소품": ("소품", "잡화"),
    "잡화": ("잡화", "소품"),
    "모자": ("모자",),
}

# 품목별 포괄 카테고리 (2-4)
GENERIC_BY_KIND: dict[str, tuple[str, ...]] = {
    "의류": ("패션잡화", "의류잡화", "패션의류잡화"),
    "신발": ("신발잡화", "의류잡화", "패션의류잡화"),
    "잡화": ("의류잡화", "패션의류잡화"),
}
CLOTHING_WORDS = ("의류", "티셔츠", "셔츠", "바지", "팬츠", "아우터", "코트", "자켓", "재킷", "니트")
SHOE_WORDS = ("신발", "슈즈", "운동화", "스니커즈", "구두", "부츠", "샌들", "슬리퍼")
ACCESSORY_WORDS = ("선글라스", "안경테", "모자", "햇", "손수건", "비니", "캡", "버킷", "바라클라바")

_SPLIT = re.compile(r"[\s/·,()\[\]|]+")


def normalize(text: str) -> str:
    return "".join(str(text or "").split()).lower()


def split_levels(path: str) -> list[str]:
    return [p.strip() for p in str(path or "").split(">") if p.strip()]


def _halves(word: str) -> list[str]:
    """`바라클라바` → [`바라`, `클라바`] (4자 이상일 때만)."""
    w = word.strip()
    if len(w) < 4:
        return []
    mid = len(w) // 2
    return [w[:mid], w[mid:]]


def low_variants(raw: str) -> list[str]:
    """하위 조각 전개 — 원문 · 붙인말 · 각 토큰 · 반쪽."""
    raw = str(raw or "").strip()
    if not raw:
        return []
    tokens = [t for t in _SPLIT.split(raw) if t]
    out: list[str] = []

    def add(v: str) -> None:
        v = v.strip()
        if v and v not in out:
            out.append(v)

    if len(tokens) > 1:
        add(tokens[0] + tokens[-1])  # 버킷/사파리 햇 → 버킷햇
    add(raw.replace(" ", ""))
    for tok in tokens:
        add(tok)
    for tok in list(tokens) or [raw]:
        for half in _halves(tok):
            add(half)
    return out


@dataclass
class ParsedFilter:
    raw: str
    top: str = ""
    mid: str = ""
    lows: list[str] = field(default_factory=list)
    ignored: list[str] = field(default_factory=list)

    @property
    def tops(self) -> list[str]:
        out = [self.top] if self.top else []
        out += [t for t in TOP_FALLBACKS if t not in out]
        return out

    @property
    def mids(self) -> list[str]:
        base = MID_SYNONYMS.get(self.mid, (self.mid,) if self.mid else ())
        return [m for m in base if m]

    @property
    def levels(self) -> int:
        return len([v for v in (self.top, self.mid, self.lows[0] if self.lows else "") if v])


def parse_filter_name(name: str) -> ParsedFilter:
    """`아름트리-무신사-남성-모자-버킷/사파리 햇` → 상위·중위·하위."""
    parts = [p.strip() for p in str(name or "").split("-") if p.strip()]
    ignored = parts[:IGNORED_LEAD_SEGMENTS]
    rest = parts[IGNORED_LEAD_SEGMENTS:]
    if not rest:  # 앞부분만 있는 이름이면 통째로 사용
        rest, ignored = parts, []

    top = rest[0] if len(rest) > 0 else ""
    mid = rest[1] if len(rest) > 1 else ""
    low_raw = "-".join(rest[2:]) if len(rest) > 2 else ""
    return ParsedFilter(
        raw=str(name or ""),
        top=top,
        mid=mid,
        lows=low_variants(low_raw),
        ignored=ignored,
    )


# ── 대조 ─────────────────────────────────────────────────────────


def level_hit(level: str, name: str) -> bool:
    """한 단계 이름이 주어진 이름과 같거나 포함하는가."""
    a, b = normalize(level), normalize(name)
    if not a or not b:
        return False
    return a == b or b in a or a in b


def path_hit(path: str, name: str) -> bool:
    return any(level_hit(lv, name) for lv in split_levels(path))


def filter_paths(paths: Iterable[str], names: Sequence[str]) -> list[str]:
    """names 중 하나라도 걸리는 경로만. 이름이 없으면 **아무것도** 고르지 않는다."""
    names = [n for n in (names or []) if str(n or "").strip()]
    if not names:
        return []
    return [p for p in paths if any(path_hit(p, n) for n in names)]


def specificity(path: str, parsed: ParsedFilter) -> tuple[int, int]:
    """정렬 기준 — (일치한 조각 수, 경로 짧은 순)."""
    hits = 0
    for name in [parsed.top, parsed.mid, *parsed.lows]:
        if name and path_hit(path, name):
            hits += 1
    return (hits, -len(path))


def pick_best(paths: Sequence[str], parsed: ParsedFilter) -> str:
    if not paths:
        return ""
    return sorted(paths, key=lambda p: specificity(p, parsed), reverse=True)[0]


def kind_of(parsed: ParsedFilter) -> str:
    """품목 구분 — 포괄 카테고리 선택용."""
    text = normalize(parsed.raw)
    if any(w in text for w in ACCESSORY_WORDS):
        return "잡화"
    if any(w in text for w in SHOE_WORDS):
        return "신발"
    if any(w in text for w in CLOTHING_WORDS):
        return "의류"
    return "잡화"


def match_by_levels(paths: Sequence[str], parsed: ParsedFilter) -> str:
    """1) 단계수가 같을 때 — 상위·중위·하위를 단계 순서대로 대조."""
    want = [parsed.top, parsed.mid]
    same_depth = [p for p in paths if len(split_levels(p)) == parsed.levels]
    hits: list[str] = []
    for path in same_depth:
        levels = split_levels(path)
        ok = all(
            (not name) or (i < len(levels) and level_hit(levels[i], name))
            for i, name in enumerate(want)
        )
        if not ok:
            continue
        if parsed.lows:
            last = levels[-1]
            if not any(level_hit(last, low) for low in parsed.lows):
                continue
        hits.append(path)
    return pick_best(hits, parsed)


def find_category(name: str, paths: Sequence[str]) -> tuple[str, str]:
    """최적 카테고리와 그 근거 단계를 돌려준다."""
    parsed = parse_filter_name(name)
    paths = [p for p in paths if str(p or "").strip()]
    if not paths:
        return "", "자료 없음"

    # 1) 단계수 동일 — 상위 → 중위 → 하위 순서 대조
    found = match_by_levels(paths, parsed)
    if found:
        return found, "1) 단계 일치"

    # 2-1) 상위(없으면 중위) → 중위(없으면 하위) → 하위
    scope = filter_paths(paths, parsed.tops)
    step = "2-1) 상위"
    if not scope:
        scope = filter_paths(paths, parsed.mids)
        step = "2-1) 중위(상위 없음)"
    if scope:
        narrowed = filter_paths(scope, parsed.mids)
        if narrowed:
            step += " → 중위"
        else:
            narrowed = filter_paths(scope, parsed.lows)
            if narrowed:
                step += " → 하위(중위 없음)"
        if narrowed:
            low_hits = filter_paths(narrowed, parsed.lows)
            if low_hits:
                return pick_best(low_hits, parsed), step + " → 하위"
            if not parsed.lows:
                return pick_best(narrowed, parsed), step

    # 2-2) 중위 이름으로 전체 재검색
    mid_hits = filter_paths(paths, parsed.mids)
    if mid_hits:
        low_hits = filter_paths(mid_hits, parsed.lows)
        if low_hits:
            return pick_best(low_hits, parsed), "2-2) 중위 전체 → 하위"
        return pick_best(mid_hits, parsed), "2-2) 중위 전체"

    # 2-3) 하위 이름으로 전체 재검색
    low_hits = filter_paths(paths, parsed.lows)
    if low_hits:
        return pick_best(low_hits, parsed), "2-3) 하위 전체"

    # 2-4) 품목별 포괄 카테고리
    kind = kind_of(parsed)
    generic = filter_paths(paths, GENERIC_BY_KIND.get(kind, ()))
    if generic:
        narrowed = filter_paths(generic, parsed.lows) or filter_paths(generic, parsed.mids)
        target = narrowed or generic
        return pick_best(target, parsed), f"2-4) 포괄({kind})"

    return "", "미검출"
