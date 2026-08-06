/**
 * 더망고 대량수집 — 요건 그대로
 *
 * 0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭
 * 1. URL상품검색하기 : 필드값 입력 후 클릭 -> 팝업창 없어질 때까지 대기
 * 2. 검색된 상품 모두저장 클릭 -> 팝업에서 검색필터명 입력 -> 저장하기 클릭
 * 3. 팝업창 없어질 때까지 대기
 * 4. -> 0. 초기화
 */
import type { Locator, Page } from 'playwright';
import {
  ensureCollectBrowserReady,
  refreshIfClosed,
  resetBulkCollectViaMenu,
  withNavRetry,
  TMG_ADMIN_HOST,
} from '@/lib/product-data-collect/browser-session';
import type {
  TmgCollectRequest,
  TmgCollectResult,
  TmgCollectRow,
  WorkflowStepId,
  WorkflowStepLog,
} from '@/lib/product-data-collect/types';

const POPUP_WAIT_MS = 600_000;
const MODAL_WAIT_MS = 180_000;

type Ctx = { logs: WorkflowStepLog[]; onLog?: (e: WorkflowStepLog) => void };

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function log(ctx: Ctx, step: WorkflowStepId, label: string, rowIndex?: number, message?: string) {
  const entry: WorkflowStepLog = { step, label, rowIndex, at: new Date().toISOString(), message };
  ctx.logs.push(entry);
  ctx.onLog?.(entry);
}

/* ── 팝업 ───────────────────────────────────────────────── */

/** 메인 탭 외에 열려 있는 팝업 창 (about:blank·관리자 페이지 제외) */
function popups(main: Page): Page[] {
  return main
    .context()
    .pages()
    .filter(p => {
      if (p === main || p.isClosed()) return false;
      try {
        const u = p.url();
        return !!u && u !== 'about:blank' && !u.includes(TMG_ADMIN_HOST);
      } catch {
        return false;
      }
    });
}

/**
 * 팝업이 스스로 닫힐 때까지 대기 — 절대 건드리지 않음
 *
 * graceMs: 클릭 직후 팝업이 뜨기까지 잠깐 기다리는 시간.
 * warnIfNeverOpened=true 이면 그 시간 동안 팝업이 단 한 번도 뜨지
 * 않았을 때 경고 로그를 남긴다(예: URL 검색 클릭이 안 먹혔을 때).
 *
 * 반환값: 팝업이 한 번이라도 열렸으면 true.
 */
async function waitPopupsGone(
  main: Page,
  ctx: Ctx,
  step: WorkflowStepId,
  rowIndex: number,
  graceMs = 2000,
  warnIfNeverOpened = false,
): Promise<boolean> {
  const end = Date.now() + POPUP_WAIT_MS;
  const graceEnd = Date.now() + graceMs;
  let everSeen = false;

  while (Date.now() < graceEnd) {
    if (popups(main).length > 0) {
      everSeen = true;
      break;
    }
    await sleep(200);
  }

  if (!everSeen) {
    if (warnIfNeverOpened) {
      log(ctx, step, '  [경고] 팝업이 뜨지 않음', rowIndex, '클릭이 제대로 안 됐거나 사이트가 응답하지 않았을 수 있음');
    }
    return false;
  }

  let beat = 0;
  while (popups(main).length > 0) {
    if (Date.now() > end) throw new Error(`#${rowIndex} 팝업창이 닫히지 않음`);
    if (Date.now() - beat > 10_000) {
      beat = Date.now();
      log(ctx, step, '팝업창 대기중…', rowIndex, `열린 팝업 ${popups(main).length}개`);
    }
    await Promise.race([
      ...popups(main).map(p => p.waitForEvent('close').catch(() => undefined)),
      sleep(1000),
    ]);
  }
  return true;
}

/* ── 입력 · 클릭 ────────────────────────────────────────── */

