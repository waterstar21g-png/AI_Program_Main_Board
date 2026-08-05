import type { BrowserContext, Locator, Page } from 'playwright';
import {
  ensureBulkCollectPage,
  getCollectBrowserContext,
  TMG_ADMIN_HOST,
} from '@/lib/product-data-collect/browser-session';
import { TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRequest, TmgCollectResult, WorkflowStepLog } from '@/lib/product-data-collect/types';

type LogCtx = {
  logs: WorkflowStepLog[];
  onLog?: (entry: WorkflowStepLog) => void;
};

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
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

/**
 * ABC/망고 검색 팝업만 (인위적으로 열거나/닫거나/포커스 금지)
 * ※ 예전 버그: about:blank 제외한 모든 외부창을 팝업으로 봐 무한대기 발생
 */
function isAbcSearchPopup(p: Page): boolean {
  try {
    const u = p.url();
    if (!u || u === 'about:blank') return false;
    if (u.includes(TMG_ADMIN_HOST)) return false;
    return (
      u.includes('pmode=mango') ||
      u.includes('smode=search') ||
      u.includes('abcmart.a-rt.com') ||
      /a-rt\.com\/display/i.test(u)
    );
  } catch {
    return false;
  }
}

function abcSearchPopups(page: Page): Page[] {
  return page
    .context()
    .pages()
    .filter(p => p !== page && !p.isClosed() && isAbcSearchPopup(p));
}

/** 2단계: 망고가 검색을 시작했는지 (URL 신호) */
function mangoSearchStarted(url: string): boolean {
  return url.includes('extension_search_key=') || url.includes('extension_check_search_url=');
}

/** 3단계: 모두저장 후 레이어 (#layer) */
function mangoSaveLayerOpen(url: string): boolean {
  return url.includes('#layer');
}

/** ABC 팝업이 모두 스스로 닫힐 때까지 — 팝업 강제종료/포커스 금지 */
async function waitAbcPopupsGoneNaturally(page: Page, deadlineMs: number): Promise<void> {
  while (abcSearchPopups(page).length > 0) {
    if (Date.now() >= deadlineMs) {
      throw new Error('ABC 검색 팝업이 시간 안에 닫히지 않았습니다. (강제 종료하지 않음)');
    }
    const open = abcSearchPopups(page);
    await Promise.race([
      ...open.map(p => p.waitForEvent('close').catch(() => undefined)),
      sleep(Math.min(2000, Math.max(200, deadlineMs - Date.now()))),
    ]);
  }
}

/** 망고 화면 읽기 전용 — 수집 중 UI (팝업/포커스 건드리지 않음) */
async function mangoIsCollecting(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const t = (document.body?.innerText || '').replace(/\s+/g, ' ');
      // 스크린샷의 빨간 "…중입니다" 상태
      return /중\s*입니다|수집\s*중|검색\s*중|상품\s*검색\s*중|기다려\s*주세요|Product\s*\.\./i.test(t);
    })
    .catch(() => false);
}

async function mangoSaveAllReady(page: Page): Promise<boolean> {
  return saveAllButton(page)
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * 2단계 완료 대기 (핵심)
 * - 팝업을 열거나/닫거나/포커스하지 않음
 * - Playwright가 ABC창을 못 볼 수 있음(확장) → 망고 화면「수집중」종료를 주 신호로 사용
 * - extension_search_key 만으로 조기 통과하지 않음 (그게 무한실패/조기클릭 원인)
 */
async function waitSearchFinished(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
  popupPromise: Promise<Page | null>,
) {
  pushLog(ctx, 'wait-search-popup', '[2] 망고 수집 완료 대기 (팝업 미터치)', rowIndex);

  const TOTAL_MS = 300_000;
  const deadline = Date.now() + TOTAL_MS;
  let sawPopup = false;
  let sawCollecting = false;
  let sawStart = mangoSearchStarted(page.url());
  let didSettle = false;
  let lastBeat = 0;

  // 팝업 promise는 백그라운드 소비 (여기서 await로 막지 않음)
  void popupPromise
    .then(p => {
      if (p && !p.isClosed() && isAbcSearchPopup(p)) sawPopup = true;
    })
    .catch(() => undefined);

  while (Date.now() < deadline) {
    const pops = abcSearchPopups(page);
    if (pops.length > 0) sawPopup = true;

    if (mangoSearchStarted(page.url())) sawStart = true;

    const collecting = await mangoIsCollecting(page);
    if (collecting) sawCollecting = true;

    // 진행 로그 (10초마다)
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      pushLog(
        ctx,
        'wait-search-popup',
        '[2] 대기중…',
        rowIndex,
        `start=${sawStart} popup=${sawPopup} collecting=${collecting} openPopups=${pops.length}`,
      );
    }

    // 팝업이 보이면: 닫힐 때까지 기다리기만 (건드리지 않음)
    if (pops.length > 0) {
      await Promise.race([
        ...pops.map(p => p.waitForEvent('close').catch(() => undefined)),
        sleep(1000),
      ]);
      continue;
    }

    // 완료: 검색시작 + 팝업없음 + 수집중 아님 + 모두저장 보임
    if (sawStart && pops.length === 0 && !collecting) {
      const ready = await mangoSaveAllReady(page);
      if (ready) {
        if (sawCollecting || sawPopup) {
          pushLog(ctx, 'wait-search-popup', '[2] 망고 수집 완료', rowIndex, 'popup/수집UI 종료');
          return;
        }
        // 팝업·수집UI를 못 본 경우: 한 번만 8초 안정 대기 후 재확인
        if (!didSettle) {
          didSettle = true;
          pushLog(ctx, 'wait-search-popup', '[2] 팝업 미감지 — 8초 안정 대기', rowIndex);
          await sleep(8_000);
          continue;
        }
        if (abcSearchPopups(page).length === 0 && !(await mangoIsCollecting(page)) && (await mangoSaveAllReady(page))) {
          pushLog(ctx, 'wait-search-popup', '[2] 망고 수집 완료', rowIndex, '안정대기 후 진행');
          return;
        }
      }
    }

    await sleep(500);
  }

  throw new Error(
    `#${rowIndex} 망고 수집 완료 대기 시간 초과 (start=${sawStart}, popup=${sawPopup}, collecting=${sawCollecting})`,
  );
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
    saveSettingsTitle(page).waitFor({ state: 'visible', timeout: 90_000 }),
    saveSettingsModal(page).waitFor({ state: 'visible', timeout: 90_000 }),
    page.getByText('검색필터명').first().waitFor({ state: 'visible', timeout: 90_000 }),
  ]);
}

