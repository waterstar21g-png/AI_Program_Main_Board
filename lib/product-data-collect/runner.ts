/**
 * 더망고 대량수집 — 스크린샷 4화면 비교 → 값 입력 + 버튼 클릭만
 *
 * 새 창/탭 열지 않음 · 팝업/창순서 건드리지 않음
 *
 * A) 망고 대량수집 메인: URL 입력 → URL상품검색하기
 * B) ABC 팝업: 대기만
 * C) load product 로딩: 대기만
 * D) 상품저장설정: 검색필터명 → 저장하기
 */
import type { BrowserContext, Locator, Page } from 'playwright';
import {
  findBulkPage,
  getCollectBrowserContextForRun,
  resetBulkCollectViaMenu,
} from '@/lib/product-data-collect/browser-session';
import {
  abcPopupPages,
  detectMangoScreen,
  matchesBulkMainScreen,
  matchesLoadingScreen,
  matchesNoResults,
  matchesResultsReady,
  matchesSaveModal,
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
  bulk_main: 'A·대량수집메인',
  abc_popup: 'B·ABC팝업(대기)',
  loading: 'C·load product(대기)',
  results_ready: 'A·검색결과있음',
  save_modal: 'D·상품저장설정',
  no_results: 'A·검색결과없음',
  unknown: '?·알수없음',
};

async function logScreen(page: Page, ctx: LogCtx, rowIndex: number, note: string) {
  const s = await detectMangoScreen(page);
  pushLog(ctx, 'wait-search-popup', note, rowIndex, SCREEN_LABEL[s]);
  return s;
}

