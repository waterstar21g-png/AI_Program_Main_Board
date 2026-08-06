import type { Page } from 'playwright';
import { TMG_ADMIN_HOST } from '@/lib/product-data-collect/browser-session';

/**
 * 망고 메인화면 비슷하면 처리 — 스크린샷 4상태
 *
 * A) 대량수집 메인 (URL입력 + URL상품검색하기)
 * B) ABC 팝업 → 대기만
 * C) load product → 대기만
 * D) 상품저장설정 → 입력·저장
 */
export type MangoScreen =
  | 'bulk_main'
  | 'abc_popup'
  | 'loading'
  | 'results_ready'
  | 'save_modal'
  | 'no_results'
  | 'unknown';

export const URL_INPUT_SCREENS: MangoScreen[] = ['bulk_main', 'results_ready', 'no_results'];

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

/**
 * 망고 대량수집 메인과 비슷한 화면인가 (느슨한 비교)
 * — getGoodsNew.php + URL상품검색 버튼이 보이면 OK
 */
export async function looksLikeMangoBulkScreen(page: Page): Promise<boolean> {
  const url = page.url();
  if (!url.includes('getGoodsNew.php') && !url.includes(TMG_ADMIN_HOST)) {
    return false;
  }

  const hasUrlSearch =
    (await page
      .locator('input[type="button"][value*="URL"], input[type="submit"][value*="URL"]')
      .first()
      .isVisible()
      .catch(() => false)) ||
    (await page
      .getByText(/URL\s*상품\s*검색/)
      .first()
      .isVisible()
      .catch(() => false));

  return hasUrlSearch;
}

/** @deprecated looksLikeMangoBulkScreen 사용 */
export async function matchesBulkMainScreen(page: Page): Promise<boolean> {
  return looksLikeMangoBulkScreen(page);
}

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

export async function matchesResultsReady(page: Page): Promise<boolean> {
  if (await page.getByText(/검색된\s*상품\s*[1-9]\d*/).first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/KRW\s*[\d,]+/).first().isVisible().catch(() => false);
}

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

/** 비슷한 망고 화면이면 상태 판별 → 맞는 처리만 함 */
export async function detectMangoScreen(page: Page): Promise<MangoScreen> {
  if (!(await looksLikeMangoBulkScreen(page))) return 'unknown';

  if (abcPopupPages(page).length > 0) return 'abc_popup';
  if (await matchesSaveModal(page)) return 'save_modal';
  if (await matchesLoadingScreen(page)) return 'loading';
  if (await matchesResultsReady(page)) return 'results_ready';
  if (await matchesNoResults(page)) return 'no_results';
  return 'bulk_main';
}
