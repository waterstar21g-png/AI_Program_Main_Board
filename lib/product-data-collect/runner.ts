import { chromium, type Locator, type Page } from 'playwright';
import { TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

/** 단계마다 화면에서 동작이 보이도록 대기(ms) */
const STEP_VISIBLE_MS = 1200;
const ACTION_SLOW_MO = 350;

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

async function pauseVisible(page: Page, ms = STEP_VISIBLE_MS) {
  await page.waitForTimeout(ms);
}

/** 클릭/입력 대상을 빨간 테두리로 표시 */
async function highlight(page: Page, locator: Locator) {
  try {
    const handle = await locator.first().elementHandle({ timeout: 5000 });
    if (!handle) return;
    await handle.evaluate(el => {
      const node = el as HTMLElement;
      node.style.outline = '3px solid #ef4444';
      node.style.outlineOffset = '2px';
      node.style.boxShadow = '0 0 12px rgba(239,68,68,0.6)';
    });
  } catch {
    /* 요소 없으면 스킵 */
  }
}

async function actStep(
  page: Page,
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  run: () => Promise<void>,
  rowIndex?: number,
) {
  pushLog(ctx, step, label, rowIndex, page.url());
  await pauseVisible(page, 400);
  await run();
  pushLog(ctx, step, `${label} — 완료`, rowIndex, page.url());
  await pauseVisible(page);
}

async function fillFirstVisible(page: Page, selectors: string[], value: string) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.scrollIntoViewIfNeeded().catch(() => undefined);
      await highlight(page, loc);
      await pauseVisible(page, 500);
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

async function clickFirstVisible(page: Page, locators: Locator[]) {
  for (const loc of locators) {
    if (await loc.first().isVisible().catch(() => false)) {
      await loc.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await highlight(page, loc);
      await pauseVisible(page, 500);
      await loc.first().click();
      return true;
    }
  }
  return false;
}

async function login(page: Page, id: string, pw: string, ctx: LogCtx) {
  await actStep(page, ctx, 'login', '더망고 로그인 페이지 열기', async () => {
    await page.goto(TMG_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  await actStep(page, ctx, 'login', '로그인 ID 입력', async () => {
    const ok = await fillFirstVisible(page, [
      'input[name="mall_id"]',
      'input[name="login_id"]',
      'input[name="m_id"]',
      '#mall_id',
      'input[type="text"]',
    ], id);
    if (!ok) throw new Error('ID 입력칸을 찾지 못했습니다.');
  });

  await actStep(page, ctx, 'login', '로그인 PW 입력', async () => {
    const ok = await fillFirstVisible(page, [
      'input[name="mall_passwd"]',
      'input[name="login_pw"]',
      '#mall_passwd',
      'input[type="password"]',
    ], pw);
    if (!ok) throw new Error('PW 입력칸을 찾지 못했습니다.');
  });

  await actStep(page, ctx, 'login', '로그인 버튼 클릭', async () => {
    const ok = await clickFirstVisible(page, [
      page.getByRole('button', { name: /로그인|login/i }),
      page.locator('input[type="submit"]'),
      page.locator('button[type="submit"]'),
      page.locator('a.login, .btn_login'),
    ]);
    if (!ok) throw new Error('로그인 버튼을 찾지 못했습니다.');
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => undefined);
  });
}

async function openBulkPage(page: Page, ctx: LogCtx, rowIndex?: number) {
  await actStep(page, ctx, 'open-page', '상품데이터 대량수집 페이지 이동', async () => {
    await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }, rowIndex);
}

async function findUrlInput(page: Page) {
  const nearClear = page.getByRole('button', { name: /CLEAR/i }).locator('xpath=preceding::textarea[1]');
  if (await nearClear.isVisible().catch(() => false)) return nearClear;

  const textarea = page.locator('textarea').first();
  if (await textarea.isVisible().catch(() => false)) return textarea;

  return page.locator('textarea, input[type="text"]').first();
}

async function clearGrid(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'clear-grid', '입력 그리드 CLEAR', async () => {
    const clearBtn = page.getByRole('button', { name: /^CLEAR$/i }).or(page.getByText(/^CLEAR$/i));
    if (await clearBtn.first().isVisible().catch(() => false)) {
      await highlight(page, clearBtn);
      await pauseVisible(page, 500);
      await clearBtn.first().click();
    } else {
      const input = await findUrlInput(page);
      await highlight(page, input);
      await input.fill('');
    }
  }, rowIndex);
}

async function pasteUrl(page: Page, url: string, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'paste-url', `URL 붙여넣기: ${url.slice(0, 50)}…`, async () => {
    const input = await findUrlInput(page);
    await highlight(page, input);
    await pauseVisible(page, 500);
    await input.fill(url);
  }, rowIndex);
}

async function clickUrlSearch(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'url-search', 'URL상품검색하기 클릭', async () => {
    const btn = page
      .getByRole('button', { name: /URL상품검색하기/ })
      .or(page.getByText('URL상품검색하기'));
    await highlight(page, btn);
    await pauseVisible(page, 500);
    await btn.first().click();
  }, rowIndex);
}

