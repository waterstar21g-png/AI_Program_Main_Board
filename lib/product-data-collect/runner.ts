import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

/** 단계마다 화면에서 동작이 보이도록 대기(ms) */
const STEP_VISIBLE_MS = 1200;
const ACTION_SLOW_MO = 350;
const TMG_PROFILE_DIR = path.join(process.cwd(), '.local', 'tmg-chromium-profile');

const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
];

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

function isLoginPageUrl(url: string) {
  return url.includes('admin_login');
}

function isBulkCollectPageUrl(url: string) {
  return url.includes('getGoodsNew.php');
}

/** 로그인 화면이면 즉시 중단 — URL 붙여넣기가 아이디 칸에 들어가는 것 방지 */
async function assertNotOnLoginPage(page: Page, action: string) {
  if (isLoginPageUrl(page.url())) {
    throw new Error(`${action} 전에 로그인이 필요합니다. 로그인 ID/PW를 확인하세요.`);
  }
  const loginForm = page.locator('form#loginForm');
  if (await loginForm.isVisible().catch(() => false)) {
    throw new Error(`${action} 중 로그인 화면이 감지되었습니다. 로그인에 실패했습니다.`);
  }
}

/** 대량수집 페이지인지 확인 */
async function assertBulkCollectPage(page: Page) {
  await assertNotOnLoginPage(page, '대량수집');
  if (!isBulkCollectPageUrl(page.url())) {
    throw new Error(`대량수집 페이지가 아닙니다: ${page.url()}`);
  }
  await urlSearchButton(page).first().waitFor({ state: 'visible', timeout: 60000 });
}

async function assertLoggedIn(page: Page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => undefined);
  if (isLoginPageUrl(page.url())) {
    throw new Error('로그인에 실패했습니다. ID/PW를 확인하세요.');
  }
  const loginForm = page.locator('form#loginForm');
  if (await loginForm.isVisible().catch(() => false)) {
    throw new Error('로그인에 실패했습니다. 로그인 화면이 남아 있습니다.');
  }
}

/** 더망고 로그인 — UI에서 받은 id/pw만 사용 (망고 창에 직접 입력 불필요) */
async function typeIntoInput(page: Page, locator: Locator, value: string) {
  await locator.click();
  await locator.fill('');
  await locator.pressSequentially(value, { delay: 40 });
}

async function waitForRecaptcha(page: Page) {
  await page.waitForFunction(
    () => typeof (window as unknown as { grecaptcha?: { execute?: unknown } }).grecaptcha?.execute === 'function',
    { timeout: 30000 },
  ).catch(() => undefined);
}

/** 저장된 Chromium 세션이 있으면 로그인 생략 */
async function ensureLoggedIn(page: Page, id: string, pw: string, ctx: LogCtx) {
  pushLog(ctx, 'login', '저장된 로그인 세션 확인', undefined, '이전에 로그인한 적 있으면 자동 통과');
  await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);

  if (!isLoginPageUrl(page.url())) {
    try {
      await assertBulkCollectPage(page);
      pushLog(ctx, 'login', '세션 유효 — 로그인 생략', undefined, page.url());
      return;
    } catch {
      /* 세션 만료 → 로그인 진행 */
    }
  }

  await login(page, id, pw, ctx);
}

