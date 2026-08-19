"""P1_102(P1 복제본) — 상위·중위 카테고리 입력 파싱, GNB 파싱, 입력값 저장/복원 단위테스트."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawl import (  # noqa: E402
    DEFAULT_BIZ_NAME,
    DEFAULT_OUTDIR,
    DEFAULT_SITE,
    DEFAULT_URL,
    EXCEL_HEADERS,
    MID_PER_TOP,
    TOP_CELL_MAX_LEN,
    TOP_GROUP_COUNT,
    CategoryPair,
    build_final_category_name,
    crawl_site,
    filter_by_top_mid,
    load_last_input,
    parse_art_gnb_low_as_final,
    parse_category_groups,
    parse_top_cell,
    parse_total_count_from_html,
    parse_review_count_from_html,
    save_excel,
    save_last_input,
    top_final_label,
)


def test_group_shape():
    assert TOP_GROUP_COUNT == 2
    assert MID_PER_TOP == 20
    assert TOP_CELL_MAX_LEN == 15


def test_defaults():
    assert DEFAULT_SITE == "ABC마트"
    assert DEFAULT_URL == "https://abcmart.a-rt.com/?track=W0009"
    assert DEFAULT_BIZ_NAME == ""


def test_parse_plain_and_alias():
    assert parse_top_cell("MEN") == ("MEN", "MEN")
    assert parse_top_cell("  상의  ") == ("상의", "상의")
    assert parse_top_cell("") is None
    assert parse_top_cell("MEN:남성") == ("MEN", "남성")


def test_parse_category_groups_expands_pairs():
    """4행 입력(상위1개+중위20개 × 2그룹) → (상위,중위) 쌍으로 펼쳐진다."""
    top_names = ["MEN", "WOMEN"]
    mid_names = [
        ["상의", "하의", ""],
        ["상의", "", "아우터"],
    ]
    pairs = parse_category_groups(top_names, mid_names)
    assert pairs == [
        CategoryPair("MEN", "상의", "MEN", "상의"),
        CategoryPair("MEN", "하의", "MEN", "하의"),
        CategoryPair("WOMEN", "상의", "WOMEN", "상의"),
        CategoryPair("WOMEN", "아우터", "WOMEN", "아우터"),
    ]


def test_parse_category_groups_alias_and_dedupe():
    top_names = ["MEN:남성", ""]
    mid_names = [["TOP:상의", "TOP:상의", "BOTTOM"], []]
    pairs = parse_category_groups(top_names, mid_names)
    assert len(pairs) == 2
    assert pairs[0].match_top == "MEN"
    assert pairs[0].excel_top == "남성"
    assert pairs[0].match_mid == "TOP"
    assert pairs[0].excel_mid == "상의"
    assert pairs[1].match_mid == "BOTTOM"


def test_parse_category_groups_empty_top_skips_group():
    pairs = parse_category_groups(["", "WOMEN"], [["상의"], ["하의"]])
    assert [p.label() for p in pairs] == ["WOMEN > 하의"]


_SAMPLE_GNB_HTML = """
<html><body>
<ul class="gnb-menu">
  <li class="gnb-menu-depth1">
    <a class="menu-name">MEN</a>
    <div class="sub-depth2">
      <div class="depth2-title"><a href="/mid1">상의</a></div>
      <ul class="sub-depth3">
        <li class="item">
          <a class="depth3-title" href="/display/category/main?ctgrNo=101">반팔티</a>
          <ul class="sub-depth4">
            <li class="item"><a class="depth4-title" href="/display/category/main?ctgrNo=102">그래픽 반팔티</a></li>
          </ul>
        </li>
        <li class="item">
          <a class="depth3-title" href="/display/category/main?ctgrNo=103">셔츠</a>
        </li>
      </ul>
    </div>
  </li>
