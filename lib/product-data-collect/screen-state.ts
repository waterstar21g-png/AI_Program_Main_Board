import type { Page } from 'playwright';
import { TMG_ADMIN_HOST } from '@/lib/product-data-collect/browser-session';

/**
 * 스크린샷 기준 화면 4종 (+ 대기 상태)
 *
 * A) 망고 대량수집 메인 — URL 입력 + URL상품검색하기
 * B) ABC 수집 팝업창 (별도 창) — 건드리지 않음
 * C) 망고 load product 로딩 — 건드리지 않음
 * D) 상품저장설정 모달 — 검색필터명 입력 + 저장하기
 */
export type MangoScreen =
  | 'bulk_main' // A: 입력 가능
  | 'abc_popup' // B: ABC 창 열림 → 대기만
  | 'loading' // C: load product → 대기만
  | 'results_ready' // A + 검색된 상품 N개
  | 'save_modal' // D: 상품저장설정
  | 'no_results' // 결과 없음 (로딩 끝난 뒤)
  | 'unknown';

export function isAbcPopupUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false;
  if (url.includes(TMG_ADMIN_HOST)) return false;
  return (
    url.includes('pmode=mango') ||
    url.includes('smode=search') ||
    url.includes('abcmart.a-rt.com') ||
    /a-rt\.com\/display/i.test(url)
  );
}

export function abcPopupPages(main: Page): Page[] {
  return main
    .context()
    .pages()
    .filter(p => p !== main && !p.isClosed() && isAbcPopupUrl(p.url()));
}

/** 스크린샷 A — 대량수집 메인 화면 시그니처 */
export async function matchesBulkMainScreen(page: Page): Promise<boolean> {
  if (!page.url().includes('getGoodsNew.php')) return false;
  const hasTitle = await page
    .getByText(/상품데이터\s*대량수집.*리스팅페이지\s*URL/)
    .first()
    .isVisible()
    .catch(() => false);
  const hasUrlBtn = await page
    .getByText(/URL\s*상품\s*검색하기/)
    .first()
    .isVisible()
    .catch(() => false);
  return hasTitle && hasUrlBtn;
}

/** 스크린샷 C — 빨간 load product 로딩 */
export async function matchesLoadingScreen(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const t = (document.body?.innerText || '').replace(/\s+/g, ' ');
      return (
        /load\s*product/i.test(t) ||
        /상품정보를\s*불러오는\s*중/i.test(t) ||
        /잠시만\s*기다려\s*주세요/i.test(t)
      );
    })
    .catch(() => false);
}

/** 스크린샷 — 검색 결과 그리드 */
export async function matchesResultsReady(page: Page): Promise<boolean> {
  if (await page.getByText(/검색된\s*상품\s*[1-9]\d*/).first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/KRW\s*[\d,]+/).first().isVisible().catch(() => false);
}

/** 스크린샷 D — 상품저장설정 모달 */
export async function matchesSaveModal(page: Page): Promise<boolean> {
  const title = await page.getByText('상품저장설정').first().isVisible().catch(() => false);
  const filter = await page.getByText('검색필터명').first().isVisible().catch(() => false);
  const save = await page.getByText(/^저장하기$/).first().isVisible().catch(() => false);
  return title && filter && save;
}

export async function matchesNoResults(page: Page): Promise<boolean> {
  const patterns = [
    /검색하신\s*검색에\s*대한\s*검색결과가\s*없습니다/,
    /검색결과가\s*없습니다/,
    /정확한\s*검색어인지\s*다시한번\s*확인/,
  ];
  for (const re of patterns) {
    if (await page.getByText(re).first().isVisible().catch(() => false)) return true;
  }
  return page.getByText(/검색된\s*상품\s*0\s*개/).first().isVisible().catch(() => false);
}

/** 현재 망고 메인 화면 상태 (창/포커스 변경 없음) */
export async function detectMangoScreen(page: Page): Promise<MangoScreen> {
  if (!(await matchesBulkMainScreen(page))) return 'unknown';

  if (abcPopupPages(page).length > 0) return 'abc_popup';
  if (await matchesSaveModal(page)) return 'save_modal';
  if (await matchesLoadingScreen(page)) return 'loading';
  if (await matchesResultsReady(page)) return 'results_ready';
  if (await matchesNoResults(page)) return 'no_results';
  return 'bulk_main';
}