/** 단계 로그 — ABC 검색 팝업이 있으면 bringToFront 금지(팝업 미터치) */
async function actStep(
  page: Page,
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  run: () => Promise<void>,
  rowIndex?: number,
  message?: string,
) {
  if (abcSearchPopups(page).length === 0) {
    await page.bringToFront().catch(() => undefined);
  }
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

  // URL상품검색하기 버튼이 있는 영역 안의 입력칸만 (다른 텍스트 필드와 섞지 않음)
  const area = urlSearchArea(page);
  const ta = area.locator('textarea:visible');
  if ((await ta.count()) > 0) return ta.last();

  const textInputs = area.locator(
    'input[type="text"]:visible:not([name="login_id"]):not([name="login_passwd"])',
  );
  if ((await textInputs.count()) > 0) return textInputs.last();

  const btn = urlSearchButton(page).first();
  const prevTa = btn.locator('xpath=preceding::textarea[1]');
  if (await prevTa.isVisible().catch(() => false)) return prevTa;

  throw new Error('URL상품검색하기 좌측 「최종 카테고리 URL주소」 입력칸을 찾지 못했습니다.');
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

/** 「검색된 상품 모두저장」 보이자마자 반환 */
async function waitSaveAllButtonVisible(page: Page): Promise<Locator> {
  const btn = saveAllButton(page).first();
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      await btn.waitFor({ state: 'visible', timeout: Math.max(1_000, deadline - Date.now()) });
      return btn;
    } catch (e) {
      if (isNavDestroyedError(e) && Date.now() < deadline) continue;
      throw e;
    }
  }
}

/** [6] 상품저장설정 팝업이 열린 뒤 → 닫힐 때까지 (닫히기 전 다음 입력 금지) */
async function waitForSavePopupClosed(page: Page): Promise<void> {
  const modal = saveSettingsModal(page);
  const deadline = Date.now() + 180_000;

  // 저장하기 직후 모달이 아직 안 잡히면 잠시 등장 대기
  const seen =
    (await modal.isVisible().catch(() => false)) ||
    (await modal
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false)) ||
    (await saveSettingsTitle(page)
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false));

  if (seen || (await modal.isVisible().catch(() => false))) {
    const remain = Math.max(5_000, deadline - Date.now());
    await modal.waitFor({ state: 'hidden', timeout: remain });
    // 완전히 사라졌는지 한 번 더 확인
    await sleep(400);
    if (await modal.isVisible().catch(() => false)) {
      await modal.waitFor({ state: 'hidden', timeout: Math.max(5_000, deadline - Date.now()) });
    }
    return;
  }

  await catchInPagePopupHidden(page, '');
  await sleep(400);
}

/**
 * 다음 URL 입력 가능 상태인지 게이트.
 * 검색 팝업·상품저장설정이 하나라도 열려 있으면 절대 입력하지 않음.
 */
