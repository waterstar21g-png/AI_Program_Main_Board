import type { BrowserContext, Locator, Page } from 'playwright';
import { requireExistingBrowserContext } from '@/lib/product-data-collect/browser-session';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

/** 사람이 클릭하는 것처럼 — 망고 느린 UI에 맞춤 */
const STEP_PAUSE_MS = 2800;
const BEFORE_ACTION_MS = 1500;
const AFTER_ACTION_MS = 2200;
const TYPE_DELAY_MS = 90;
const CLICK_DELAY_MS = 200;

type LogCtx = {
  logs: WorkflowStepLog[];
  onLog?: (entry: WorkflowStepLog) => void;
};

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

async function humanWait(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

async function highlight(page: Page, locator: Locator) {
  try {
    const handle = await locator.first().elementHandle({ timeout: 8000 });
    if (!handle) return;
    await handle.evaluate(el => {
      const node = el as HTMLElement;
      node.style.outline = '3px solid #ef4444';
      node.style.outlineOffset = '2px';
      node.style.boxShadow = '0 0 14px rgba(239,68,68,0.75)';
    });
  } catch {
    /* skip */
  }
}

/** 한 단계 = 보기 → 동작 → 망고 응답 대기 */
async function actStep(
  page: Page,
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  run: () => Promise<void>,
  rowIndex?: number,
) {
  await page.bringToFront();
  pushLog(ctx, step, label, rowIndex, page.url());
  await humanWait(page, BEFORE_ACTION_MS);
  await run();
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => undefined);
  pushLog(ctx, step, `${label} — 완료`, rowIndex, page.url());
  await humanWait(page, STEP_PAUSE_MS);
}

async function humanClick(page: Page, locator: Locator) {
  const el = locator.first();
  await page.bringToFront();
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.hover().catch(() => undefined);
  await humanWait(page, BEFORE_ACTION_MS);
  await highlight(page, el);
  await humanWait(page, 800);
  await el.click({ delay: CLICK_DELAY_MS });
  await humanWait(page, AFTER_ACTION_MS);
}

async function humanType(page: Page, locator: Locator, text: string) {
  const el = locator.first();
  await page.bringToFront();
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.click();
  await humanWait(page, 600);
  await highlight(page, el);
  await el.fill('');
  await humanWait(page, 400);
  await el.pressSequentially(text, { delay: TYPE_DELAY_MS });
  await humanWait(page, AFTER_ACTION_MS);
}

async function clickFirstVisible(page: Page, locators: Locator[]) {
  for (const loc of locators) {
    if (await loc.first().isVisible().catch(() => false)) {
      await humanClick(page, loc);
      return true;
    }
  }
  return false;
}

function isBulkCollectPageUrl(url: string) {
  return url.includes('getGoodsNew.php');
}

async function assertBulkCollectPage(page: Page) {
  if (!isBulkCollectPageUrl(page.url())) {
    throw new Error(
      `대량수집 메인(getGoodsNew.php)이 아닙니다: ${page.url()}\n` +
        'Chromium에서 상품데이터 대량수집 화면으로 이동한 뒤 ② 수집 시작을 누르세요.',
    );
  }
  await urlSearchButton(page).first().waitFor({ state: 'visible', timeout: 90000 });
}

function urlSearchButton(page: Page) {
  return page
    .locator('input[type="button"][value*="URL"][value*="상품"][value*="검색"]')
    .or(page.locator('input[type="submit"][value*="URL"][value*="상품"][value*="검색"]'))
    .or(page.getByRole('button', { name: /URL\s*상품\s*검색/ }))
    .or(page.getByText(/URL\s*상품\s*검색하기/));
}

function saveAllButton(page: Page) {
  return page
    .locator('input[type="button"][value*="검색된"][value*="모두"]')
    .or(page.locator('input[type="submit"][value*="검색된"][value*="모두"]'))
    .or(page.getByRole('button', { name: /검색된\s*상품\s*모두\s*저장/ }))
    .or(page.getByText(/검색된\s*상품\s*모두\s*저장/));
}

/** URL상품검색하기 버튼과 같은 영역(행/블록) */
function urlSearchArea(page: Page) {
  const btn = urlSearchButton(page).first();
  return page.locator('tr, table, div').filter({ has: btn }).last();
}

