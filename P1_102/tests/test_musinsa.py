"""P1_102 — 무신사(musinsa.com) 카테고리 메뉴 지원 단위테스트.

★요건: 사이트 URL이 musinsa.com 이면 카테고리 메뉴 화면(성별 탭·좌측 1depth·
우측 2/3depth 버튼)만 인식해서 상위/중위/하위 카테고리명과 상품수집필터 URL을
만든다. 실제 DOM 구조(2026-08-19 확인)를 그대로 본뜬 조각 HTML로 검증한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    MUSINSA_EXCLUDED_LOW_LABELS,
    MUSINSA_GENDER_CODE,
    crawl_site,
    is_musinsa_platform,
    parse_musinsa_menu_tree,
    resolve_musinsa_category_url,
)

# 좌측 1depth 목록 — 실제 스크린샷과 동일하게 "뷰티"·"신발"만 후보로 노출
_LEFT_HTML = """
<p data-section-name="catemenu_left" data-button-id="1depth_cate" data-category-id="104" data-category-name="뷰티">뷰티</p>
<p data-section-name="catemenu_left" data-button-id="1depth_cate" data-category-id="103" data-category-name="신발">신발</p>
"""

# 우측 — 뷰티: 2depth 단순 목록 + 신상품 보기/전체 보기(제외 대상)
_RIGHT_BEAUTY_HTML = """
<a href="https://www.musinsa.com/category/104?sortCode=NEW" data-section-name="catemenu_right"
   data-button-id="1depth_new" data-category-name="뷰티|신상">신상품 보기</a>
<a href="https://www.musinsa.com/category/104" data-section-name="catemenu_right"
   data-button-id="enter_cateshop" data-category-name="뷰티|전체보기">전체 보기</a>
<a href="https://www.musinsa.com/category/104001" data-section-name="catemenu_right"
   data-button-id="2depth_cate" data-category-name="뷰티|스킨케어">스킨케어</a>
<a href="https://www.musinsa.com/category/104013" data-section-name="catemenu_right"
   data-button-id="2depth_cate" data-category-name="뷰티|마스크팩">마스크팩</a>
"""

# 우측 — 신발: 3depth(품목별/인기 라인업 두 그룹으로 나뉨)
_RIGHT_SHOES_HTML = """
<a href="https://www.musinsa.com/category/103004?separatorId=9" data-section-name="catemenu_right"
   data-button-id="3depth_cate" data-category-name="신발|품목별|스니커즈">스니커즈</a>
<a href="https://www.musinsa.com/category/103001?separatorId=9" data-section-name="catemenu_right"
   data-button-id="3depth_cate" data-category-name="신발|품목별|구두">구두</a>
<a href="https://www.musinsa.com/category/103?brandLineUp=405144" data-section-name="catemenu_right"
   data-button-id="3depth_cate" data-category-name="신발|인기 라인업|나이키 에어포스 1">나이키 에어포스 1</a>
"""

# 좌측 목록에 없는 "MUSINSA"(상단 서비스탭) 이 우측에 잘못 섞여 있어도 인식하지 않는지 검증용
_RIGHT_UNKNOWN_MID_HTML = """
<a href="https://www.musinsa.com/category/999999" data-section-name="catemenu_right"
   data-button-id="2depth_cate" data-category-name="MUSINSA|테스트항목">테스트항목</a>