/** 망고 구형 input은 fill()이 안 먹는 경우가 많음 → 클릭 후 직접 입력 */
async function typeInto(page: Page, loc: Locator, value: string) {
  const el = loc.first();
  await el.waitFor({ state: 'attached', timeout: 60_000 });
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.click({ timeout: 15_000 }).catch(() => undefined);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(value);

  let got = await el.inputValue().catch(() => '');
  if (!got.trim()) {
    await el.evaluate((n, v) => {
      if (n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement) {
        n.focus();
        n.value = v;
        n.dispatchEvent(new Event('input', { bubbles: true }));
        n.dispatchEvent(new Event('change', { bubbles: true }));
        n.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        n.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, value);
    got = await el.inputValue().catch(() => '');
  }
  return got;
}

/**
 * 신뢰할 수 있는(trusted) 클릭을 우선 시도한다. el.evaluate(...node.click()...)
 * 같은 JS 강제클릭은 브라우저가 "진짜 사용자 클릭"으로 인정하지 않아,
 * 그 안에서 호출되는 window.open()(팝업)이 조용히 차단될 수 있다.
 * 반환값: 신뢰되는 클릭으로 처리됐으면 true.
 */
async function clickIt(loc: Locator): Promise<boolean> {
  const el = loc.first();
  await el.waitFor({ state: 'visible', timeout: 60_000 });
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  try {
    await el.click({ timeout: 20_000 });
    return true;
  } catch {
    /* fallthrough */
  }

  try {
    const box = await el.boundingBox();
    if (box) {
      await el.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      return true;
    }
  } catch {
    /* fallthrough */
  }

  await el.evaluate(n => (n as HTMLElement).click());
  return false;
}

/* ── 화면 요소 ──────────────────────────────────────────── */

function urlSearchButton(page: Page) {
  return page
    .locator('input[type="button"][value*="URL"], input[type="submit"][value*="URL"]')
    .filter({ hasNot: page.locator('[value*="초기화"]') })
    .or(page.locator('button:has-text("URL")'))
    .or(page.getByText(/URL\s*상품\s*검색/));
}

function saveAllButton(page: Page) {
  return page
    .locator('input[type="button"][value*="모두저장"]')
    .or(page.locator('input[type="submit"][value*="모두저장"]'))
    .or(page.locator('input[value*="모두"][value*="저장"]'))
    .or(page.locator('button:has-text("모두저장")'))
    .or(page.getByText(/검색된\s*상품\s*모두\s*저장/));
}

async function describeLocator(loc: Locator): Promise<string> {
  try {
    return await loc.evaluate(
      n =>
        `<${n.tagName.toLowerCase()} name=${(n as HTMLInputElement).name || ''} id=${n.id || ''} rows=${
          (n as HTMLTextAreaElement).rows || ''
        } value.len=${((n as HTMLInputElement).value || '').length}>`,
    );
  } catch {
    return '<알 수 없음>';
  }
}

/**
 * URL상품검색하기 버튼과 실제 입력칸이 서로 다른 <tr>/<table>에 있는
 * 화면이 있어(선택자가 넓으면 엉뚱한 textarea를 골라 "검색결과 없음"이
 * 나는 원인이 됨) 좁은 범위 -> 넓은 범위 순으로, 후보가 정확히 하나일
 * 때만 채택한다.
 */
async function urlInputOnce(page: Page): Promise<Locator> {
  const btn = urlSearchButton(page).first();

  // 1) 버튼과 같은 <tr> 안에서 우선 찾기 (가장 정확)
  const row = btn.locator('xpath=ancestor::tr[1]');
  if ((await row.count().catch(() => 0)) > 0) {
    for (const sel of ['textarea', 'input[type="text"]:not([name*="login"]):not([readonly])']) {
      const cand = row.locator(sel);
      if ((await cand.count().catch(() => 0)) > 0) {
        return cand.first();
      }
    }
  }

  // 2) 부모를 한 단계씩 올라가며(최대 4단계) 후보가 정확히 하나일 때만 채택
  let ancestor = btn;
  for (let i = 0; i < 4; i++) {
    ancestor = ancestor.locator('xpath=..');
    for (const sel of ['textarea', 'input[type="text"]:not([name*="login"]):not([readonly])']) {
      const cand = ancestor.locator(sel);
      if ((await cand.count().catch(() => 0)) === 1) {
        return cand.first();
      }
    }
  }

  // 3) 최후 수단: 페이지 전체에서 rows 속성이 가장 큰 textarea
  const allTa = page.locator('textarea');
  const n = await allTa.count().catch(() => 0);
  if (n === 1) return allTa.first();
  if (n > 1) {
    let bestIdx = 0;
    let bestRows = -1;
    for (let i = 0; i < n; i++) {
      const rowsAttr = await allTa.nth(i).getAttribute('rows').catch(() => null);
      const rowsVal = rowsAttr ? parseInt(rowsAttr, 10) || 1 : 1;
      if (rowsVal > bestRows) {
        bestRows = rowsVal;
        bestIdx = i;
      }
    }
    return allTa.nth(bestIdx);
  }

  throw new Error('URL 입력칸을 찾지 못했습니다');
}

async function urlInput(page: Page): Promise<Locator> {
  return withNavRetry(page, () => urlInputOnce(page));
}

function saveModal(page: Page) {
  return page
    .locator('div, form, table')
    .filter({ hasText: /상품\s*저장\s*설정|검색\s*필터\s*명/ })
    .filter({ hasText: /저장하기/ })
    .last();
}

async function saveModalVisible(page: Page) {
  return page
    .getByText(/상품\s*저장\s*설정/)
    .first()
    .isVisible()
    .catch(() => false);
}

function modalField(page: Page, label: RegExp) {
  const modal = saveModal(page);
  return modal
    .locator('tr, div, p, label')
    .filter({ hasText: label })
    .locator('input[type="text"], input:not([type]), input[type="number"]')
    .first();
}

const FILTER_NAME_LABEL = /검색\s*필터\s*명/;
const SAVE_COUNT_LABEL = /저장\s*상품\s*수|검색결과\s*상위/;

function normalizeUrl(raw: string) {
  const u = raw.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/* ── 0 ~ 4 ─────────────────────────────────────────────── */

async function step0Reset(page: Page, ctx: Ctx, rowIndex: number) {
  log(ctx, 'open-page', '0. 초기화 : 상품데이터수집 → 대량데이터수집', rowIndex);
  await resetBulkCollectViaMenu(page);
  await urlSearchButton(page).first().waitFor({ state: 'visible', timeout: 90_000 });
  await sleep(500);
}

async function step1Search(page: Page, ctx: Ctx, row: TmgCollectRow) {
  const url = normalizeUrl(row.finalCategoryUrl);

  log(ctx, 'paste-url', '1. 필드값 입력', row.rowIndex, url.slice(0, 120));
  const target = await urlInput(page);
  const actual = await typeInto(page, target, url);
  log(ctx, 'paste-url', '  입력칸 최종 값', row.rowIndex, actual.slice(0, 120));

  log(ctx, 'paste-url', '1. URL상품검색하기 클릭', row.rowIndex);
  const trusted = await clickIt(urlSearchButton(page));

  log(ctx, 'wait-search-popup', '1. 팝업창 없어질 때까지 대기', row.rowIndex);
  let opened = await waitPopupsGone(page, ctx, 'wait-search-popup', row.rowIndex, 15_000, true);

  if (!opened) {
    // 클릭이 신뢰되는 클릭이 아니었거나(JS 강제클릭), 사이트가 늦게
    // 반응하는 경우 — 키보드로 실제 클릭을 한 번 더 시도한다.
    log(ctx, 'wait-search-popup', '  키보드로 재시도 (Enter)', row.rowIndex);
    try {
      const btn = urlSearchButton(page).first();
      await btn.focus();
      await page.keyboard.press('Enter');
    } catch {
      /* ignore */
    }
    opened = await waitPopupsGone(page, ctx, 'wait-search-popup', row.rowIndex, 10_000, true);
  }

  if (!opened) {
    throw new Error(
      `#${row.rowIndex} URL상품검색하기 클릭 후 팝업이 뜨지 않음 (trusted_click=${trusted}) — 화면을 직접 확인해 주세요`,
    );
  }
  log(ctx, 'wait-search-popup', '1. 팝업창 닫힘', row.rowIndex);
}

async function step2SaveAll(page: Page, ctx: Ctx, row: TmgCollectRow, saveCount: number) {
  log(ctx, 'save-all', '2. 검색된 상품 모두저장 클릭', row.rowIndex);
  await clickIt(saveAllButton(page));

  await saveModal(page).waitFor({ state: 'visible', timeout: MODAL_WAIT_MS });
  await sleep(400);

  log(ctx, 'fill-save-form', '2. 검색필터명 입력', row.rowIndex, row.topFinalLabel);
  await typeInto(page, modalField(page, FILTER_NAME_LABEL), row.topFinalLabel);

  const countField = modalField(page, SAVE_COUNT_LABEL);
  if (await countField.count().then(c => c > 0).catch(() => false)) {
    await typeInto(page, countField, String(saveCount));
    // 저장상품수 입력이 필터명을 덮는 화면이 있어 한 번 더 확인
    await typeInto(page, modalField(page, FILTER_NAME_LABEL), row.topFinalLabel);
  }

  log(ctx, 'fill-save-form', '2. 저장하기 클릭', row.rowIndex);
  await clickIt(
    saveModal(page)
      .locator('input[value*="저장하기"]')
      .or(saveModal(page).locator('button:has-text("저장하기")'))
      .or(saveModal(page).getByText(/^저장하기$/)),
  );
}

async function step3WaitSaveClosed(page: Page, ctx: Ctx, row: TmgCollectRow) {
  log(ctx, 'wait-save-popup', '3. 팝업창 없어질 때까지 대기', row.rowIndex);
  const end = Date.now() + MODAL_WAIT_MS;

  while (Date.now() < end) {
    if (!(await saveModalVisible(page))) {
      await waitPopupsGone(page, ctx, 'wait-save-popup', row.rowIndex, 500);
      log(ctx, 'wait-save-popup', '3. 팝업창 닫힘', row.rowIndex);
      return;
    }
    await sleep(500);
  }
  throw new Error(`#${row.rowIndex} 저장 팝업창이 닫히지 않음`);
}

async function processRow(page: Page, row: TmgCollectRow, saveCount: number, ctx: Ctx) {
  log(ctx, 'next-row', `━━ ${row.rowIndex}행 ━━`, row.rowIndex, row.topFinalLabel);
  await step0Reset(page, ctx, row.rowIndex);
  await step1Search(page, ctx, row);
  await step2SaveAll(page, ctx, row, saveCount);
  await step3WaitSaveClosed(page, ctx, row);
  log(ctx, 'next-row', '4. → 0. 초기화', row.rowIndex);
}

/* ── 실행 ──────────────────────────────────────────────── */

export async function runTmgCollectWorkflow(
  req: TmgCollectRequest,
  onLog?: (e: WorkflowStepLog) => void,
): Promise<TmgCollectResult> {
  const logs: WorkflowStepLog[] = [];
  const ctx: Ctx = { logs, onLog };
  const saveCount = req.saveCount ?? 3;
  const rows = req.rows.filter(r => r.finalCategoryUrl.trim());

  if (!rows.length) {
    return { ok: false, logs, processedCount: 0, message: '엑셀 행이 없습니다' };
  }

  let processedCount = 0;
  try {
    log(ctx, 'open-page', '브라우저 · 대량수집 화면 준비');
    const { context, page: initialPage } = await ensureCollectBrowserReady();
    let page = initialPage;
    page.setDefaultTimeout(120_000);

    for (let i = req.startRowIndex ?? 0; i < rows.length; i++) {
      page = refreshIfClosed(context, page);
      await processRow(page, rows[i], saveCount, ctx);
      processedCount++;
    }
    return { ok: true, logs, processedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : '실패';
    log(ctx, 'next-row', '오류', undefined, message);
    return { ok: false, logs, processedCount, message };
  }
}