async function findBulkReadyPage(context: BrowserContext): Promise<Page | null> {
  for (const p of context.pages()) {
    if (p.isClosed()) continue;
    if (isBulkCollectPageUrl(p.url())) {
      await p.bringToFront().catch(() => undefined);
      return p;
    }
  }
  for (const p of context.pages()) {
    if (p.isClosed()) continue;
    if (await urlSearchButton(p).first().isVisible().catch(() => false)) return p;
  }
  return null;
}

async function resolveBulkPageOrThrow(context: BrowserContext, logCtx: LogCtx): Promise<Page> {
  const ready = await findBulkReadyPage(context);
  if (ready) {
    await ready.bringToFront();
    pushLog(logCtx, 'open-page', '[1] 대량수집 메인 화면 확인', undefined, ready.url());
    return ready;
  }
  throw new Error(
    '대량수집 메인 화면(getGoodsNew.php)이 열려 있지 않습니다.\n' +
      '① Chromium 열기 → (직접) 상품데이터 대량수집 메인 진입 → ② 수집 시작',
  );
}

/** 우측 URL상품검색하기 버튼 좌측 입력 그리드 */
async function findUrlInput(page: Page): Promise<Locator> {
  await assertBulkCollectPage(page);
  const btn = urlSearchButton(page).first();
  const nearBtn = btn.locator(
    'xpath=preceding::textarea[1]|preceding::input[@type="text"][not(@name="login_id")][1]',
  );
  if (await nearBtn.isVisible().catch(() => false)) return nearBtn;

  const area = urlSearchArea(page);
  const inArea = area.locator('textarea:visible, input[type="text"]:visible').first();
  if (await inArea.isVisible().catch(() => false)) return inArea;

  const textareas = page.locator('textarea:visible');
  const count = await textareas.count();
  if (count >= 2) return textareas.nth(1);
  if (count === 1) return textareas.first();
  throw new Error('URL상품검색하기 좌측 입력 그리드를 찾지 못했습니다.');
}

/** 입력 그리드 근처 CLEAR 버튼 */
async function findClearButton(page: Page): Promise<Locator | null> {
  const btn = urlSearchButton(page).first();
  const nearInput = btn.locator('xpath=preceding::input[@type="button"][contains(@value,"CLEAR")][1]');
  if (await nearInput.isVisible().catch(() => false)) return nearInput;

  const area = urlSearchArea(page);
  const inArea = area.locator('input[type="button"][value*="CLEAR"], input[type="button"][value="CLEAR"]');
  if (await inArea.first().isVisible().catch(() => false)) return inArea.first();

  return null;
}

function saveSettingsModal(page: Page) {
  return page.locator('body').locator('table, div, form').filter({ hasText: '상품저장설정' }).last();
}

/** [1] 대량수집 메인 — 이미 열린 화면에서만 확인, 이동·새탭 없음 */
async function openBulkPage(page: Page, ctx: LogCtx, rowIndex?: number) {
  await actStep(page, ctx, 'open-page', '[1] 상품데이터 대량수집 메인 확인', async () => {
    await assertBulkCollectPage(page);
  }, rowIndex);
}

/** [2-1] 입력 그리드 CLEAR */
async function clearGrid(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'clear-grid', '[2] 입력 그리드 CLEAR', async () => {
    const clearBtn = await findClearButton(page);
    if (clearBtn) {
      await humanClick(page, clearBtn);
    } else {
      const input = await findUrlInput(page);
      await humanType(page, input, '');
    }
  }, rowIndex);
}

/** [2-2] 최종 카테고리 URL주소 붙여넣기 */
async function pasteUrl(page: Page, url: string, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'paste-url', '[2] 최종 카테고리 URL주소 입력', async () => {
    const input = await findUrlInput(page);
    await humanType(page, input, url);
  }, rowIndex);
}

