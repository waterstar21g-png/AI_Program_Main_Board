import type { BrowserContext, Locator, Page } from 'playwright';
import { getOrOpenBrowserContext } from '@/lib/product-data-collect/browser-session';
import { TMG_BULK_URL } from '@/lib/product-data-collect/steps';
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

function isLoginPageUrl(url: string) {
  return url.includes('admin_login');
}

function isBulkCollectPageUrl(url: string) {
  return url.includes('getGoodsNew.php');
}

async function assertNotOnLoginPage(page: Page, action: string) {
  if (isLoginPageUrl(page.url())) {
    throw new Error(`${action} 전에 로그인이 필요합니다. ① Chromium 열기 후 로그인하세요.`);
  }
  const idInput = page.locator('input[name="login_id"]');
  if (await idInput.isVisible().catch(() => false)) {
    throw new Error(`${action} 중 로그인 화면입니다. 대량수집 화면으로 이동하세요.`);
  }
}

async function assertBulkCollectPage(page: Page) {
  await assertNotOnLoginPage(page, '대량수집');
  if (!isBulkCollectPageUrl(page.url())) {
    throw new Error(`대량수집 페이지가 아닙니다: ${page.url()}`);
  }
  await urlSearchButton(page).first().waitFor({ state: 'visible', timeout: 90000 });
}

function urlSearchButton(page: Page) {
  return page
    .locator('input[type="button"][value*="URL상품검색"]')
    .or(page.locator('input[type="submit"][value*="URL상품검색"]'))
    .or(page.getByRole('button', { name: /URL\s*상품\s*검색하기/ }))
    .or(page.getByText('URL상품검색하기', { exact: true }));
}

function saveAllButton(page: Page) {
  return page
    .locator('input[type="button"][value*="검색된 상품 모두 저장"]')
    .or(page.locator('input[type="submit"][value*="검색된 상품 모두 저장"]'))
    .or(page.getByRole('button', { name: /검색된 상품 모두 저장/ }))
    .or(page.getByText('검색된 상품 모두 저장', { exact: true }));
}

async function findBulkReadyPage(context: BrowserContext): Promise<Page | null> {
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
    pushLog(logCtx, 'open-page', '대량수집 화면 확인', undefined, ready.url());
    return ready;
  }
  throw new Error(
    '대량수집 화면이 아닙니다. ① Chromium 열기 → 로그인 → 대량수집 메뉴 → ② 수집 시작',
  );
}

async function findUrlInput(page: Page): Promise<Locator> {
  await assertBulkCollectPage(page);
  const btn = urlSearchButton(page).first();
  const nearBtn = btn.locator(
    'xpath=preceding::textarea[1]|preceding::input[@type="text"][not(@name="login_id")][1]',
  );
  if (await nearBtn.isVisible().catch(() => false)) return nearBtn;
  const textareas = page.locator('textarea:visible');
  const count = await textareas.count();
  if (count >= 2) return textareas.nth(1);
  if (count === 1) return textareas.first();
  throw new Error('URL 입력란을 찾지 못했습니다.');
}

function saveSettingsModal(page: Page) {
  return page.locator('body').locator('table, div, form').filter({ hasText: '상품저장설정' }).last();
}

async function openBulkPage(page: Page, ctx: LogCtx, rowIndex?: number) {
  await actStep(page, ctx, 'open-page', '대량수집 화면 확인', async () => {
    const onBulk =
      isBulkCollectPageUrl(page.url()) &&
      (await urlSearchButton(page).first().isVisible().catch(() => false));
    if (!onBulk) {
      await page.goto(TMG_BULK_URL, { waitUntil: 'networkidle', timeout: 120000 });
    }
    await assertBulkCollectPage(page);
  }, rowIndex);
}

async function clearGrid(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'clear-grid', 'URL 입력란 비우기', async () => {
    const clearBtn = page.locator('input[type="button"][value="CLEAR"]').or(page.getByText(/^CLEAR$/i));
    if (await clearBtn.first().isVisible().catch(() => false)) {
      await humanClick(page, clearBtn);
    } else {
      const input = await findUrlInput(page);
      await humanType(page, input, '');
    }
  }, rowIndex);
}

