/**
 * 더망고 — 필드 넣고 · 버튼 누르고 · 팝업 기다리기
 *
 * 0. 상품데이터수집 → 대량데이터수집
 * 1. URL 입력 → URL상품검색하기 → 팝업 없어질 때까지
 * 2. 검색된 상품 모두저장 → 검색필터명 → 저장하기
 * 3. 팝업 없어질 때까지
 * 4. → 0
 */
import type { Locator, Page } from 'playwright';
import {
  ensureCollectBrowserReady,
  resetBulkCollectViaMenu,
  TMG_ADMIN_HOST,
} from '@/lib/product-data-collect/browser-session';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

type LogCtx = { logs: WorkflowStepLog[]; onLog?: (e: WorkflowStepLog) => void };

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function log(
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

function abcPopups(page: Page): Page[] {
  return page.context().pages().filter(p => {
    if (p === page || p.isClosed()) return false;
    try {
      const u = p.url();
      if (!u || u === 'about:blank' || u.includes(TMG_ADMIN_HOST)) return false;
      return /abcmart|a-rt\.com|pmode=mango|smode=search/i.test(u);
    } catch {
      return false;
    }
  });
}

async function waitAbcGone(page: Page, ms = 300_000) {
  const end = Date.now() + ms;
  while (abcPopups(page).length > 0) {
    if (Date.now() > end) throw new Error('ABC 팝업이 아직 안 닫힘');
    const open = abcPopups(page);
    await Promise.race([
      ...open.map(p => p.waitForEvent('close').catch(() => undefined)),
      sleep(1000),
    ]);
  }
}

async function isLoading(page: Page) {
  return page
    .evaluate(() =>
      /load\s*product|상품정보를\s*불러오는\s*중|잠시만\s*기다려/i.test(
        document.body?.innerText || '',
      ),
    )
    .catch(() => false);
}

async function hasResults(page: Page) {
  if (await page.getByText(/검색된\s*상품\s*[1-9]\d*/).first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/KRW\s*[\d,]+/).first().isVisible().catch(() => false);
}

async function noResults(page: Page) {
  return page
    .getByText(/검색하신\s*검색에\s*대한\s*검색결과가\s*없습니다|검색결과가\s*없습니다|검색된\s*상품\s*0\s*개/)
    .first()
    .isVisible()
    .catch(() => false);
}

async function saveModalOpen(page: Page) {
  return page.getByText('상품저장설정').first().isVisible().catch(() => false);
}

/**
 * 망고 구형 input — fill()이 안 먹는 경우가 많음
 * → 클릭 후 Ctrl+A + insertText (클립보드 없이)
 */
async function put(page: Page, loc: Locator, value: string) {
  const el = loc.first();
  await el.waitFor({ state: 'attached', timeout: 30_000 });
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  await el.click({ timeout: 10_000 }).catch(() => undefined);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(value);
  // 값 확인 — 비어 있으면 DOM 강제
  const got = await el.inputValue().catch(() => '');
  if (!got || !got.includes(value.slice(0, Math.min(20, value.length)))) {
    await el.evaluate((n, v) => {
      if (n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement) {
        n.focus();
        n.value = v;
        n.dispatchEvent(new Event('input', { bubbles: true }));
        n.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, value);
  }
}

async function press(page: Page, loc: Locator) {
  const el = loc.first();
  await el.waitFor({ state: 'visible', timeout: 30_000 });
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  try {
    await el.click({ timeout: 15_000 });
  } catch {
    await el.evaluate(n => (n as HTMLElement).click());
  }
}

function urlBtn(page: Page) {
  return page
    .locator('input[type="button"][value*="URL"][value*="검색"]')
    .or(page.locator('input[type="submit"][value*="URL"][value*="검색"]'))
    .or(page.getByText(/URL\s*상품\s*검색하기/));
}

function saveAllBtn(page: Page) {
  return page
    .locator('input[type="button"][value*="모두저장"]')
    .or(page.locator('input[type="submit"][value*="모두저장"]'))
    .or(page.getByText(/검색된\s*상품\s*모두\s*저장/));
}

async function urlInput(page: Page): Promise<Locator> {
  const btn = urlBtn(page).first();
  const area = page.locator('tr, table, div').filter({ has: btn }).last();
  const ta = area.locator('textarea');
  if ((await ta.count()) > 0) return ta.last();
  const inp = area.locator(
    'input[type="text"]:not([name="login_id"]):not([name="login_passwd"])',
  );
  if ((await inp.count()) > 0) return inp.last();
  throw new Error('URL 입력칸을 못 찾음');
}

async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  ctx: LogCtx,
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  const url = /^https?:\/\//i.test(finalCategoryUrl.trim())
    ? finalCategoryUrl.trim()
    : `https://${finalCategoryUrl.trim()}`;

  log(ctx, 'next-row', `━━━ #${rowIndex} ━━━`, rowIndex, topFinalLabel);

  // 0
  log(ctx, 'open-page', '[0] 초기화', rowIndex);
  if (abcPopups(page).length > 0) await waitAbcGone(page);
  await resetBulkCollectViaMenu(page);
  await urlBtn(page).first().waitFor({ state: 'visible', timeout: 60_000 });
  await sleep(500);

  // 1
  log(ctx, 'paste-url', '[1] URL 입력', rowIndex, url.slice(0, 100));
  if (abcPopups(page).length > 0) await waitAbcGone(page);
  await put(page, await urlInput(page), url);
  log(ctx, 'url-search', '[1] URL상품검색하기 클릭', rowIndex);
  await press(page, urlBtn(page));

  log(ctx, 'wait-search-popup', '[1] 팝업/로딩 대기 (미터치)', rowIndex);
  const end1 = Date.now() + 300_000;
  let emptyAt = 0;
  let lastBeat = 0;
  let ok = false;

  while (Date.now() < end1) {
    const pops = abcPopups(page).length;
    const loading = await isLoading(page);

    if (Date.now() - lastBeat > 8_000) {
      lastBeat = Date.now();
      log(
        ctx,
        'wait-search-popup',
        '[1] 대기중…',
        rowIndex,
        `popup=${pops} loading=${loading} results=${await hasResults(page)}`,
      );
    }

    if (pops > 0 || loading) {
      emptyAt = 0;
      if (pops > 0) await waitAbcGone(page, Math.min(30_000, end1 - Date.now())).catch(() => undefined);
      await sleep(800);
      continue;
    }

    if (await hasResults(page)) {
      log(ctx, 'wait-search-popup', '[1] 검색결과 OK', rowIndex);
      ok = true;
      break;
    }

    if (await noResults(page)) {
      if (!emptyAt) emptyAt = Date.now();
      if (Date.now() - emptyAt >= 4000) {
        log(ctx, 'next-row', `[4] #${rowIndex} 결과없음 → 다음`, rowIndex);
        return;
      }
    } else {
      emptyAt = 0;
    }
    await sleep(600);
  }
  if (!ok) throw new Error(`#${rowIndex} [1] 검색 대기 시간 초과`);

  // 2
  log(ctx, 'save-all', '[2] 검색된 상품 모두저장', rowIndex);
  if (abcPopups(page).length > 0) await waitAbcGone(page);
  await press(page, saveAllBtn(page));

  const modal = page
    .locator('div, form, table')
    .filter({ hasText: '상품저장설정' })
    .filter({ hasText: '저장하기' })
    .last();
  await modal.waitFor({ state: 'visible', timeout: 90_000 });
  await sleep(400);

  log(ctx, 'fill-save-form', '[2] 검색필터명', rowIndex, topFinalLabel);
  await put(
    page,
    modal.locator('tr').filter({ hasText: '검색필터명' }).locator('input').first(),
    topFinalLabel,
  );
  await put(
    page,
    modal.locator('tr').filter({ hasText: '저장상품수' }).locator('input').first(),
    String(saveCount),
  );
  // 필터명 다시 확인 (상품수가 덮어쓴 경우)
  await put(
    page,
    modal.locator('tr').filter({ hasText: '검색필터명' }).locator('input').first(),
    topFinalLabel,
  );

  log(ctx, 'fill-save-form', '[2] 저장하기', rowIndex);
  await press(
    page,
    modal.locator('input[value="저장하기"]').or(modal.getByText(/^저장하기$/)).first(),
  );

  // 3
  log(ctx, 'wait-save-popup', '[3] 저장 팝업 대기', rowIndex);
  const end3 = Date.now() + 180_000;
  while (Date.now() < end3) {
    if (!(await saveModalOpen(page))) {
      log(ctx, 'wait-save-popup', '[3] 팝업 종료', rowIndex);
      break;
    }
    await sleep(500);
  }
  if (await saveModalOpen(page)) throw new Error(`#${rowIndex} [3] 저장 팝업 대기 초과`);

  log(ctx, 'next-row', `[4] #${rowIndex} 완료 → 0`, rowIndex);
}

export async function runTmgCollectWorkflow(
  req: TmgCollectRequest,
  onLog?: (e: WorkflowStepLog) => void,
): Promise<TmgCollectResult> {
  const logs: WorkflowStepLog[] = [];
  const ctx: LogCtx = { logs, onLog };
  const saveCount = req.saveCount ?? 3;
  const rows = req.rows.filter(r => r.finalCategoryUrl.trim());
  if (!rows.length) return { ok: false, logs, processedCount: 0, message: '엑셀 행 없음' };

  log(ctx, 'open-page', '시작: 필드넣고 → 클릭 → 기다리기');

  let processedCount = 0;
  try {
    log(ctx, 'open-page', '브라우저·대량수집 화면 준비…');
    const { page } = await ensureCollectBrowserReady();
    page.setDefaultTimeout(120_000);
    log(ctx, 'open-page', '대량수집 화면 OK', undefined, page.url().split('?')[0]);

    for (let i = req.startRowIndex ?? 0; i < rows.length; i++) {
      await processOneRow(page, rows[i], saveCount, ctx);
      processedCount++;
    }
    return { ok: true, logs, processedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : '실패';
    log(ctx, 'next-row', '오류', undefined, message);
    return { ok: false, logs, processedCount, message };
  }
}