/** [2-3] URL상품검색하기 클릭 + [3] 팝업 종료 대기 (클릭 전에 팝업 리스너 등록) */
async function clickUrlSearchAndWaitPopup(page: Page, ctx: LogCtx, rowIndex: number) {
  await page.bringToFront();
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭', rowIndex, page.url());
  await humanWait(page, BEFORE_ACTION_MS);

  const popupPromise = page.waitForEvent('popup', { timeout: 300000 }).catch(() => null);

  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');

  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭 — 완료', rowIndex);
  await humanWait(page, STEP_PAUSE_MS);

  pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 종료 대기', rowIndex, '망고 속도에 맞춰 대기');
  await humanWait(page, STEP_PAUSE_MS);

  const popup = await popupPromise;
  if (popup) {
    await popup.waitForEvent('close', { timeout: 300000 }).catch(() => undefined);
  }

  await saveAllButton(page).first().waitFor({ state: 'visible', timeout: 300000 });
  await page.waitForLoadState('networkidle', { timeout: 300000 }).catch(() => undefined);

  pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 종료 — 완료', rowIndex);
  await humanWait(page, STEP_PAUSE_MS);
}

/** [4] 검색된 상품 모두 저장 */
async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'save-all', '[4] 검색된 상품 모두 저장 클릭', async () => {
    const ok = await clickFirstVisible(page, [saveAllButton(page)]);
    if (!ok) throw new Error('검색된 상품 모두 저장 버튼을 찾지 못했습니다.');
    await saveSettingsModal(page).waitFor({ state: 'visible', timeout: 90000 });
  }, rowIndex);
}

/** [5] 상품저장설정 — 저장상품수(검색결과상위) 먼저, 검색필터명 다음, 저장하기 */
async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', '[5] 상품저장설정 입력', async () => {
    const modal = saveSettingsModal(page);
    await modal.waitFor({ state: 'visible', timeout: 60000 });

    const countInput = modal
      .locator('tr, div')
      .filter({ hasText: /검색결과\s*상위/ })
      .first()
      .locator('input')
      .first();
    await humanType(page, countInput, String(saveCount));

    const filterInput = modal
      .locator('tr, div')
      .filter({ hasText: '검색필터명' })
      .first()
      .locator('input')
      .first();
    await humanType(page, filterInput, filterName);

    const saveBtn = modal
      .locator('input[type="button"][value="저장하기"], input[type="submit"][value="저장하기"]')
      .or(modal.getByText(/^저장하기$/));
    const ok = await clickFirstVisible(page, [saveBtn]);
    if (!ok) throw new Error('저장하기 버튼을 찾지 못했습니다.');
  }, rowIndex);
}

/** [6] 저장 팝업 닫힐 때까지 대기 */
async function waitSavePopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '[6] 저장 팝업 종료 대기', rowIndex, '망고 속도에 맞춰 대기');
  await humanWait(page, STEP_PAUSE_MS);
  await saveSettingsModal(page).waitFor({ state: 'hidden', timeout: 300000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 300000 }).catch(() => undefined);
  pushLog(ctx, 'wait-save-popup', '[6] 저장 팝업 종료 — 완료', rowIndex);
  await humanWait(page, STEP_PAUSE_MS);
}

/** [7~8] 엑셀 행 1건: 1~6 반복 */
async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  ctx: LogCtx,
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  pushLog(ctx, 'next-row', `━━━ 엑셀 #${rowIndex} 행 (1~6 반복) ━━━`, rowIndex);
  await openBulkPage(page, ctx, rowIndex);
  await clearGrid(page, ctx, rowIndex);
  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);
  await clickUrlSearchAndWaitPopup(page, ctx, rowIndex);
  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitSavePopupDone(page, ctx, rowIndex);
  pushLog(ctx, 'next-row', `#${rowIndex} 행 완료 → 다음 행`, rowIndex);
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
    '메인 진입 후 1~6단계 시작',
    undefined,
    '로그인 제외 · getGoodsNew.php · 망고 속도',
  );

  const context = await requireExistingBrowserContext();

  let processedCount = 0;
  const headless = req.headless ?? false;
  try {
    const page = await resolveBulkPageOrThrow(context, ctx);
    page.setDefaultTimeout(180000);

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
  } finally {
    if (req.keepBrowserOpen ?? !headless) {
      pushLog(ctx, 'next-row', 'Chromium 유지', undefined, '창을 직접 닫으세요');
    }
  }
}