async function pasteUrl(page: Page, url: string, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'paste-url', `URL 입력: ${url.slice(0, 40)}…`, async () => {
    const input = await findUrlInput(page);
    await humanType(page, input, url);
  }, rowIndex);
}

async function clickUrlSearch(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'url-search', 'URL상품검색하기 클릭', async () => {
    const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
    if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  }, rowIndex);
}

async function waitSearchPopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-search-popup', '망고 검색 처리 대기', rowIndex, '느리게 진행됩니다');
  await humanWait(page, STEP_PAUSE_MS);
  const popup = await page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
  if (popup) {
    await popup.waitForEvent('close', { timeout: 300000 }).catch(() => undefined);
  }
  await saveAllButton(page).first().waitFor({ state: 'visible', timeout: 300000 });
  await page.waitForLoadState('networkidle', { timeout: 300000 }).catch(() => undefined);
  pushLog(ctx, 'wait-search-popup', '검색 완료', rowIndex);
  await humanWait(page, STEP_PAUSE_MS);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'save-all', '검색된 상품 모두 저장 클릭', async () => {
    const ok = await clickFirstVisible(page, [saveAllButton(page)]);
    if (!ok) throw new Error('검색된 상품 모두 저장 버튼을 찾지 못했습니다.');
    await saveSettingsModal(page).waitFor({ state: 'visible', timeout: 90000 });
  }, rowIndex);
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', '상품저장설정 입력', async () => {
    const modal = saveSettingsModal(page);
    await modal.waitFor({ state: 'visible', timeout: 60000 });

    const filterInput = modal.locator('tr, div').filter({ hasText: '검색필터명' }).first().locator('input').first();
    await humanType(page, filterInput, filterName);

    const countInput = modal
      .locator('tr, div')
      .filter({ hasText: /저장상품수|검색결과\s*상위/ })
      .first()
      .locator('input')
      .first();
    await humanType(page, countInput, String(saveCount));

    const saveBtn = modal
      .locator('input[type="button"][value="저장하기"], input[type="submit"][value="저장하기"]')
      .or(modal.getByText(/^저장하기$/));
    const ok = await clickFirstVisible(page, [saveBtn]);
    if (!ok) throw new Error('저장하기 버튼을 찾지 못했습니다.');
  }, rowIndex);
}

async function waitSavePopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '저장 처리 대기', rowIndex, '망고 속도에 맞춰 대기');
  await humanWait(page, STEP_PAUSE_MS);
  await saveSettingsModal(page).waitFor({ state: 'hidden', timeout: 300000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 300000 }).catch(() => undefined);
  pushLog(ctx, 'wait-save-popup', '저장 완료', rowIndex);
  await humanWait(page, STEP_PAUSE_MS);
}

async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  ctx: LogCtx,
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  pushLog(ctx, 'next-row', `━━━ 엑셀 #${rowIndex} 행 ━━━`, rowIndex);
  await openBulkPage(page, ctx, rowIndex);
  await clearGrid(page, ctx, rowIndex);
  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);
  await clickUrlSearch(page, ctx, rowIndex);
  await waitSearchPopupDone(page, ctx, rowIndex);
  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitSavePopupDone(page, ctx, rowIndex);
  pushLog(ctx, 'next-row', `#${rowIndex} 행 완료`, rowIndex);
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

  pushLog(ctx, 'open-page', '사람처럼 단계별 진행', undefined, '망고 속도 · 빨간 테두리 · 한 글자씩 입력');

  const headless = req.headless ?? false;
  const context = await getOrOpenBrowserContext(headless);

  let processedCount = 0;
  let ok = false;
  try {
    const page = await resolveBulkPageOrThrow(context, ctx);
    page.setDefaultTimeout(180000);

    const start = req.startRowIndex ?? 0;
    for (let i = start; i < rows.length; i++) {
      await processOneRow(page, rows[i], saveCount, ctx);
      processedCount++;
    }

    ok = true;
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