/** 더망고 로그인 페이지(admin_login.php) — reCAPTCHA v3 포함 폼 제출 */
async function login(page: Page, id: string, pw: string, ctx: LogCtx) {
  await actStep(page, ctx, 'login', '더망고 로그인 페이지 열기', async () => {
    await page.goto(TMG_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('form#loginForm').waitFor({ state: 'visible', timeout: 30000 });
    await waitForRecaptcha(page);
  });

  await actStep(page, ctx, 'login', `아이디 자동 입력: ${id}`, async () => {
    const idInput = page.locator('form#loginForm input[name="login_id"]');
    await highlight(page, idInput);
    await typeIntoInput(page, idInput, id);
    const filled = await idInput.inputValue();
    if (filled !== id) {
      throw new Error(`아이디 자동 입력 실패 (화면값: ${filled.slice(0, 30)})`);
    }
  });

  await actStep(page, ctx, 'login', '비밀번호 자동 입력', async () => {
    const pwInput = page.locator('form#loginForm input[name="login_pass"]');
    await highlight(page, pwInput);
    await typeIntoInput(page, pwInput, pw);
    const len = (await pwInput.inputValue()).length;
    if (len !== pw.length) {
      throw new Error('비밀번호 자동 입력 실패 — 길이가 맞지 않습니다.');
    }
  });

  await actStep(page, ctx, 'login', '로그인 버튼 클릭', async () => {
    const submit = page.locator('form#loginForm button[type="submit"]');
    await highlight(page, submit);
    await waitForRecaptcha(page);
    await submit.click();
    await page.waitForURL(url => !url.pathname.includes('admin_login'), { timeout: 120000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => undefined);
    await assertLoggedIn(page);
  });
}

async function openBulkPage(page: Page, ctx: LogCtx, rowIndex?: number) {
  await actStep(page, ctx, 'open-page', '상품데이터 대량수집 페이지 이동', async () => {
    await page.goto(TMG_BULK_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await assertBulkCollectPage(page);
  }, rowIndex);
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

/** URL상품검색하기 버튼 왼쪽 입력란 (로그인 폼 제외) */
async function findUrlInput(page: Page): Promise<Locator> {
  await assertBulkCollectPage(page);

  const btn = urlSearchButton(page).first();
  const nearBtn = btn.locator(
    'xpath=preceding::textarea[1]|preceding::input[@type="text"][not(@name="login_id")][1]',
  );
  if (await nearBtn.isVisible().catch(() => false)) return nearBtn;

  const nearClear = page
    .locator('input[type="button"][value="CLEAR"], a:has-text("CLEAR"), *:text-is("CLEAR")')
    .locator('xpath=following::textarea[1]|following::input[@type="text"][not(@name="login_id")][1]');
  if (await nearClear.first().isVisible().catch(() => false)) return nearClear.first();

  const textareas = page.locator('textarea:visible');
  const count = await textareas.count();
  if (count >= 2) return textareas.nth(1);
  if (count === 1) return textareas.first();

  throw new Error('대량수집 페이지에서 URL 입력란을 찾지 못했습니다. 로그인 상태를 확인하세요.');
}

function saveSettingsModal(page: Page) {
  return page.locator('body').locator('table, div, form').filter({ hasText: '상품저장설정' }).last();
}

async function clearGrid(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'clear-grid', 'URL 입력란 CLEAR', async () => {
    const clearBtn = page
      .locator('input[type="button"][value="CLEAR"]')
      .or(page.getByText(/^CLEAR$/i));
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
    const btn = urlSearchButton(page);
    const ok = await clickFirstVisible(page, [btn]);
    if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  }, rowIndex);
}

async function waitSearchPopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-search-popup', 'URL 검색 완료 대기', rowIndex);
  await pauseVisible(page, 1500);

  const popup = await page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
  if (popup) {
    await popup.waitForEvent('close', { timeout: 180000 }).catch(() => undefined);
    await popup.close().catch(() => undefined);
  }

  await saveAllButton(page).first().waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => undefined);

  pushLog(ctx, 'wait-search-popup', '검색 완료 — 저장 버튼 표시됨', rowIndex, page.url());
  await pauseVisible(page);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(page, ctx, 'save-all', '검색된 상품 모두 저장 클릭', async () => {
    const btn = saveAllButton(page);
    const ok = await clickFirstVisible(page, [btn]);
    if (!ok) throw new Error('검색된 상품 모두 저장 버튼을 찾지 못했습니다.');
    await saveSettingsModal(page).waitFor({ state: 'visible', timeout: 60000 });
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
    const modal = saveSettingsModal(page);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    const filterRow = modal.locator('tr, div').filter({ hasText: '검색필터명' }).first();
    const filterInput = filterRow.locator('input[type="text"]').first();
    await highlight(page, filterInput);
    await filterInput.fill(filterName);
    await pauseVisible(page, 600);

    const countRow = modal.locator('tr, div').filter({ hasText: /저장상품수|검색결과\s*상위/ }).first();
    const countInput = countRow.locator('input[type="text"], input[type="number"]').first();
    await highlight(page, countInput);
    await countInput.fill(String(saveCount));
    await pauseVisible(page, 600);

    const saveBtn = modal
      .locator('input[type="button"][value="저장하기"], input[type="submit"][value="저장하기"]')
      .or(modal.getByRole('button', { name: /^저장하기$/ }))
      .or(modal.getByText(/^저장하기$/, { exact: true }));
    const ok = await clickFirstVisible(page, [saveBtn]);
    if (!ok) throw new Error('상품저장설정 — 저장하기 버튼을 찾지 못했습니다.');
  }, rowIndex);
}

async function waitSavePopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '상품저장설정 팝업 종료 대기', rowIndex);
  await pauseVisible(page, 1000);
  await saveSettingsModal(page).waitFor({ state: 'hidden', timeout: 180000 }).catch(async () => {
    await page.locator('text=상품저장설정').waitFor({ state: 'hidden', timeout: 180000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => undefined);
  });
  pushLog(ctx, 'wait-save-popup', '저장 팝업 종료됨', rowIndex, page.url());
  await pauseVisible(page);
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
  await waitSearchPopupDone(page, ctx, rowIndex);
  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitSavePopupDone(page, ctx, rowIndex);
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
  if (/^https?:\/\//i.test(req.loginId.trim())) {
    return {
      ok: false,
      logs,
      processedCount: 0,
      message: '로그인 ID에 URL이 들어가 있습니다. 더망고 아이디(예: waterstar21)를 입력하세요.',
    };
  }
  if (!rows.length) {
    return { ok: false, logs, processedCount: 0, message: '처리할 엑셀 행이 없습니다.' };
  }

  const loginId = req.loginId.trim();
  const loginPw = req.loginPw.trim();
  pushLog(
    ctx,
    'login',
    'UI 입력값 → 망고 자동 입력',
    undefined,
    `아이디: ${loginId} — 망고 창에 직접 입력하지 마세요`,
  );

  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  const headless = req.headless ?? false;
  const context: BrowserContext = await chromium.launchPersistentContext(TMG_PROFILE_DIR, {
    headless,
    slowMo: ACTION_SLOW_MO,
    viewport: { width: 1400, height: 900 },
    args: CHROMIUM_ARGS,
  });

  let processedCount = 0;
  let ok = false;
  try {
    const page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(120000);

    await ensureLoggedIn(page, loginId, loginPw, ctx);

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
    const keepOpen = req.keepBrowserOpen ?? !headless;
    if (keepOpen) {
      pushLog(
        ctx,
        'next-row',
        'Chromium 창 유지',
        undefined,
        ok ? '완료 — 창을 직접 닫으세요' : '오류 확인 — 창을 직접 닫으세요',
      );
      await context.waitForEvent('close', { timeout: 1_800_000 }).catch(() => undefined);
    } else {
      await context.close().catch(() => undefined);
    }
  }
}