</ul>
</body></html>
"""


def test_parse_art_gnb_low_as_final_ignores_depth4():
    """★요건: depth4가 있어도 하위(depth3) 카테고리명을 최종 카테고리명으로 고정."""
    leaves = parse_art_gnb_low_as_final(_SAMPLE_GNB_HTML, "https://abcmart.a-rt.com/")
    finals = {leaf.final for leaf in leaves}
    assert "반팔티" in finals
    assert "셔츠" in finals
    assert "그래픽 반팔티" not in finals  # depth4 명은 최종 카테고리명으로 쓰지 않음
    men_top = [leaf for leaf in leaves if leaf.top == "MEN"]
    assert all(leaf.mid == "상의" for leaf in men_top)
    assert all(leaf.low == "" for leaf in men_top)


def test_filter_by_top_mid_matches_case_insensitive():
    leaves = parse_art_gnb_low_as_final(_SAMPLE_GNB_HTML, "https://abcmart.a-rt.com/")
    pairs = [CategoryPair("men", "상의", "MEN", "상의")]
    matched = filter_by_top_mid(leaves, pairs)
    finals = {leaf.final for leaf, _pair in matched}
    assert finals == {"반팔티", "셔츠"}


def test_excel_headers_same_as_p1_format():
    """★요건: 결과물은 P1과 동일한 OUTPUT."""
    assert EXCEL_HEADERS == [
        "상위 카테고리명",
        "중위 카테고리명",
        "하위 카테고리명",
        "최종 카테고리명",
        "상위 최종 카테고리명",
        "최종 카테고리 URL주소",
        "총상품수",
        "상품수집가능개수",
        "검색수",
        "리뷰수",
    ]


def test_save_excel_filename_matches_p1_pattern(tmp_path):
    path = save_excel([], "ABC마트", tmp_path)
    assert path.exists()
    assert path.name.startswith("ABC마트_카테고리URL_LIST_")
    assert "_102" not in path.name


def test_top_final_label():
    assert top_final_label("남성", "반팔티") == "남성 반팔티"
    assert top_final_label("", "반팔티") == "반팔티"


def test_build_final_category_name_formula():
    """★요건: 최종카테고리명 = 사업자명-사이트명상위카테고리명-중위카테고리명-하위카테고리명
    (원문 그대로 — 사이트명과 상위카테고리명 사이는 구분자 없음)."""
    assert (
        build_final_category_name("(주)스타컴퍼니", "ABC마트", "남성", "상의", "반팔티")
        == "(주)스타컴퍼니-ABC마트남성-상의-반팔티"
    )
    assert build_final_category_name("", "ABC마트", "남성", "상의", "반팔티") == "-ABC마트남성-상의-반팔티"


def test_crawl_site_uses_biz_name_in_final_and_fills_low(monkeypatch):
    """crawl_site가 사업자명을 최종카테고리명 조합에 반영하고,
    "하위 카테고리명" 컬럼에는 실제 하위 카테고리명을 채운다."""
    import crawl as crawl_mod

    monkeypatch.setattr(crawl_mod, "fetch_html", lambda url, session=None: _SAMPLE_GNB_HTML)
    monkeypatch.setattr(crawl_mod, "is_art_platform", lambda html, url: True)
    monkeypatch.setattr(
        crawl_mod,
        "enrich_rows_with_product_stats",
        lambda rows, leaves, session=None: [],
    )

    result = crawl_site(
        "ABC마트",
        "https://abcmart.a-rt.com/?track=W0009",
        ["MEN", ""],
        [["상의"], []],
        biz_name="(주)스타컴퍼니",
    )
    assert result.ok, result.errors
    assert len(result.rows) == 2
    row = next(r for r in result.rows if r.low == "반팔티")
    assert row.top == "MEN"
    assert row.mid == "상의"
    assert row.final == "(주)스타컴퍼니-ABC마트MEN-상의-반팔티"


def test_parse_total_and_review_from_html():
    html = """
    <div>
      <input type="hidden" name="totalCount" value="930" />
      <span class="spot result-cnt">930</span>
      <span>리뷰 12</span>
      <span>리뷰(3)</span>
    </div>
    """
    assert parse_total_count_from_html(html) == 930
    assert parse_review_count_from_html(html) == 15


def test_save_and_load_last_input_roundtrip(tmp_path):
    """★요건: 재실행 시 마지막 입력값(사업자명 포함)을 초기값으로 그대로 복원한다."""
    p = tmp_path / ".last_input.json"
    top_names = ["MEN", "WOMEN"]
    mid_names = [["상의", "하의"], ["아우터"]]
    save_last_input(
        "ABC마트",
        "https://abcmart.a-rt.com/",
        str(tmp_path),
        top_names,
        mid_names,
        biz="(주)스타컴퍼니",
        path=p,
    )
    loaded = load_last_input(p)
    assert loaded["site"] == "ABC마트"
    assert loaded["biz"] == "(주)스타컴퍼니"
    assert loaded["url"] == "https://abcmart.a-rt.com/"
    assert loaded["outdir"] == str(tmp_path)
    assert loaded["top_names"][:2] == ["MEN", "WOMEN"]
    assert loaded["mid_names"][0][:2] == ["상의", "하의"]
    assert loaded["mid_names"][1][:1] == ["아우터"]


def test_load_last_input_missing_file_returns_defaults(tmp_path):
    missing = tmp_path / "does_not_exist.json"
    loaded = load_last_input(missing)
    assert loaded["site"] == DEFAULT_SITE
    assert loaded["biz"] == DEFAULT_BIZ_NAME
    assert loaded["url"] == DEFAULT_URL
    assert loaded["outdir"] == DEFAULT_OUTDIR
    assert loaded["top_names"] == ["", ""]


if __name__ == "__main__":
    test_group_shape()
    test_defaults()
    test_parse_plain_and_alias()
    test_parse_category_groups_expands_pairs()
    test_parse_category_groups_alias_and_dedupe()
    test_parse_category_groups_empty_top_skips_group()
    test_parse_art_gnb_low_as_final_ignores_depth4()
    test_filter_by_top_mid_matches_case_insensitive()
    test_excel_headers_same_as_p1_format()
    test_top_final_label()
    test_build_final_category_name_formula()
    test_parse_total_and_review_from_html()
    print("ok (참고: tmp_path/monkeypatch 필요 테스트는 pytest로 실행)")
