/**
 * 더망고 대량수집 — 화면 순서 그대로
 *
 * 0. 초기화 : 상품데이터수집 → 대량데이터수집 클릭
 * 1. URL상품검색하기 → 필드값 입력후 → 팝업창이 없어질때까지 대기
 * 2. 검색된 상품 모두저장 클릭후 → 팝업창에서 검색필터명 입력후 → 저장하기
 * 3. 팝업창이 없어질때까지 대기
 * 4. → 0. 초기화
 *
 * 팝업을 강제로 열거나 닫거나 포커스하지 않는다.
 */
import type { BrowserContext, Locator, Page } from 'playwright';
import {
  ensureCollectBrowserReady,
  findMangoWorkPage,
  resetBulkCollectViaMenu,
} from '@/lib/product-data-collect/browser-session';
import {
  abcPopupPages,
  detectMangoScreen,
  looksLikeMangoBulkScreen,
  matchesLoadingScreen,
  matchesNoResults,
  matchesResultsReady,
  matchesSaveModal,
  URL_INPUT_SCREENS,
  type MangoScreen,
} from '@/lib/product-data-collect/screen-state';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

type LogCtx = {
  logs: WorkflowStepLog[];
  onLog?: (entry: WorkflowStepLog) => void;
};

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function pushLog(
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  rowIndex?: number,
  message?: string,
) {
  const entry: WorkflowStepLog = { step, label, rowIndex, at: new Date().toISOString(), message };
  ctx.logs.push(entry);
  ctx.onLog?.(entry);
}

const SCREEN_LABEL: Record<MangoScreen, string> = {
  bulk_main: '메인(입력가능)',
  abc_popup: 'ABC팝업(대기)',
  loading: 'load product(대기)',
  results_ready: '검색결과있음',
  save_modal: '상품저장설정',
  no_results: '검색결과없음',
  unknown: '화면불명',
};

function assertNoAbcPopup(page: Page, action: string) {
  if (abcPopupPages(page).length > 0) {
    throw new Error(`${action}: ABC 팝업이 열려 있어 화면을 건드리지 않습니다.`);
  }
}

async function waitForScreens(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
  allowed: MangoScreen[],
  timeoutMs: number,
): Promise<MangoScreen> {
  const deadline = Date.now() + timeoutMs;
  let lastBeat = 0;
  while (Date.now() < deadline) {
    const s = await detectMangoScreen(page);
    if (allowed.includes(s)) {
      pushLog(ctx, 'wait-search-popup', '화면일치', rowIndex, SCREEN_LABEL[s]);
      return s;
    }
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      pushLog(ctx, 'wait-search-popup', '화면대기…', rowIndex, SCREEN_LABEL[s]);
    }
    if (s === 'abc_popup') {
      const pops = abcPopupPages(page);
      await Promise.race([
        ...pops.map(p => p.waitForEvent('close').catch(() => undefined)),
        sleep(1000),
      ]);
    } else {
      await sleep(500);
    }
  }
  throw new Error(`#${rowIndex} 화면 대기 시간 초과 (현재=${SCREEN_LABEL[await detectMangoScreen(page)]})`);
}

