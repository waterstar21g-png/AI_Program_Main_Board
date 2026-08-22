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

# 최근접 판단 보조 — 성별 · 소재 · 용도/활용
GENDER_WORDS = {
    "남성": ("남성", "남자", "맨즈", "men"),
    "여성": ("여성", "여자", "우먼", "women"),
    "공용": ("공용", "유니섹스", "남녀"),
    "아동": ("아동", "키즈", "주니어", "베이비"),
}
MATERIAL_WORDS = (
    "가죽", "레더", "니트", "데님", "면", "코튼", "울", "린넨", "퍼", "메쉬",
    "고어텍스", "나일론", "폴리", "스웨이드", "캔버스", "실리콘", "메탈",
)
# 품목 동의어 — 필터명 표현과 마켓 카테고리 표현의 차이를 메운다
ITEM_SYNONYMS: dict[str, tuple[str, ...]] = {
    "비니": ("비니", "니트모자", "털모자", "방한모"),
    "바라클라바": ("바라클라바", "방한모", "발라클라바", "마스크모자"),
    "버킷햇": ("버킷햇", "벙거지", "버킷", "사파리햇"),
    "캡모자": ("캡모자", "볼캡", "야구모자", "캡"),
    "선글라스": ("선글라스", "썬글라스", "아이웨어"),
    "안경테": ("안경테", "안경", "아이웨어"),
    "스니커즈": ("스니커즈", "운동화", "캔버스화"),
    "슬리퍼": ("슬리퍼", "샌들", "쪼리"),
    "가방": ("가방", "백팩", "크로스백", "토트백"),
    "지갑": ("지갑", "카드지갑", "머니클립"),
    "목도리": ("목도리", "머플러", "스카프"),
    "장갑": ("장갑", "글러브", "핸드워머"),
    "양말": ("양말", "삭스"),
    "벨트": ("벨트", "허리띠"),
    "니트": ("니트", "스웨터", "가디건"),
    "티셔츠": ("티셔츠", "반팔", "긴팔", "티"),
    "바지": ("바지", "팬츠", "슬랙스", "청바지", "데님"),
    "코트": ("코트", "아우터", "자켓", "재킷", "점퍼"),
}

PURPOSE_WORDS = (
    "등산", "캠핑", "스포츠", "러닝", "골프", "수영", "요가", "낚시", "자전거",
    "웨딩", "정장", "캐주얼", "홈웨어", "방한", "여름", "겨울", "레인", "트레킹",
)


def normalize(text: str) -> str:
    return "".join(str(text or "").split()).lower()


def split_levels(path: str) -> list[str]:
    return [p.strip() for p in str(path or "").split(">") if p.strip()]


def leaf_of(path: str) -> str:
    """경로의 마지막 단계."""
    levels = split_levels(path)
    return levels[-1] if levels else ""


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


def _bigrams(text: str) -> set[str]:
    s = normalize(text)
    return {s[i : i + 2] for i in range(len(s) - 1)} if len(s) > 1 else {s} if s else set()


def _overlap(a: str, b: str) -> float:
    ga, gb = _bigrams(a), _bigrams(b)
    if not ga or not gb:
        return 0.0
    return len(ga & gb) / max(len(ga), len(gb))


def _words_in(text: str, words: Iterable[str]) -> set[str]:
    low = normalize(text)
    return {w for w in words if normalize(w) in low}


def gender_of(text: str) -> str:
    low = normalize(text)
    for gender, words in GENDER_WORDS.items():
        if any(normalize(w) in low for w in words):
            return gender
    return ""


def expand_synonyms(names: Sequence[str]) -> list[str]:
    """품목 동의어까지 넓힌 후보 이름."""
    out: list[str] = []
    for name in names:
        n = str(name or "").strip()
        if not n or n in out:
            continue
        out.append(n)
        low = normalize(n)
        for key, words in ITEM_SYNONYMS.items():
            if normalize(key) in low or any(normalize(w) in low for w in words):
                for w in words:
                    if w not in out:
                        out.append(w)
    return out


