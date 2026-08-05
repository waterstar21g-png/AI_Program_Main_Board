import type { BrowserContext, Locator, Page } from 'playwright';
import { ensureBulkCollectPage, getCollectBrowserContext, maximizePage, TMG_ADMIN_HOST } from '@/lib/product-data-collect/browser-session';
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

/** 망고 대량수집 창을 앞으로 — 팝업은 절대 강제 닫지 않음 */
async function focusMangoBulk(page: Page) {
  await page.bringToFront().catch(() => undefined);
  await maximizePage(page);
}

function externalPages(page: Page): Page[] {
  return page
    .context()
    .pages()
    .filter(p => p !== page && !p.isClosed() && !p.url().includes(TMG_ADMIN_HOST));
}

/**
 * 검색 팝업이 스스로 닫힐 때까지 대기 (강제 close 금지)
 * — 창 팝업이 없으면 모두저장 버튼이 보일 때 완료
 */
async function waitSearchPopupClosedNaturally(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 스스로 닫힘 대기', rowIndex);

  for (;;) {
    const extras = externalPages(page);
    if (extras.length > 0) {
      // 열린 외부 팝업이 모두 스스로 닫힐 때까지 대기
      await Promise.race(extras.map(p => p.waitForEvent('close').catch(() => undefined)));
      continue;
    }

    // 외부 팝업 없음 — 모두저장이 보이면 검색 완료
    if (await saveAllButton(page).first().isVisible().catch(() => false)) {
      pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 닫힘 — 완료', rowIndex);
      return;
    }

    // 팝업이 곧 열리거나 모두저장이 나타날 때까지
    await Promise.race([
      new Promise<void>(resolve => {
        const onPage = () => {
          page.context().off('page', onPage);
          resolve();
        };
        page.context().on('page', onPage);
      }),
      saveAllButton(page)
        .first()
        .waitFor({ state: 'visible' })
        .then(() => undefined)
        .catch(() => undefined),
    ]);
  }
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

/** 클릭 — 일반/force/JS 순으로 시도 */
async function hardClick(page: Page, locator: Locator) {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.waitFor({ state: 'visible' });
  try {
    await el.click({ timeout: 3000 });
    return;
  } catch {
    /* force */
  }
  try {
    await el.click({ force: true, timeout: 3000 });
    return;
  } catch {
    /* js */
  }
  await el.evaluate((node: HTMLElement) => {
    node.focus?.();
    node.click();
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
}

async function fastClick(page: Page, locator: Locator) {
  await hardClick(page, locator);
}

async function isSaveSettingsOpen(page: Page): Promise<boolean> {
  if (await saveSettingsTitle(page).isVisible().catch(() => false)) return true;
  if (await saveSettingsModal(page).isVisible().catch(() => false)) return true;
  return false;
}

async function waitSaveSettingsOpen(page: Page): Promise<void> {
  await Promise.race([
    saveSettingsTitle(page).waitFor({ state: 'visible' }),
    saveSettingsModal(page).waitFor({ state: 'visible' }),
    page.getByText('검색필터명').first().waitFor({ state: 'visible' }),
  ]);
}

/** 단계 로그만 남기고 즉시 실행 */
async function actStep(
  page: Page,
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  run: () => Promise<void>,
  rowIndex?: number,
  message?: string,
) {
  await page.bringToFront();
  pushLog(ctx, step, label, rowIndex, message);
  await run();
  pushLog(ctx, step, `${label} — 완료`, rowIndex, message);
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
  // 화면 문구: 「검색된 상품 모두저장」(띄어쓰기 없음)
  return page
    .locator('input[type="button"][value*="검색된"][value*="모두저장"]')
    .or(page.locator('input[type="submit"][value*="검색된"][value*="모두저장"]'))
    .or(page.locator('input[type="button"][value*="검색된"][value*="모두"][value*="저장"]'))
    .or(page.locator('a, button').filter({ hasText: /검색된\s*상품\s*모두\s*저장/ }))
    .or(page.getByRole('button', { name: /검색된\s*상품\s*모두\s*저장/ }));
}

function saveSettingsTitle(page: Page) {
  return page.getByText('상품저장설정', { exact: false }).first();
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
    pushLog(logCtx, 'open-page', '[1] 대량수집 메인 화면 확인', undefined, ready.url().split('?')[0]);
    return ready;
  }

  // 없으면 로그인→메뉴→대량수집까지 자동 진입
  pushLog(logCtx, 'open-page', '[0] 로그인·메뉴 자동 이동');
  const page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());
  await ensureBulkCollectPage(page);
  pushLog(logCtx, 'open-page', '[1] 대량수집 메인 화면 확인', undefined, page.url().split('?')[0]);
  return page;
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
  // 팝업 전체(하단 저장하기·취소하기 포함) — 안쪽 작은 div만 잡히지 않게
  return page
    .locator('div, form, table')
    .filter({ hasText: '상품저장설정' })
    .filter({ hasText: '저장하기' })
    .filter({ hasText: '취소하기' })
    .last();
}

function saveSubmitButton(page: Page) {
  const modal = saveSettingsModal(page);
  return modal
    .locator('input[type="button"][value="저장하기"], input[type="submit"][value="저장하기"]')
    .or(modal.locator('a, button, span, div').filter({ hasText: /^저장하기$/ }))
    .or(page.getByRole('button', { name: '저장하기' }))
    .or(page.locator('input[type="button"][value="저장하기"], input[type="submit"][value="저장하기"]'))
    .or(page.locator('a, button').filter({ hasText: /^저장하기$/ }));
}

/** 새 창 팝업 close 이벤트 캐치 — 미사용 경로 제거됨 */
function catchInPagePopupHidden(page: Page, skipContains = ''): Promise<void> {
  return page
    .evaluate(skip => {
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
    }, skipContains)
    .catch(() => undefined); // 네비게이션으로 context 파괴돼도 오류로 중단하지 않음
}

function isNavDestroyedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Execution context was destroyed|Target closed|navigation/i.test(msg);
}