async function fillField(page: Page, locator: Locator, text: string) {
  assertNoAbcPopup(page, '입력');
  await locator.first().evaluate(
    (node, value) => {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        node.value = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    text,
  );
}

async function clickBtn(page: Page, locator: Locator) {
  assertNoAbcPopup(page, '클릭');
  const el = locator.first();
  await el.waitFor({ state: 'visible', timeout: 30_000 });
  try {
    await el.click({ timeout: 15_000 });
  } catch {
    await el.evaluate(node => (node as HTMLElement).click());
  }
}

function normalizeUrl(url: string): string {
  const t = url.trim();
  return !t ? t : /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function urlSearchButton(page: Page) {
  return page
    .locator('input[type="button"][value*="URL"][value*="상품"][value*="검색"]')
    .or(page.locator('input[type="submit"][value*="URL"][value*="상품"][value*="검색"]'))
    .or(page.getByText(/URL\s*상품\s*검색하기/));
}

function saveAllButton(page: Page) {
  return page
    .locator('input[type="button"][value*="검색된"][value*="모두저장"]')
    .or(page.locator('input[type="submit"][value*="검색된"][value*="모두저장"]'))
    .or(page.getByText(/검색된\s*상품\s*모두\s*저장/));
}

function saveSettingsModal(page: Page) {
  return page
    .locator('div, form, table')
    .filter({ hasText: '상품저장설정' })
    .filter({ hasText: '저장하기' })
    .filter({ hasText: '취소하기' })
    .last();
}

async function findUrlInput(page: Page): Promise<Locator> {
  const btn = urlSearchButton(page).first();
  const area = page.locator('tr, table, div').filter({ has: btn }).last();
  const ta = area.locator('textarea');
  if ((await ta.count()) > 0) return ta.last();
  const inp = area.locator('input[type="text"]:not([name="login_id"]):not([name="login_passwd"])');
  if ((await inp.count()) > 0) return inp.last();
  throw new Error('URL 입력칸을 찾지 못했습니다.');
}

async function requireMangoPage(context: BrowserContext, ctx: LogCtx): Promise<Page> {
  const page = await findMangoWorkPage(context);
  if (!page) {
    throw new Error(
      '망고 대량수집 화면을 찾지 못했습니다.\n' +
        '브라우저에서 대량수집(getGoodsNew.php)을 연 뒤 ▶ 한번에 실행 하세요.',
    );
  }
  pushLog(ctx, 'open-page', '망고 화면 확인', undefined, SCREEN_LABEL[await detectMangoScreen(page)]);
  return page;
}

/** [0] 상품데이터수집 → 대량데이터수집 클릭 */
async function step0Init(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'open-page', '[0] 초기화: 상품데이터수집 → 대량데이터수집', rowIndex);
  if (!(await looksLikeMangoBulkScreen(page))) {
    throw new Error(`#${rowIndex} [0] 망고 대량수집 화면이 아닙니다.`);
  }
  assertNoAbcPopup(page, '[0]');
  if (await matchesSaveModal(page)) {
    await step3WaitSaveDone(page, ctx, rowIndex);
  }
  await resetBulkCollectViaMenu(page);
  await waitForScreens(page, ctx, rowIndex, URL_INPUT_SCREENS, 60_000);
  pushLog(ctx, 'open-page', '[0] 초기화 완료', rowIndex);
}

/** [1] URL 입력 → URL상품검색하기 → 팝업 없어질 때까지 */
async function step1UrlSearchAndWait(
  page: Page,
  url: string,
  ctx: LogCtx,
  rowIndex: number,
): Promise<'products' | 'empty'> {
  await waitForScreens(page, ctx, rowIndex, URL_INPUT_SCREENS, 60_000);
  const normalized = normalizeUrl(url);

  pushLog(ctx, 'paste-url', '[1] URL 필드값 입력', rowIndex, normalized);
  await fillField(page, await findUrlInput(page), normalized);

  pushLog(ctx, 'url-search', '[1] URL상품검색하기 클릭', rowIndex);
  await clickBtn(page, urlSearchButton(page).first());

  pushLog(ctx, 'wait-search-popup', '[1] 팝업창 없어질 때까지 대기 (미터치)', rowIndex);
  let emptySince = 0;
  let lastBeat = 0;
  const deadline = Date.now() + 300_000;

  while (Date.now() < deadline) {
    const s = await detectMangoScreen(page);
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      pushLog(ctx, 'wait-search-popup', '[1] 대기중…', rowIndex, SCREEN_LABEL[s]);
    }

    if (s === 'abc_popup' || s === 'loading') {
      emptySince = 0;
      const pops = abcPopupPages(page);
      if (pops.length > 0) {
        await Promise.race([
          ...pops.map(p => p.waitForEvent('close').catch(() => undefined)),
          sleep(1000),
        ]);
      } else {
        await sleep(500);
      }
      continue;
    }

    if (s === 'results_ready' || (await matchesResultsReady(page))) {
      pushLog(ctx, 'wait-search-popup', '[1] 팝업 종료 · 검색결과 확인', rowIndex);
      return 'products';
    }

    if ((s === 'no_results' || (await matchesNoResults(page))) && !(await matchesLoadingScreen(page))) {
      if (!emptySince) emptySince = Date.now();
      if (Date.now() - emptySince >= 5_000) {
        pushLog(ctx, 'wait-search-popup', '[1] 검색결과 없음', rowIndex);
        return 'empty';
      }
    } else {
      emptySince = 0;
    }

    await sleep(500);
  }
  throw new Error(`#${rowIndex} [1] 팝업 대기 시간 초과`);
}