async function waitPopupDone(page: Page, ctx: LogCtx, step: WorkflowStepLog['step'], rowIndex: number) {
  pushLog(ctx, step, '팝업 종료 대기 (화면 확인)', rowIndex);
  await pauseVisible(page, 1500);
  const dialog = page.locator('.layer, .popup, [role="dialog"], .modal, #layer');
  await dialog.first().waitFor({ state: 'hidden', timeout: 180000 }).catch(async () => {
    await page.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => undefined);
  });
  pushLog(ctx, step, '팝업 종료됨', rowIndex, page.url());
  await pauseVisible(page);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'save-all', '검색된 상품 모두 저장 클릭', async () => {
    const btn = page
      .getByRole('button', { name: /검색된 상품 모두 저장/ })
      .or(page.getByText('검색된 상품 모두 저장'));
    await highlight(page, btn);
    await pauseVisible(page, 500);
    await btn.first().click();
  }, rowIndex);
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', `저장상품수 ${saveCount} · 검색필터명 입력`, async () => {
    const countLabel = page.getByText(/검색결과상위/);
    const countInput = countLabel.locator('xpath=following::input[1]').or(page.locator('input').nth(0));
    await highlight(page, countInput);
    await countInput.first().fill(String(saveCount));
    await pauseVisible(page, 600);

    const filterLabel = page.getByText(/검색필터명/);
    const filterInput = filterLabel.locator('xpath=following::input[1]').or(page.locator('input[type="text"]').last());
    await highlight(page, filterInput);
    await filterInput.first().fill(filterName);
    await pauseVisible(page, 600);

    const saveBtn = page
      .getByRole('button', { name: /^저장하기$/ })
      .or(page.getByText(/^저장하기$/));
    await highlight(page, saveBtn);
    await pauseVisible(page, 500);
    await saveBtn.first().click();
  }, rowIndex);
}

async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  ctx: LogCtx,
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  pushLog(ctx, 'next-row', `━━━ 엑셀 #${rowIndex} 행 시작 ━━━`, rowIndex);
  await openBulkPage(page, ctx, rowIndex);
  await clearGrid(page, ctx, rowIndex);
  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);
  await clickUrlSearch(page, ctx, rowIndex);
  await waitPopupDone(page, ctx, 'wait-search-popup', rowIndex);
  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitPopupDone(page, ctx, 'wait-save-popup', rowIndex);
  pushLog(ctx, 'next-row', `엑셀 #${rowIndex} 행 완료`, rowIndex);
}

export async function runTmgCollectWorkflow(
  req: TmgCollectRequest,
  onLog?: (entry: WorkflowStepLog) => void,
): Promise<TmgCollectResult> {
  const logs: WorkflowStepLog[] = [];
  const ctx: LogCtx = { logs, onLog };
  const saveCount = req.saveCount ?? 3;
  const rows = req.rows.filter(r => r.finalCategoryUrl.trim());

  if (!req.loginId?.trim() || !req.loginPw?.trim()) {
    return { ok: false, logs, processedCount: 0, message: '로그인 ID·PW를 입력하세요.' };
  }
  if (!rows.length) {
    return { ok: false, logs, processedCount: 0, message: '처리할 엑셀 행이 없습니다.' };
  }

  const browser = await chromium.launch({
    headless: req.headless ?? false,
    slowMo: ACTION_SLOW_MO,
  });

  let processedCount = 0;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewportSize({ width: 1400, height: 900 });

    await login(page, req.loginId.trim(), req.loginPw.trim(), ctx);

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
    await browser.close();
  }
}