async function assertIdleBeforeInput(page: Page, ctx: LogCtx, rowIndex: number, reason: string) {
  if (abcSearchPopups(page).length > 0) {
    pushLog(ctx, 'next-row', `${reason}: ABC팝업 자연종료 대기`, rowIndex);
    await waitAbcPopupsGoneNaturally(page, Date.now() + 300_000);
  }

  const modal = saveSettingsModal(page);
  if (await modal.isVisible().catch(() => false)) {
    pushLog(ctx, 'wait-save-popup', `${reason}: 상품저장설정 종료 대기`, rowIndex);
    await modal.waitFor({ state: 'hidden', timeout: 180_000 });
    await sleep(300);
  }

  if (abcSearchPopups(page).length > 0) {
    throw new Error(`#${rowIndex} ${reason}: ABC 검색 팝업이 아직 열려 있습니다.`);
  }
  if (await modal.isVisible().catch(() => false)) {
    throw new Error(`#${rowIndex} ${reason}: 상품저장설정이 아직 열려 있습니다.`);
  }
}

/** [1] 대량수집 메인 URL로 진입 (메뉴 클릭 대신 — 초기화) */
async function goBulkMainByUrl(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(
    page,
    ctx,
    'open-page',
    '[1] getGoodsNew.php 진입',
    async () => {
      await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await assertBulkCollectPage(page);
    },
    rowIndex,
    TMG_BULK_URL,
  );
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
  if (abcSearchPopups(page).length > 0) {
    pushLog(ctx, 'paste-url', '[2] 이전 ABC팝업 자연종료 대기', rowIndex);
    await waitAbcPopupsGoneNaturally(page, Date.now() + 300_000);
  }

  const normalized = normalizeUrl(url);
  pushLog(ctx, 'paste-url', '[2] 엑셀 URL → 입력', rowIndex, normalized);
  const input = await findUrlInput(page);
  await pasteField(page, input, normalized);
  const fieldValue = (await readInputValue(input)) || normalized;
  if (fieldValue !== normalized && !fieldValue.includes(normalized.slice(0, 40))) {
    pushLog(ctx, 'paste-url', '[2] URL 입력값 불일치 경고', rowIndex, fieldValue);
  }
  pushLog(ctx, 'paste-url', '[2] URL 입력 확인', rowIndex, fieldValue);
}

async function clickUrlSearchAndWaitPopup(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭', rowIndex);

  // 리스너만 등록 — 팝업을 직접 열지 않음
  const popupPromise = page
    .context()
    .waitForEvent('page', { timeout: 60_000 })
    .catch(() => null);

  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭 — 완료', rowIndex);

  // ABC 팝업·상품저장설정: 인위적으로 띄우거나 건드리지 않음. 자연 종료만 대기
  await waitSearchFinished(page, ctx, rowIndex, popupPromise);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  if (abcSearchPopups(page).length > 0) {
    pushLog(ctx, 'save-all', '[3] ABC팝업 자연종료 대기 (미터치)', rowIndex);
    await waitAbcPopupsGoneNaturally(page, Date.now() + 300_000);
  }
  if (abcSearchPopups(page).length > 0) {
    throw new Error(`#${rowIndex} ABC 검색 팝업이 열린 채라 모두저장을 클릭할 수 없습니다.`);
  }

  // 팝업 종료 후에만 망고 버튼 클릭 (bringToFront/maximize 없음)
  pushLog(ctx, 'save-all', '[3] 검색된 상품 모두저장 클릭', rowIndex);
  const btn = await waitSaveAllButtonVisible(page);
  await btn.click({ timeout: 10_000 }).catch(async () => {
    await btn.click({ force: true, timeout: 10_000 });
  });

  // 상품저장설정은 망고가 띄움 — 우리가 다시 눌러 억지로 열지 않음
  pushLog(ctx, 'save-all', '[3] 상품저장설정 자연 오픈 대기', rowIndex);
  const layerDeadline = Date.now() + 90_000;
  while (Date.now() < layerDeadline) {
    if (mangoSaveLayerOpen(page.url()) || (await isSaveSettingsOpen(page))) break;
    await sleep(300);
  }
  if (!(await isSaveSettingsOpen(page))) {
    throw new Error(`#${rowIndex} 상품저장설정이 열리지 않았습니다. (강제 재클릭 안 함)`);
  }
  pushLog(
    ctx,
    'save-all',
    '[3] 상품저장설정 열림',
    rowIndex,
    mangoSaveLayerOpen(page.url()) ? '#layer' : 'modal',
  );
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', '[4] 상품저장설정 (필터→상품수→저장)', async () => {
    await waitSaveSettingsOpen(page);
    const modal = saveSettingsModal(page);
    await modal.waitFor({ state: 'visible' });

    const filterRow = modal.locator('tr').filter({ hasText: '검색필터명' }).first();
    const filterInput = filterRow.locator('input[type="text"], input:not([type="hidden"])').first();
    await pasteField(page, filterInput, filterName);
    let filterWritten = await readInputValue(filterInput);
    if (filterWritten !== filterName) {
      await pasteField(page, filterInput, filterName);
      filterWritten = await readInputValue(filterInput);
    }
    pushLog(ctx, 'fill-save-form', '[4] 검색필터명←상위 최종 카테고리명', rowIndex, filterWritten);

    const countRow = modal.locator('tr').filter({ hasText: '저장상품수' }).first();
    const countInput = countRow.locator('input[type="text"], input[type="number"], input:not([type="hidden"])').first();
    await pasteField(page, countInput, String(saveCount));
    pushLog(ctx, 'fill-save-form', '[4] 저장상품수', rowIndex, String(saveCount));

    const filterNow = await readInputValue(filterInput);
    if (filterNow !== filterName) {
      await pasteField(page, filterInput, filterName);
      pushLog(ctx, 'fill-save-form', '[4] 검색필터명 복구', rowIndex, filterName);
    }
  }, rowIndex);

  pushLog(ctx, 'fill-save-form', '[4] 저장하기 클릭', rowIndex);
  const saveBtn = saveSubmitButton(page).first();
  await saveBtn.waitFor({ state: 'visible' });
  await fastClick(page, saveBtn);
  pushLog(ctx, 'fill-save-form', '[4] 저장하기 클릭 — 완료', rowIndex);
}