async function waitForScreens(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
  allowed: MangoScreen[],
  timeoutMs: number,
  beatSec = 10,
): Promise<MangoScreen> {
  const deadline = Date.now() + timeoutMs;
  let lastBeat = 0;
  while (Date.now() < deadline) {
    const s = await detectMangoScreen(page);
    if (allowed.includes(s)) {
      pushLog(ctx, 'wait-search-popup', '화면일치', rowIndex, SCREEN_LABEL[s]);
      return s;
    }
    if (Date.now() - lastBeat > beatSec * 1000) {
      lastBeat = Date.now();
      pushLog(
        ctx,
        'wait-search-popup',
        '화면대기…',
        rowIndex,
        `${SCREEN_LABEL[s]} → [${allowed.map(a => SCREEN_LABEL[a]).join('|')}]`,
      );
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
  const last = await detectMangoScreen(page);
  throw new Error(`#${rowIndex} 화면 대기 시간 초과 (현재=${SCREEN_LABEL[last]})`);
}

function setFieldValue(locator: Locator, text: string) {
  return locator.first().evaluate(
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

function domClick(locator: Locator) {
  return locator.first().evaluate(node => {
    const n = node as HTMLElement;
    n.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
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

/** 이미 열린 대량수집 탭만 사용 — 새 창/탭 금지 */
function requireBulkPage(context: BrowserContext, ctx: LogCtx): Page {
  const page = findBulkPage(context);
  if (!page) {
    throw new Error(
      '열려 있는 대량수집(getGoodsNew.php) 탭이 없습니다.\n' +
        '① Chromium 열기로 먼저 로그인·대량수집 화면을 연 뒤 ② 수집을 누르세요.',
    );
  }
  pushLog(ctx, 'open-page', '기존 탭 사용 (새 창 안 염)', undefined, page.url().split('?')[0]);
  return page;
}

/** [0] 스크린 A와 같으면 메뉴 클릭으로 초기화 (goto/새창 없음) */
async function step0Init(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'open-page', '[0] 초기화', rowIndex);
  if (!(await matchesBulkMainScreen(page))) {
    throw new Error(`#${rowIndex} [0] 대량수집 메인 화면이 아닙니다.`);
  }
  await resetBulkCollectViaMenu(page);
  await waitForScreens(page, ctx, rowIndex, ['bulk_main', 'results_ready'], 60_000);
  pushLog(ctx, 'open-page', '[0] 초기화 완료', rowIndex);
}

/** [1] 화면 A — URL 필드값 + URL상품검색하기 */
async function step1UrlSearch(page: Page, url: string, ctx: LogCtx, rowIndex: number) {
  await waitForScreens(page, ctx, rowIndex, ['bulk_main'], 60_000);
  const normalized = normalizeUrl(url);
  pushLog(ctx, 'paste-url', '[1] URL 입력', rowIndex, normalized);
  await setFieldValue(await findUrlInput(page), normalized);
  pushLog(ctx, 'url-search', '[1] URL상품검색하기 클릭', rowIndex);
  await domClick(urlSearchButton(page).first());
}

/** [1] 대기 — B(ABC팝업) / C(로딩) 끝날 때까지, 화면만 읽기 */
async function step1WaitCollect(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
): Promise<'products' | 'empty'> {
  pushLog(ctx, 'wait-search-popup', '[1] 수집 대기 (팝업·화면 미터치)', rowIndex);
  let emptySince = 0;
  const deadline = Date.now() + 300_000;

  while (Date.now() < deadline) {
    const s = await logScreen(page, ctx, rowIndex, '[1] 확인');

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

    if (s === 'results_ready') {
      pushLog(ctx, 'wait-search-popup', '[1] 검색결과 확인', rowIndex);
      return 'products';
    }

    if (s === 'no_results' && !(await matchesLoadingScreen(page))) {
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

  throw new Error(`#${rowIndex} [1] 수집 대기 시간 초과`);
}

/** [2] 화면 A 결과 — 모두저장 클릭 → D 모달 대기 */
async function step2SaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  await waitForScreens(page, ctx, rowIndex, ['results_ready'], 120_000);
  pushLog(ctx, 'save-all', '[2] 검색된 상품 모두저장 클릭', rowIndex);
  await domClick(saveAllButton(page).first());
  await waitForScreens(page, ctx, rowIndex, ['save_modal'], 90_000);
}

/** [2] 화면 D — 검색필터명 + 저장상품수 + 저장하기 */
async function step2FillSaveModal(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await waitForScreens(page, ctx, rowIndex, ['save_modal'], 30_000);
  const modal = saveSettingsModal(page);
  const filterInput = modal
    .locator('tr')
    .filter({ hasText: '검색필터명' })
    .locator('input')
    .first();
  const countInput = modal
    .locator('tr')
    .filter({ hasText: '저장상품수' })
    .locator('input')
    .first();

  pushLog(ctx, 'fill-save-form', '[2] 검색필터명 입력', rowIndex, filterName);
  await setFieldValue(filterInput, filterName);
  await setFieldValue(countInput, String(saveCount));

  pushLog(ctx, 'fill-save-form', '[2] 저장하기 클릭', rowIndex);
  await domClick(
    modal
      .locator('input[value="저장하기"], input[type="submit"][value="저장하기"]')
      .or(modal.getByText(/^저장하기$/))
      .first(),
  );
}

/** [3] D 모달 닫힐 때까지 */
async function step3WaitSaveDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '[3] 상품저장설정 닫힘 대기', rowIndex);
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

  await step0Init(page, ctx, rowIndex);
  await step1UrlSearch(page, finalCategoryUrl, ctx, rowIndex);
  const outcome = await step1WaitCollect(page, ctx, rowIndex);

  if (outcome === 'empty') {
    pushLog(ctx, 'next-row', `[4] #${rowIndex} 결과없음 → 다음 [0]`, rowIndex);
    return;
  }

  await step2SaveAll(page, ctx, rowIndex);
  await step2FillSaveModal(page, topFinalLabel, saveCount, ctx, rowIndex);
  await step3WaitSaveDone(page, ctx, rowIndex);
  pushLog(ctx, 'next-row', `[4] #${rowIndex} 완료 → 다음 [0]`, rowIndex);
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
    '4화면: A메인입력 → B/C대기 → A결과·모두저장 → D저장',
    undefined,
    '새 창 안 염 · 팝업 미터치 · 화면 비교 후 입력·클릭만',
  );

  let processedCount = 0;
  try {
    const browserCtx = await getCollectBrowserContextForRun();
    const page = requireBulkPage(browserCtx, ctx);
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