/** 「검색된 상품 모두저장」 보이자마자 반환 — 불필요 대기 없음 */
async function waitSaveAllButtonVisible(page: Page): Promise<Locator> {
  const btn = saveAllButton(page).first();
  for (;;) {
    try {
      await btn.waitFor({ state: 'visible' });
      return btn;
    } catch (e) {
      if (isNavDestroyedError(e)) continue;
      throw e;
    }
  }
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

async function readInputValue(locator: Locator): Promise<string> {
  const el = locator.first();
  const tag = await el.evaluate(n => n.tagName.toLowerCase()).catch(() => '');
  if (tag === 'textarea' || tag === 'input') {
    return (await el.inputValue().catch(() => '')).trim();
  }
  return (await el.innerText().catch(() => '')).trim();
}

async function pasteUrl(page: Page, url: string, ctx: LogCtx, rowIndex: number) {
  const normalized = normalizeUrl(url);
  await page.bringToFront();
  const input = await findUrlInput(page);
  await pasteField(page, input, normalized);
  const fieldValue = (await readInputValue(input)) || normalized;
  pushLog(ctx, 'paste-url', '[2] URL 입력', rowIndex, fieldValue);
}

async function clickUrlSearchAndWaitPopup(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭', rowIndex);
  await focusMangoBulk(page);

  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭 — 완료', rowIndex);

  // 팝업이 스스로 닫힐 때까지 반드시 대기 → 그 다음 단계
  await waitSearchPopupClosedNaturally(page, ctx, rowIndex);
  await focusMangoBulk(page);
}

/** 팝업이 닫힌 뒤「모두저장」즉시 클릭 → 상품저장설정 모달 */
async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  // 남은 외부 팝업이 있으면 스스로 닫힐 때까지 대기
  const extras = externalPages(page);
  if (extras.length) {
    pushLog(ctx, 'wait-search-popup', '[3] 남은 팝업 스스로 닫힘 대기', rowIndex);
    while (externalPages(page).length) {
      const open = externalPages(page);
      await Promise.race(open.map(p => p.waitForEvent('close').catch(() => undefined)));
    }
  }

  await focusMangoBulk(page);
  pushLog(ctx, 'save-all', '[4] 모두저장 버튼 대기', rowIndex);
  const btn = await waitSaveAllButtonVisible(page);

  pushLog(ctx, 'save-all', '[4] 검색된 상품 모두저장 — 즉시 클릭', rowIndex);
  await btn.click({ force: true }).catch(async () => {
    await hardClick(page, btn);
  });

  await focusMangoBulk(page);
  pushLog(ctx, 'save-all', '[4] 상품저장설정 모달 대기', rowIndex);
  await waitSaveSettingsOpen(page);
  if (!(await isSaveSettingsOpen(page))) {
    await hardClick(page, saveAllButton(page));
    await waitSaveSettingsOpen(page);
  }
  if (!(await isSaveSettingsOpen(page))) {
    throw new Error(`#${rowIndex} 모두저장 클릭 후 상품저장설정 모달이 안 떴습니다.`);
  }
  await focusMangoBulk(page);
  pushLog(ctx, 'save-all', '[4] 상품저장설정 모달 열림', rowIndex);
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', '[5] 상품저장설정 (필터→상품수→저장)', async () => {
    pushLog(ctx, 'fill-save-form', '[5] 상품저장설정 모달 대기', rowIndex);
    await waitSaveSettingsOpen(page);
    const modal = saveSettingsModal(page);
    await modal.waitFor({ state: 'visible' });
    pushLog(ctx, 'fill-save-form', '[5] 상품저장설정 모달 표시됨', rowIndex);

    // 큰 부모 div가 잡히면 첫 input(=검색필터명)에 3이 덮어써짐 → tr 행 단위로만 찾음
    const filterRow = modal.locator('tr').filter({ hasText: '검색필터명' }).first();
    const filterInput = filterRow.locator('input[type="text"], input:not([type="hidden"])').first();
    await pasteField(page, filterInput, filterName);
    pushLog(ctx, 'fill-save-form', '[5] 검색필터명', rowIndex, filterName);

    const countRow = modal.locator('tr').filter({ hasText: '저장상품수' }).first();
    const countInput = countRow.locator('input[type="text"], input[type="number"], input:not([type="hidden"])').first();
    await pasteField(page, countInput, String(saveCount));
    pushLog(ctx, 'fill-save-form', '[5] 저장상품수', rowIndex, String(saveCount));

    // 필터명에 숫자가 들어갔으면 즉시 복구
    const filterNow = await readInputValue(filterInput);
    if (filterNow === String(saveCount) || /^\d+$/.test(filterNow)) {
      await pasteField(page, filterInput, filterName);
      pushLog(ctx, 'fill-save-form', '[5] 검색필터명 복구', rowIndex, filterName);
    }
  }, rowIndex);

  pushLog(ctx, 'fill-save-form', '[5] 저장하기 클릭', rowIndex);
  const saveBtn = saveSubmitButton(page).first();
  await saveBtn.waitFor({ state: 'visible' });
  await fastClick(page, saveBtn);
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
  await focusMangoBulk(page);
  await openBulkPage(page, ctx, rowIndex);
  await clearGrid(page, ctx, rowIndex);
  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);
  await clickUrlSearchAndWaitPopup(page, ctx, rowIndex);
  await clickSaveAll(page, ctx, rowIndex);
  await focusMangoBulk(page);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitSavePopupDone(page, ctx, rowIndex);
  await focusMangoBulk(page);
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
    await maximizePage(page);
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