async function waitSavePopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '[4] 저장 모달 종료 대기', rowIndex);
  await waitForSavePopupClosed(page);
  pushLog(ctx, 'wait-save-popup', '[4] 저장 모달 종료 — 완료', rowIndex);
}

async function processOneRow(
  page: Page,
  row: TmgCollectRequest['rows'][0],
  saveCount: number,
  ctx: LogCtx,
) {
  const { rowIndex, finalCategoryUrl, topFinalLabel } = row;
  pushLog(ctx, 'next-row', `━━━ 엑셀 #${rowIndex} 행 ━━━`, rowIndex);
  pushLog(ctx, 'paste-url', '엑셀[최종 카테고리 URL주소]', rowIndex, finalCategoryUrl);
  pushLog(ctx, 'fill-save-form', '엑셀[상위 최종 카테고리명]', rowIndex, topFinalLabel);

  if (!finalCategoryUrl || !/^https?:\/\//i.test(finalCategoryUrl)) {
    throw new Error(`#${rowIndex} 엑셀 URL 값 오류: ${finalCategoryUrl || '(비어있음)'}`);
  }
  if (!topFinalLabel.trim()) {
    throw new Error(`#${rowIndex} 엑셀 「상위 최종 카테고리명」이 비어 있습니다.`);
  }

  /*
   * URL 신호 기준 순서:
   * [1] getGoodsNew.php
   * [2] URL 입력 → URL상품검색하기 → ABC팝업 종료 대기(망고 수집)
   * [3] 검색된 상품 모두저장 → #layer/상품저장설정
   * [4] 검색필터명·저장상품수 → 저장하기 → 모달 종료
   */
  await assertIdleBeforeInput(page, ctx, rowIndex, '행 시작 전');

  // [1] 대량수집 URL 진입 (초기화)
  await goBulkMainByUrl(page, ctx, rowIndex);

  // [2] 엑셀 URL 입력 → 검색 → 팝업 종료까지 대기
  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);
  await clickUrlSearchAndWaitPopup(page, ctx, rowIndex);
  await assertIdleBeforeInput(page, ctx, rowIndex, '검색 팝업 종료 후');

  // [3] 모두저장 → [4] 상품저장설정·저장하기
  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitSavePopupDone(page, ctx, rowIndex);
  await assertIdleBeforeInput(page, ctx, rowIndex, '저장 모달 종료 후');

  pushLog(ctx, 'next-row', `#${rowIndex} 행 완료 — 다음 행은 다시 [1]`, rowIndex);
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
    'URL신호: [1]getGoodsNew → [2]검색/ABC팝업대기 → [3]모두저장 → [4]저장하기',
    undefined,
    '망고 수집·저장 끝날 때까지 대기 (공식 API 없음)',
  );

  const headless = req.headless ?? false;
  let processedCount = 0;

  try {
    pushLog(ctx, 'open-page', 'Chromium 연결', undefined, TMG_LOGIN_URL);
    const context = await getCollectBrowserContext();
    pushLog(ctx, 'open-page', 'Chromium 연결 — 완료', undefined, TMG_LOGIN_URL);

    const page = await resolveBulkPageOrThrow(context, ctx);
    // 0이면 waitForEvent('page') 등이 영원히 멈춤 → 명시 타임아웃 사용
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
  } finally {
    if (req.keepBrowserOpen ?? !headless) {
      pushLog(ctx, 'next-row', 'Chromium 유지', undefined, '창을 직접 닫으세요');
    }
  }
}
