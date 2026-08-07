"""상품수집 BATCH — 1~13단계 순차 흐름 (딴 길로 빠지지 않음).

로그인(1)은 main에서 1회.
한 행: 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
다음 행: 13(=2 초기화) 후 3~12 반복.

실패 최대 원인: 6·11·12 확인 없이 다음 단계 진행.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import Page

    import collect as C_mod


def run_row_batch(page: "Page", row: dict, ctx: "C_mod.RunCtx") -> None:
    """한 입력 행을 2→12 단계로만 순차 실행."""
    import collect as C

    rn = int(row["row"])
    label = str(row.get("label") or "").strip()
    raw_url = str(row.get("url") or "").strip()
    url = C.normalize_url(raw_url)
    save_count = max(3, int(ctx.save_count))

    # 저장 팝업 대기 중 초기화(2) 진입 금지
    if getattr(ctx, "save_awaiting_popup", False):
        raise RuntimeError(
            f"#{rn} 저장하기 후 팝업모달 대기 미완료 — "
            "2항 초기화로 진행 불가 (11·12항 먼저)"
        )

    ctx.info(
        f"==== BATCH 시작 엑셀{rn}행 | {label} | {raw_url} | 저장수={save_count} ===="
    )
    ctx.info("순서: 2초기화→3URL→4검색클릭→5팝업열림→6팝업닫힘→7모두저장→8필터→9저장하기→10저장팝업→11닫힘→12건수")

    # ── 2. 초기화 ──
    step02_init(page, ctx, rn)

    # ── 3~6. URL검색 (실패 시 같은 구간만 최대 N회) ──
    search_ok = False
    last_state = "unknown"
    last_count = 0
    max_search = max(1, int(C.SEARCH_MAX_TRIES))
    for try_i in range(1, max_search + 1):
        ctx.check_budget(f"BATCH 3~6 시도 {try_i}/{max_search}")
        ctx.info(f"---- 검색시도 {try_i}/{max_search} ----")
        step03_input_url(page, ctx, rn, url, raw_url, try_i)
        step04_click_search(page, ctx, rn)
        step05_popup_open(page, ctx, rn, try_i)
        step06_popup_close(page, ctx, rn, try_i)
        ok, last_state, last_count = step06b_settle(
            page, ctx, rn, label, url, try_i, max_search
        )
        if ok:
            search_ok = True
            break

    if not search_ok:
        raise RuntimeError(
            f"#{rn} 망고 검색결과 확인 실패 "
            f"(state={last_state}, hint={last_count})"
        )

    # 결과 화면 준비 (6 이후 · 7 이전)
    result_imgs = C.prepare_product_view_for_shot(page, min_images=2)
    ctx.info(f"  검색결과 준비 (상품이미지 약 {result_imgs}개)")
    if C.is_mango_no_results(page):
        ctx.shot(page, "01_mango_no_results", rn)
        raise RuntimeError(
            f"#{rn} 더망고 자체 메세지: 검색결과가 없습니다.\n"
            f"  · 상위 최종 카테고리명={label}\n"
            f"  · 최종 카테고리 URL주소={url}"
        )
    ctx.shot(page, "01_results_ready", rn)

    # ── 7. 저장범위 ──
    step07_save_range(page, ctx, rn)

    # 저장 단계 시간 확보
    ctx.row_deadline = time.time() + max(120.0, float(C.MODAL_WAIT_SEC) + 60.0)

    # ── 8. 필터·건수 ──
    step08_filter_count(page, ctx, rn, label, save_count)

    # ── 9~12. 저장하기 → 팝업열림 → 닫힘 → 건수 ──
    step09_to_12_db_save(page, ctx, rn, save_count)

    if not (
        ctx.server_save_ok
        and getattr(ctx, "search_popup_closed", False)
        and getattr(ctx, "save_popup_closed", False)
        and getattr(ctx, "save_count_logged", False)
    ):
        raise RuntimeError(
            f"#{rn} BATCH 미완료 — 6·11·12항 확인 전 종료 불가"
        )

    ctx.info(
        f"==== BATCH 완료 엑셀{rn}행 "
        f"(다음 행은 13=2 초기화 후 3~12 반복) ===="
    )


# ---------------------------------------------------------------------------
# 단계 구현 (각 함수 = 한 단계, 성공 시에만 return)
# ---------------------------------------------------------------------------


def step02_init(page, ctx, rn: int) -> None:
    import collect as C

    ctx.info("2. 상품수집 필드 초기화 : 상품데이터수집 → 대량데이터수집")
    C.reset_to_bulk_menu(page)
    page.wait_for_timeout(500)
    ctx.shot(page, "00_init_bulk", rn)


def step03_input_url(
    page, ctx, rn: int, url: str, raw_url: str, try_i: int
) -> None:
    import collect as C

    ctx.info(f"3. URL 입력 | {url}")
    if url != raw_url.strip():
        ctx.info(f"  [정보] 프로토콜 보정됨: {url}")
    target = C.url_input(page)
    C.type_into(page, target, url)
    actual = ""
    try:
        actual = target.input_value()
    except Exception:
        pass
    ctx.info(f"  입력칸 최종 값: {actual!r}")
    if actual.strip() != url.strip():
        raise RuntimeError(f"URL 입력 불일치 — 기대 {url!r} / 실제 {actual!r}")
    if try_i == 1:
        ctx.shot(page, "01_url_filled", rn)


def step04_click_search(page, ctx, rn: int) -> None:
    import collect as C

    ctx.info("4. 상품수집 시작 : URL상품검색하기 클릭")
    C.click_it(C.url_search_button(page))


def step05_popup_open(page, ctx, rn: int, try_i: int) -> None:
    import collect as C

    ctx.info("5. 상품수집 실행 : 검색 팝업 모달 열림 대기 (임시메모리 적재)")
    opened = C.wait_popup_open(page, grace_sec=15.0)
    if not opened:
        ctx.info("  키보드 재시도 (Enter)")
        try:
            C.url_search_button(page).first.focus()
            page.keyboard.press("Enter")
        except Exception:
            pass
        opened = C.wait_popup_open(page, grace_sec=10.0)
    if not opened:
        ctx.shot(page, "01_popup_missing", rn)
        raise RuntimeError(f"#{rn} 4항 클릭 후 검색 팝업이 열리지 않음 (5항 실패)")

    popup = opened[0]
    try:
        popup.bring_to_front()
    except Exception:
        pass
    try:
        imgs = C.prepare_product_view_for_shot(popup, min_images=2)
    except Exception as e:
        ctx.info(f"  [경고] 팝업 상품이미지 대기 실패: {e}")
        imgs = 0
    ctx.search_popup_seen = True
    ctx.search_popup_closed = False
    ctx.info(f"5. 검색 팝업 열림 확인 (상품이미지 약 {imgs}개)")
    if try_i == 1:
        ctx.shot(popup, "01_popup_opened", rn)


def step06_popup_close(page, ctx, rn: int, try_i: int) -> None:
    import collect as C

    ctx.info("6. 상품수집 종료 : 검색 팝업 닫기-확인 (임시메모리 보관 완료)")
    C.wait_popups_close(page)
    if C.popups(page):
        raise TimeoutError(
            f"#{rn} 검색 팝업모달이 닫히지 않음 (6항 미확인) — 7항 진행 불가"
        )
    ctx.search_popup_closed = True
    try:
        page.bring_to_front()
    except Exception:
        pass
    ctx.info("6. 검색 팝업 닫힘 확인 완료")
    if try_i == 1:
        ctx.shot(page, "01_popup_closed", rn)


def step06b_settle(
    page, ctx, rn: int, label: str, url: str, try_i: int, max_search: int
) -> tuple[bool, str, int]:
    """6항 직후 결과 판별. (True, state, count) = 7항으로 진행 가능."""
    import collect as C

    ctx.info("  (6→7) 망고 검색결과 안정화")
    last_state, last_count = C.wait_mango_search_settle(page, timeout_sec=45.0)
    if last_state == "no_results":
        ctx.shot(page, "01_mango_no_results", rn)
        if try_i < max_search:
            ctx.info("  무결과 — 3항부터 재시도")
            page.wait_for_timeout(800)
            return False, last_state, last_count
        raise RuntimeError(
            f"#{rn} 더망고 자체 메세지: 검색결과가 없습니다.\n"
            f"  · 상위 최종 카테고리명={label}\n"
            f"  · 최종 카테고리 URL주소={url}"
        )
    if last_state == "products" or last_count >= 1:
        return True, last_state, last_count

    result_imgs = C.prepare_product_view_for_shot(page, min_images=2)
    if result_imgs >= 1 and not C.is_mango_no_results(page):
        return True, "products", result_imgs
    if C.is_mango_no_results(page):
        ctx.shot(page, "01_mango_no_results", rn)
        if try_i < max_search:
            return False, "no_results", last_count
        raise RuntimeError(
            f"#{rn} 더망고 자체 메세지: 검색결과가 없습니다.\n"
            f"  · 상위 최종 카테고리명={label}\n"
            f"  · 최종 카테고리 URL주소={url}"
        )
    if try_i < max_search:
        ctx.info(f"  결과 불명(state={last_state}) — 3항부터 재시도")
        page.wait_for_timeout(800)
        return False, last_state, last_count
    return False, last_state, last_count


def step07_save_range(page, ctx, rn: int) -> None:
    import collect as C

    ctx.info("7. 저장범위 지정 : 검색된 상품 모두저장 클릭")
    C.scroll_to_product_strip(page)
    C.click_it(C.save_all_button(page))
    end = time.time() + C.MODAL_WAIT_SEC
    while time.time() < end:
        if C.save_modal_visible(page):
            break
        page.wait_for_timeout(300)
    else:
        ctx.shot(page, "02_save_missing", rn)
        raise RuntimeError(f"#{rn} 7항 모두저장 후 상품저장설정 모달 미열림")
    try:
        imgs = C.prepare_product_view_for_shot(page, min_images=2)
    except Exception as e:
        ctx.info(f"  [경고] 모달 상품이미지 대기 실패: {e}")
        imgs = 0
    page.wait_for_timeout(300)
    ctx.info(f"7. 상품저장설정 모달 열림 (상품이미지 약 {imgs}개)")
    ctx.shot(page, "02_save_modal", rn)


def step08_filter_count(
    page, ctx, rn: int, label: str, save_count: int
) -> None:
    import collect as C

    ctx.info(f"8. 필터·수집상품수 입력 (필터={label}, 수={save_count})")
    C.fill_save_modal_fields(page, ctx, rn, label, save_count)


def step09_to_12_db_save(page, ctx, rn: int, save_count: int) -> None:
    """9 저장하기 → 10 팝업열림 → 11 닫힘확인 → 12 건수로그."""
    import collect as C

    ctx.info("9~12. DB저장 배치: 저장하기 → 팝업열림 → 닫힘확인 → 건수로그")
    C.run_save_submit_and_verify(page, ctx, rn, save_count)
    if not ctx.server_save_ok:
        raise RuntimeError(
            f"#{rn} 9~12항 DB저장 미완료 — "
            "저장하기·팝업열림·닫힘·건수로그 확인 필요"
        )
