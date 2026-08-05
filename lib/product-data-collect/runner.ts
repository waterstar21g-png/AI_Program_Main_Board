import { chromium, type Page } from 'playwright';
import { TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

function log(
  logs: WorkflowStepLog[],
  step: WorkflowStepLog['step'],
  label: string,
  rowIndex?: number,
  message?: string,
) {
  logs.push({ step, label, rowIndex, at: new Date().toISOString(), message });
}

async function login(page: Page, id: string, pw: string, logs: WorkflowStepLog[]) {
  log(logs, 'login', '더망고 로그인');
  await page.goto(TMG_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const idSel = [
    'input[name="login_id"]',
    'input[name="m_id"]',
    '#mall_id',
    'input[type="text"]',
  ];
  const pwSel = ['input[name="login_pw"]', 'input[name="m_passwd"]', '#mall_passwd', 'input[type="password"]'];

  for (const s of idSel) {
    if (await page.locator(s).first().isVisible().catch(() => false)) {
      await page.locator(s).first().fill(id);
      break;
    }
  }
  for (const s of pwSel) {
    if (await page.locator(s).first().isVisible().catch(() => false)) {
      await page.locator(s).first().fill(pw);
      break;
    }
  }

  const loginBtn = page.getByRole('button', { name: /로그인|login/i }).first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click();
  } else {
    await page.locator('input[type="submit"], button[type="submit"]').first().click();
  }
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => undefined);
}

async function openBulkPage(page: Page, logs: WorkflowStepLog[]) {
  log(logs, 'open-page', '상품데이터 대량수집 페이지 이동');
  await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

/** URL 입력 영역 (CLEAR 좌측 그리드) */
async function findUrlInput(page: Page) {
  const byLabel = page.locator('textarea, input[type="text"]').filter({
    has: page.locator('xpath=..'),
  });
  const textarea = page.locator('textarea').first();
  if (await textarea.isVisible().catch(() => false)) return textarea;

  const nearClear = page.getByRole('button', { name: /CLEAR/i }).locator('xpath=preceding::textarea[1]');
  if (await nearClear.isVisible().catch(() => false)) return nearClear;

  return byLabel.first();
}

async function clearGrid(page: Page, logs: WorkflowStepLog[], rowIndex: number) {
  log(logs, 'clear-grid', '입력 그리드 CLEAR', rowIndex);
  const clearBtn = page.getByRole('button', { name: /^CLEAR$/i }).or(page.getByText(/^CLEAR$/i));
  if (await clearBtn.first().isVisible().catch(() => false)) {
    await clearBtn.first().click();
  } else {
    const input = await findUrlInput(page);
    await input.fill('');
  }
}

async function pasteUrl(page: Page, url: string, logs: WorkflowStepLog[], rowIndex: number) {
  log(logs, 'paste-url', `URL 붙여넣기: ${url.slice(0, 60)}…`, rowIndex);
  const input = await findUrlInput(page);
  await input.fill(url);
}

async function clickUrlSearch(page: Page, logs: WorkflowStepLog[], rowIndex: number) {
  log(logs, 'url-search', 'URL상품검색하기 클릭', rowIndex);
  await page.getByRole('button', { name: /URL상품검색하기/ }).or(page.getByText('URL상품검색하기')).first().click();
}

async function waitPopupDone(page: Page, logs: WorkflowStepLog[], step: WorkflowStepLog['step'], rowIndex: number) {
  log(logs, step, '팝업 종료 대기', rowIndex);
  await page.waitForTimeout(1500);
  const dialog = page.locator('.layer, .popup, [role="dialog"], .modal, #layer');
  await dialog.first().waitFor({ state: 'hidden', timeout: 180000 }).catch(async () => {
    await page.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => undefined);
  });
}

async function clickSaveAll(page: Page, logs: WorkflowStepLog[], rowIndex: number) {
  log(logs, 'save-all', '검색된 상품 모두 저장', rowIndex);
  await page
    .getByRole('button', { name: /검색된 상품 모두 저장/ })
    .or(page.getByText('검색된 상품 모두 저장'))
    .first()
    .click();
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  logs: WorkflowStepLog[],
  rowIndex: number,
) {
  log(logs, 'fill-save-form', `저장상품수 ${saveCount}, 검색필터명: ${filterName}`, rowIndex);

  const countLabel = page.getByText(/검색결과상위/);
  const countInput = countLabel.locator('xpath=following::input[1]').or(page.locator('input').nth(0));
  await countInput.first().fill(String(saveCount));

  const filterLabel = page.getByText(/검색필터명/);
  const filterInput = filterLabel.locator('xpath=following::input[1]').or(page.locator('input[type="text"]').last());
  await filterInput.first().fill(filterName);

  await page
    .getByRole('button', { name: /^저장하기$/ })
    .or(page.getByText(/^저장하기$/))
    .first()
    .click();
}

async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  logs: WorkflowStepLog[],
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  await openBulkPage(page, logs);
  await clearGrid(page, logs, rowIndex);
  await pasteUrl(page, finalCategoryUrl, logs, rowIndex);
  await clickUrlSearch(page, logs, rowIndex);
  await waitPopupDone(page, logs, 'wait-search-popup', rowIndex);
  await clickSaveAll(page, logs, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, logs, rowIndex);
  await waitPopupDone(page, logs, 'wait-save-popup', rowIndex);
  log(logs, 'next-row', '행 처리 완료', rowIndex);
}

export async function runTmgCollectWorkflow(req: TmgCollectRequest): Promise<TmgCollectResult> {
  const logs: WorkflowStepLog[] = [];
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
    slowMo: 80,
  });

  let processedCount = 0;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);

    await login(page, req.loginId.trim(), req.loginPw.trim(), logs);

    const start = req.startRowIndex ?? 0;
    for (let i = start; i < rows.length; i++) {
      await processOneRow(page, rows[i], saveCount, logs);
      processedCount++;
    }

    return { ok: true, logs, processedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : '자동 수집 실패';
    logs.push({
      step: 'next-row',
      label: '오류',
      at: new Date().toISOString(),
      message,
    });
    return { ok: false, logs, processedCount, message };
  } finally {
    await browser.close();
  }
}