def nearest_score(parsed: "ParsedFilter", path: str) -> float:
    """소재·용도·성별·활용·동의어를 종합한 근접도 (0~1)."""
    leaf = leaf_of(path)
    names = expand_synonyms([n for n in (parsed.mid, *parsed.lows) if n])

    # 이름 유사도 — 하위·중위(동의어 포함) 조각과 리프/경로의 글자 겹침
    name_hit = 0.0
    for name in names:
        if level_hit(leaf, name):
            name_hit = max(name_hit, 0.95)
        name_hit = max(name_hit, _overlap(name, leaf), 0.6 * _overlap(name, path))

    # 성별
    gender = gender_of(parsed.raw)
    gender_hit = 0.0
    if gender:
        pg = gender_of(path)
        if pg == gender:
            gender_hit = 1.0
        elif pg:
            gender_hit = -0.5  # 다른 성별이면 감점

    # 소재 · 용도/활용
    mats = _words_in(parsed.raw, MATERIAL_WORDS)
    purposes = _words_in(parsed.raw, PURPOSE_WORDS)
    attr_hit = 0.0
    if mats:
        attr_hit += 0.5 * len(_words_in(path, mats)) / len(mats)
    if purposes:
        attr_hit += 0.5 * len(_words_in(path, purposes)) / len(purposes)

    # 포괄 카테고리 보너스 (품목 성격에 맞는 곳)
    generic_hit = 0.0
    for generic in GENERIC_BY_KIND.get(kind_of(parsed), ()):
        if path_hit(path, generic):
            generic_hit = 0.3
            break

    score = 0.55 * name_hit + 0.2 * max(gender_hit, 0.0) + 0.15 * attr_hit + generic_hit
    if gender_hit < 0:
        score += 0.2 * gender_hit  # 성별 불일치 감점
    return max(0.0, min(1.0, score))


def nearest_category(name: str, paths: Sequence[str]) -> tuple[str, float]:
    """규칙으로 못 찾았을 때 — **반드시 하나**를 고른다 (가장 가까운 것)."""
    parsed = parse_filter_name(name)
    best, best_score = "", -1.0
    for path in paths:
        if not str(path or "").strip():
            continue
        score = nearest_score(parsed, path)
        if score > best_score or (score == best_score and best and len(path) < len(best)):
            best, best_score = path, score
    return best, max(best_score, 0.0)


def is_from(paths: Sequence[str], category: str) -> bool:
    """고른 카테고리가 엑셀 목록 안의 값인지."""
    if not category:
        return False
    want = normalize(category)
    return any(normalize(p) == want for p in paths)


def ensure_from(paths: Sequence[str], category: str, name: str = "") -> str:
    """엑셀 범위 밖이면 목록 안에서 가장 가까운 것으로 되돌린다."""
    if is_from(paths, category):
        return category
    fallback, _score = nearest_category(name or category, paths)
    return fallback


def find_category(
    name: str,
    paths: Sequence[str],
    *,
    exclude: Sequence[str] = (),
    force: bool = True,
) -> tuple[str, str]:
    """최적 카테고리와 그 근거 단계.

    `exclude` 는 이미 시도한 카테고리. `force=True`(기본) 면 규칙으로 못 찾아도
    소재·용도·성별·활용을 종합해 **가장 가까운 하나를 반드시** 고른다.
    """
    parsed = parse_filter_name(name)
    skip = {normalize(e) for e in (exclude or []) if str(e or "").strip()}
    paths = [
        p for p in paths if str(p or "").strip() and normalize(p) not in skip
    ]
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

    if force:
        nearest, score = nearest_category(name, paths)
        if nearest:
            return nearest, f"3) 최근접 지정 ({score:.2f})"
    return "", "미검출"