"""


def _full_menu_html(right_extra: str = "") -> str:
    return f"""
    <html><body>
    <span data-section-name="gender_tab" data-button-name="전체">전체</span>
    <span data-section-name="gender_tab" data-button-name="남성">남성</span>
    <span data-section-name="gender_tab" data-button-name="여성">여성</span>
    {_LEFT_HTML}
    {_RIGHT_BEAUTY_HTML}
    {_RIGHT_SHOES_HTML}
    {right_extra}
    </body></html>
    """


def test_is_musinsa_platform():
    assert is_musinsa_platform("https://www.musinsa.com/menu/category")
    assert not is_musinsa_platform("https://abcmart.a-rt.com/?track=W0009")


def test_gender_code_mapping():
    assert MUSINSA_GENDER_CODE["남성"] == "M"
    assert MUSINSA_GENDER_CODE["여성"] == "F"
    assert MUSINSA_GENDER_CODE["전체"] == "A"
    assert MUSINSA_GENDER_CODE["MEN"] == "M"
    assert MUSINSA_GENDER_CODE["WOMEN"] == "F"


def test_parse_menu_tree_mid_candidates_scoped_to_left_panel():
    """★요건(매우 중요): 좌측 목록(스크린샷)에 있는 것만 중위 후보로 인식한다."""
    mid_names, _leaves = parse_musinsa_menu_tree(_full_menu_html(), "남성")
    assert mid_names == {"뷰티", "신발"}


def test_parse_menu_tree_excludes_new_and_all_buttons():
    """★요건: "신상품 보기"·"전체 보기" 버튼은 하위 카테고리명에서 제외한다."""
    _mid_names, leaves = parse_musinsa_menu_tree(_full_menu_html(), "남성")
    finals = {leaf.final for leaf in leaves if leaf.mid == "뷰티"}
    assert finals == {"스킨케어", "마스크팩"}
    assert MUSINSA_EXCLUDED_LOW_LABELS.isdisjoint(finals)


def test_parse_menu_tree_keeps_only_pumok_byeol_subgroup():
    """★요건: 신발처럼 하위그룹이 나뉜 경우 "품목별"만 인식, "인기 라인업"(브랜드) 제외."""
    _mid_names, leaves = parse_musinsa_menu_tree(_full_menu_html(), "남성")
    finals = {leaf.final for leaf in leaves if leaf.mid == "신발"}
    assert finals == {"스니커즈", "구두"}
    assert "나이키 에어포스 1" not in finals


def test_parse_menu_tree_ignores_mid_not_in_left_panel():
    """좌측 목록에 없는 중위(예: 상단 서비스탭 "MUSINSA")는 무시한다."""
    html = _full_menu_html(right_extra=_RIGHT_UNKNOWN_MID_HTML)
    _mid_names, leaves = parse_musinsa_menu_tree(html, "남성")
    assert all(leaf.mid in {"뷰티", "신발"} for leaf in leaves)
    assert "테스트항목" not in {leaf.final for leaf in leaves}


class _FakeResponse:
    def __init__(self, url: str):
        self.url = url


class _FakeSession:
    def __init__(self, resolved: dict[str, str]):
        self._resolved = resolved

    def get(self, url, timeout=None, allow_redirects=None):  # noqa: D401, ANN001
        return _FakeResponse(self._resolved.get(url, url))


def test_resolve_musinsa_category_url_appends_gf_and_keeps_existing_query():
    """★요건: 최종 이동 URL을 그대로 사용 — 기존 쿼리(separatorId)는 보존, gf만 덧붙인다."""
    fake = _FakeSession(
        {
            "https://www.musinsa.com/category/104001?gf=M": (
                "https://www.musinsa.com/category/104001/goods?gf=M"
            ),
            "https://www.musinsa.com/category/103004?separatorId=9&gf=F": (
                "https://www.musinsa.com/category/103004/goods?separatorId=9&gf=F"
            ),
        }
    )
    url1 = resolve_musinsa_category_url(
        "https://www.musinsa.com/category/104001", "M", session=fake
    )
    assert url1 == "https://www.musinsa.com/category/104001/goods?gf=M"

    url2 = resolve_musinsa_category_url(
        "https://www.musinsa.com/category/103004?separatorId=9", "F", session=fake
    )
    assert url2 == "https://www.musinsa.com/category/103004/goods?separatorId=9&gf=F"


def test_crawl_site_musinsa_end_to_end(monkeypatch):
    """★요건: 사용자 예시 두 건 — 남성>뷰티>스킨케어, 여성>신발>스니커즈."""
    import crawl as crawl_mod

    def fake_fetch(gender_code: str) -> str:
        return _full_menu_html()

    def fake_resolve(href: str, gender_code: str, session=None):  # noqa: ANN001
        sep = "&" if "?" in href else "?"
        return f"{href}{sep}gf={gender_code}"

    monkeypatch.setattr(crawl_mod, "fetch_musinsa_menu_html", fake_fetch)
    monkeypatch.setattr(crawl_mod, "resolve_musinsa_category_url", fake_resolve)

    result = crawl_site(
        "무신사",
        "https://www.musinsa.com/menu/category",
        ["남성", "여성"],
        [["뷰티"], ["신발"]],
        biz_name="(주)스타컴퍼니",
    )
    assert result.ok, result.errors
    by_low = {r.low: r for r in result.rows}

    skincare = by_low["스킨케어"]
    assert skincare.top == "남성"
    assert skincare.mid == "뷰티"
    assert skincare.final == "(주)스타컴퍼니-무신사남성-뷰티-스킨케어"
    assert skincare.final_category_url == "https://www.musinsa.com/category/104001?gf=M"

    sneakers = by_low["스니커즈"]
    assert sneakers.top == "여성"
    assert sneakers.mid == "신발"
    assert sneakers.final == "(주)스타컴퍼니-무신사여성-신발-스니커즈"
    assert (
        sneakers.final_category_url
        == "https://www.musinsa.com/category/103004?separatorId=9&gf=F"
    )
    # ★요건: 인기 라인업/신상품 보기/전체 보기는 결과에 포함되지 않는다
    assert "나이키 에어포스 1" not in by_low


def test_crawl_site_musinsa_unknown_gender_warns_and_skips(monkeypatch):
    import crawl as crawl_mod

    monkeypatch.setattr(crawl_mod, "fetch_musinsa_menu_html", lambda gender_code: _full_menu_html())
    monkeypatch.setattr(
        crawl_mod,
        "resolve_musinsa_category_url",
        lambda href, gender_code, session=None: href,
    )

    result = crawl_site(
        "무신사",
        "https://www.musinsa.com/menu/category",
        ["잘못된성별", "남성"],
        [["뷰티"], ["뷰티"]],
        biz_name="",
    )
    assert result.ok
    assert any("잘못된성별" in w for w in result.warnings)


if __name__ == "__main__":
    test_is_musinsa_platform()
    test_gender_code_mapping()
    test_parse_menu_tree_mid_candidates_scoped_to_left_panel()
    test_parse_menu_tree_excludes_new_and_all_buttons()
    test_parse_menu_tree_keeps_only_pumok_byeol_subgroup()
    test_parse_menu_tree_ignores_mid_not_in_left_panel()
    print("ok (참고: monkeypatch 필요 테스트는 pytest로 실행)")
