import type { BrowserContext, Locator, Page } from 'playwright';
import { getCollectBrowserContext } from '@/lib/product-data-collect/browser-session';
import { TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

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

async function pasteField(page: Page, locator: Locator, text: string) {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.click({ force: true });
  if (!text) {
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    return;
  }
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await page.evaluate(async t => { await navigator.clipboard.writeText(t); }, text);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+v');
}

/** 클릭 즉시 */
async function fastClick(page: Page, locator: Locator) {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.click();
}

/** 단계 로그만 남기고 즉시 실행 */
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
  await run();
  pushLog(ctx, step, `${label} — 완료`, rowIndex);
}

async function clickFirstVisible(page: Page, locators: Locator[]) {
  for (const loc of locators) {
    if (await loc.first().isVisible().catch(() => false)) {
      await fastClick(page, loc);
      return true;
    }
  }
  return false;
}

function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function isBulkCollectPageUrl(url: string) {
  return url.includes('getGoodsNew.php');
}

async function assertBulkCollectPage(page: Page) {
  if (!isBulkCollectPageUrl(page.url())) {
    throw new Error(
      `대량수집 메인(getGoodsNew.php)이 아닙니다: ${page.url()}\n` +
        '① 메인 URL 열기 → 로그인 → ② 수집 시작',
    );
  }
  await urlSearchButton(page).first().waitFor({ state: 'visible' });
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
    '대량수집 메인(getGoodsNew.php)이 열려 있지 않습니다.\n' +
      '① 메인 URL 열기 → 로그인 → ② 수집 시작',
  );
}

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

/** 새 창 팝업 close 이벤트 캐치 */
function catchWindowPopupClose(page: Page): Promise<void> {
  return new Promise(resolve => {
    page.once('popup', async popup => {
      await popup.waitForEvent('close');
      resolve();
    });
  });
}

/** 화면 안 팝업/레이어가 DOM에서 사라질 때까지 (MutationObserver) */
function catchInPagePopupHidden(page: Page, skipContains = ''): Promise<void> {
  return page.evaluate(skip => {
    return new Promise<void>(resolve => {
      const isLayerVisible = () => {
        const nodes = document.querySelectorAll(
          '[role="dialog"], .ui-dialog, .modal, div[id*="layer"], div[id*="popup"], div[class*="layer"], div[class*="popup"]',
        );
        for (const el of nodes) {
          const node = el as HTMLElement;
          const style = window.getComputedStyle(node);
          const visible =
            style.display !== 'none' && style.visibility !== 'hidden' && node.offsetParent !== null;
          if (visible && !(skip && node.textContent?.includes(skip))) return true;
        }
        return false;
      };

      if (!isLayerVisible()) {
        resolve();
        return;
      }

      const obs = new MutationObserver(() => {
        if (!isLayerVisible()) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
    });
  }, skipContains);
}

/** [3] 검색 완료 대기 */
async function waitForSearchPopupClosed(page: Page, windowClosed: Promise<void>): Promise<void> {
  await Promise.race([
    windowClosed,
    catchInPagePopupHidden(page, '상품저장설정'),
    page.waitForFunction(() => {
      const text = document.body.innerText;
      if (text.includes('검색결과가 없습니다')) return true;
      if (text.includes('실시간 검색한 결과') && !text.includes('상품명 또는 검색 URL을 입력')) {
        return true;
      }
      return false;
    }),
  ]);
}

/** [6] 상품저장설정 팝업 닫힘 캐치 */
async function waitForSavePopupClosed(page: Page): Promise<void> {
  const modal = saveSettingsModal(page);
  if (await modal.isVisible().catch(() => false)) {
    await modal.waitFor({ state: 'hidden' });
    return;
  }
  await catchInPagePopupHidden(page, '');
}

async function openBulkPage(page: Page, ctx: LogCtx, rowIndex?: number) {
  await actStep(page, ctx, 'open-page', '[1] 상품데이터 대량수집 메인 확인', async () => {
    await assertBulkCollectPage(page);
  }, rowIndex);
}

async function clearGrid(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'clear-grid', '[2] 입력 그리드 CLEAR', async () => {
    const clearBtn = await findClearButton(page);
    if (clearBtn) {
      await fastClick(page, clearBtn);
    } else {
      const input = await findUrlInput(page);
      await pasteField(page, input, '');
    }
  }, rowIndex);
}

async function pasteUrl(page: Page, url: string, ctx: LogCtx, rowIndex: number) {
  const normalized = normalizeUrl(url);
  await actStep(page, ctx, 'paste-url', '[2] URL 붙여넣기', async () => {
    const input = await findUrlInput(page);
    await pasteField(page, input, normalized);
  }, rowIndex);
  pushLog(ctx, 'paste-url', '[2] URL', rowIndex, normalized);
}

async function clickUrlSearchAndWaitPopup(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭', rowIndex);
  const windowClosed = catchWindowPopupClose(page);
  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');

  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭 — 완료', rowIndex);
  pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 닫힘 감지', rowIndex);
  await waitForSearchPopupClosed(page, windowClosed);
  pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 닫힘 — 완료', rowIndex);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'save-all', '[4] 검색된 상품 모두 저장 클릭', async () => {
    const ok = await clickFirstVisible(page, [saveAllButton(page)]);
    if (!ok) throw new Error('검색된 상품 모두 저장 버튼을 찾지 못했습니다.');
    await saveSettingsModal(page).waitFor({ state: 'visible' });
  }, rowIndex);
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', '[5] 상품저장설정 입력 (즉시)', async () => {
    const modal = saveSettingsModal(page);
    await modal.waitFor({ state: 'visible' });

    const countInput = modal
      .locator('tr, div')
      .filter({ hasText: /검색결과\s*상위/ })
      .first()
      .locator('input')
      .first();
    await pasteField(page, countInput, String(saveCount));

    const filterInput = modal
      .locator('tr, div')
      .filter({ hasText: '검색필터명' })
      .first()
      .locator('input')
      .first();
    await pasteField(page, filterInput, filterName);
  }, rowIndex);

  pushLog(ctx, 'fill-save-form', '[5] 저장하기 클릭', rowIndex);
  const modal = saveSettingsModal(page);
  const saveBtn = modal
    .locator('input[type="button"][value="저장하기"], input[type="submit"][value="저장하기"]')
    .or(modal.getByText(/^저장하기$/));
  const ok = await clickFirstVisible(page, [saveBtn]);
  if (!ok) throw new Error('저장하기 버튼을 찾지 못했습니다.');
  pushLog(ctx, 'fill-save-form', '[5] 저장하기 클릭 — 완료', rowIndex);
}

async function waitSavePopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '[6] 저장 팝업 닫힘 감지', rowIndex);
  await waitForSavePopupClosed(page);
  pushLog(ctx, 'wait-save-popup', '[6] 저장 팝업 닫힘 — 완료', rowIndex);
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
  await clickUrlSearchAndWaitPopup(page, ctx, rowIndex);
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

  pushLog(ctx, 'open-page', '메인 화면 1~6단계', undefined, '입력·클릭 즉시 / 팝업 닫힘만 대기');

  const headless = req.headless ?? false;
  let processedCount = 0;

  try {
    pushLog(ctx, 'open-page', 'Chromium 연결', undefined, TMG_LOGIN_URL);
    const context = await getCollectBrowserContext();
    pushLog(ctx, 'open-page', 'Chromium 연결 — 완료', undefined, TMG_LOGIN_URL);

    const page = await resolveBulkPageOrThrow(context, ctx);
    page.setDefaultTimeout(0);

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
