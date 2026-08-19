"""P2 — 수집사이트명/URL 검증(verify_selected_site) · 엑셀 라벨 컬럼(최종 카테고리명) 단위테스트.

★요건(2026-08-19):
1. P2 화면에 "수집사이트명"·"수집사이트URL" 입력값이 더망고에서 선택된 정보와
   다르면 상세한 오류 메세지와 함께 실행을 중단한다.
2. 카테고리URL목록·수집필터명(검색필터명)에는 "상위 최종 카테고리명" 대신
   "최종 카테고리명"을 사용한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import collect as C  # noqa: E402


class _FakePage:
    def __init__(self, body_text: str, title: str = "", url: str = "https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php"):
        self._body_text = body_text
        self._title = title
        self.url = url

    def evaluate(self, _script: str):
        return self._body_text

    def title(self) -> str:
        return self._title


class _FakeCtx:
    def __init__(self):
        self.messages: list[str] = []

    def info(self, msg: str) -> None:
        self.messages.append(msg)


def test_verify_selected_site_skips_when_both_empty():
    page = _FakePage(body_text="아무 내용")
    C.verify_selected_site(page, "", "")  # 예외 없이 통과(하위 호환)


def test_verify_selected_site_passes_when_name_and_domain_present():
    page = _FakePage(body_text="현재 선택된 사이트: ABC마트 (abcmart.a-rt.com)")
    ctx = _FakeCtx()
    C.verify_selected_site(page, "ABC마트", "https://abcmart.a-rt.com/?track=W0009", ctx=ctx)
    assert any("검증 OK" in m for m in ctx.messages)


def test_verify_selected_site_raises_detailed_error_on_name_mismatch():
    page = _FakePage(body_text="현재 선택된 사이트: 무신사 (musinsa.com)")
    with pytest.raises(RuntimeError) as exc:
        C.verify_selected_site(page, "ABC마트", "https://musinsa.com/menu/category")
    msg = str(exc.value)
    assert "수집사이트명 불일치" in msg
    assert "ABC마트" in msg
    assert "더망고" in msg


def test_verify_selected_site_raises_detailed_error_on_url_mismatch():
    page = _FakePage(body_text="현재 선택된 사이트: ABC마트")
    with pytest.raises(RuntimeError) as exc:
        C.verify_selected_site(page, "ABC마트", "https://musinsa.com/menu/category")
    msg = str(exc.value)
    assert "수집사이트URL 불일치" in msg
    assert "musinsa.com" in msg


def test_verify_selected_site_matches_via_page_title_and_url():
    page = _FakePage(body_text="", title="ABC마트 관리자", url="https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php?abcmart.a-rt.com")
    ctx = _FakeCtx()
    C.verify_selected_site(page, "ABC마트", "https://abcmart.a-rt.com/", ctx=ctx)
    assert any("검증 OK" in m for m in ctx.messages)


def test_read_excel_uses_final_category_name_column(tmp_path):
    """★요건: 엑셀 라벨 컬럼은 '상위 최종 카테고리명'이 아니라 '최종 카테고리명'."""
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["상위 카테고리명", "중위 카테고리명", "하위 카테고리명", "최종 카테고리명", "상위 최종 카테고리명", "최종 카테고리 URL주소"])
    ws.append(["MEN", "상의", "반팔티", "(주)스타컴퍼니-ABC마트MEN-상의-반팔티", "MEN 반팔티", "https://abcmart.a-rt.com/x"])
    p = tmp_path / "sample.xlsx"
    wb.save(p)

    rows = C.read_excel(str(p))
    assert len(rows) == 1
    assert rows[0]["label"] == "(주)스타컴퍼니-ABC마트MEN-상의-반팔티"
    assert rows[0]["url"] == "https://abcmart.a-rt.com/x"


def test_read_excel_missing_final_category_name_header_raises(tmp_path):
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["상위 최종 카테고리명", "최종 카테고리 URL주소"])
    ws.append(["MEN 반팔티", "https://abcmart.a-rt.com/x"])
    p = tmp_path / "old_format.xlsx"
    wb.save(p)

    with pytest.raises(SystemExit):
        C.read_excel(str(p))