/** [2] 모두저장 → 검색필터명 → 저장하기 */
async function step2SaveAllAndConfirm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await waitForScreens(page, ctx, rowIndex, ['results_ready'], 120_000);

  pushLog(ctx, 'save-all', '[2] 검색된 상품 모두저장 클릭', rowIndex);
  await clickBtn(page, saveAllButton(page).first());
  await waitForScreens(page, ctx, rowIndex, ['save_modal'], 90_000);

  const modal = saveSettingsModal(page);
  const filterInput = modal.locator('tr').filter({ hasText: '검색필터명' }).locator('input').first();
  const countInput = modal.locator('tr').filter({ hasText: '저장상품수' }).locator('input').first();

  pushLog(ctx, 'fill-save-form', '[2] 검색필터명 입력', rowIndex, filterName);
  await fillField(page, filterInput, filterName);
  await fillField(page, countInput, String(saveCount));

  pushLog(ctx, 'fill-save-form', '[2] 저장하기 클릭', rowIndex);
  await clickBtn(
    page,
    modal
      .locator('input[value="저장하기"], input[type="submit"][value="저장하기"]')
      .or(modal.getByText(/^저장하기$/))
      .first(),
  );
}

/** [3] 팝업창이 없어질 때까지 대기 */
async function step3WaitSaveDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '[3] 팝업창 없어질 때까지 대기', rowIndex);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (!(await matchesSaveModal(page))) {
      pushLog(ctx, 'wait-save-popup', '[3] 팝업 종료', rowIndex);
      return;
    }
    await sleep(500);
  }
  throw new Error(`#${rowIndex} [3] 저장 팝업 대기 시간 초과`);
}

async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  ctx: LogCtx,
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  pushLog(ctx, 'next-row', `━━━ #${rowIndex} ━━━`, rowIndex);

  if (!finalCategoryUrl?.match(/^https?:\/\//i)) {
    throw new Error(`#${rowIndex} URL 오류: ${finalCategoryUrl || '(비어있음)'}`);
  }
  if (!topFinalLabel.trim()) {
    throw new Error(`#${rowIndex} 상위 최종 카테고리명 비어 있음`);
  }

  // 0
  await step0Init(page, ctx, rowIndex);
  // 1
  const outcome = await step1UrlSearchAndWait(page, finalCategoryUrl, ctx, rowIndex);
  if (outcome === 'empty') {
    pushLog(ctx, 'next-row', `[4] #${rowIndex} 결과없음 → 0.초기화`, rowIndex);
    return;
  }
  // 2
  await step2SaveAllAndConfirm(page, topFinalLabel, saveCount, ctx, rowIndex);
  // 3
  await step3WaitSaveDone(page, ctx, rowIndex);
  // 4 → 0 (다음 행)
  pushLog(ctx, 'next-row', `[4] #${rowIndex} 완료 → 0.초기화`, rowIndex);
}

export async function runTmgCollectWorkflow(
  req: TmgCollectRequest,
  onLog?: (entry: WorkflowStepLog) => void,
): Promise<TmgCollectResult> {
  const logs: WorkflowStepLog[] = [];
  const ctx: LogCtx = { logs, onLog };
  const saveCount = req.saveCount ?? 3;
  const rows = req.rows.filter(r => r.finalCategoryUrl.trim());

  if (!rows.length) {
    return { ok: false, logs, processedCount: 0, message: '처리할 엑셀 행이 없습니다.' };
  }

  pushLog(
    ctx,
    'open-page',
    '화면순서: [0]초기화 → [1]URL검색·팝업대기 → [2]모두저장·필터명·저장하기 → [3]팝업대기 → [4]→[0]',
    undefined,
    '팝업 미터치',
  );

  let processedCount = 0;
  try {
    const browserCtx = await ensureCollectBrowserReady();
    const page = await requireMangoPage(browserCtx, ctx);
    page.setDefaultTimeout(120_000);

    const start = req.startRowIndex ?? 0;
    for (let i = start; i < rows.length; i++) {
      await processOneRow(page, rows[i], saveCount, ctx);
      processedCount++;
    }
    return { ok: true, logs, processedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : '자동 수집 실패';
    pushLog(ctx, 'next-row', '오류', undefined, message);
    return { ok: false, logs, processedCount, message };
  }
}
