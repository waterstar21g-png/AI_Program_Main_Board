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

/** 외부 검색 팝업 목록 (망고 admin 제외) */
function externalPages(page: Page): Page[] {
  return page
    .context()
    .pages()
    .filter(p => p !== page && !p.isClosed() && !p.url().includes(TMG_ADMIN_HOST));
}

/** 망고 앞으로 — 외부 팝업 있을 땐 절대 호출하지 말 것 (maximize 금지) */
async function focusMangoBulk(page: Page) {
  if (externalPages(page).length > 0) return;
  await page.bringToFront().catch(() => undefined);
}

/** 외부 팝업이 모두 닫힐 때까지 (망고 미터치) */
async function waitExternalPopupsGone(page: Page, deadlineMs: number) {
  while (externalPages(page).length > 0) {
    if (Date.now() >= deadlineMs) {
      throw new Error('검색 팝업이 시간 안에 닫히지 않았습니다.');
    }
    const open = externalPages(page);
    await Promise.race([
      ...open.map(p => p.waitForEvent('close').catch(() => undefined)),
      sleep(Math.min(2000, Math.max(200, deadlineMs - Date.now()))),
    ]);
  }
}

/** 2단계: 망고가 검색을 시작했는지 (URL 신호) */
function mangoSearchStarted(url: string): boolean {
  return (
    url.includes('extension_search_key=') ||
    url.includes('extension_check_search_url=') ||
    url.includes('search_url=')
  );
}

/** 3단계: 모두저장 후 레이어 (#layer) */
function mangoSaveLayerOpen(url: string): boolean {
  return url.includes('#layer') || /layer_page_location=/.test(url);
}

/** ABC/망고 검색 팝업 (pmode=mango 등) */
function isSearchPopupPage(p: Page): boolean {
  try {
    const u = p.url();
    if (u.includes(TMG_ADMIN_HOST)) return false;
    return (
      u.includes('pmode=mango') ||
      u.includes('smode=search') ||
      u.includes('abcmart') ||
      u.includes('a-rt.com') ||
      (!!u && u !== 'about:blank')
    );
  } catch {
    return !p.isClosed();
  }
}

function searchPopups(page: Page): Page[] {
  return page
    .context()
    .pages()
    .filter(p => p !== page && !p.isClosed() && isSearchPopupPage(p));
}

/**
 * 2단계 완료 대기 (더망고 수집 시간 전제)
 * - 신호A: 망고 URL에 extension_search_key
 * - 신호B: ABC 팝업 (pmode=mango …)
 * - 완료: 팝업이 스스로 닫힘 → 그 전에는 망고/입력 미터치
 */
async function waitSearchFinished(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
  popupPromise: Promise<Page | null>,
) {
  pushLog(ctx, 'wait-search-popup', '[2] 망고 검색·ABC팝업 종료 대기', rowIndex);

  const APPEAR_MS = 45_000;
  const TOTAL_MS = 300_000; // 망고 수집 시간 여유
  const start = Date.now();
  const appearUntil = start + APPEAR_MS;
  const deadline = start + TOTAL_MS;

  void popupPromise.catch(() => null);

  let sawPopup = searchPopups(page).length > 0;
  let sawMangoSignal = mangoSearchStarted(page.url());
  let logged = false;

  while (Date.now() < deadline) {
    const pops = searchPopups(page);

    if (pops.length > 0) {
      sawPopup = true;
      if (!logged) {
        const u = (() => {
          try {
            return pops[0]!.url();
          } catch {
            return '(popup)';
          }
        })();
        pushLog(ctx, 'wait-search-popup', '[2] ABC/망고 팝업 감지 — 닫힘만 대기', rowIndex, u);
        logged = true;
      }
      // 팝업 떠 있는 동안: 망고 미터치
      await Promise.race([
        ...pops.map(p => p.waitForEvent('close').catch(() => undefined)),
        sleep(1000),
      ]);
      continue;
    }

    if (mangoSearchStarted(page.url())) sawMangoSignal = true;

    if (sawPopup) {
      // 짧게 재확인 (about:blank → 실팝업 이어열림)
      await sleep(800);
      if (searchPopups(page).length > 0) continue;
      pushLog(ctx, 'wait-search-popup', '[2] 검색 팝업 종료 — 망고 수집 완료', rowIndex);
      return;
    }

    // 아직 팝업 전: URL 신호만 보고 나타남 대기 (망고 DOM 조작 금지)
    if (Date.now() < appearUntil || sawMangoSignal) {
      await Promise.race([
        page
          .context()
          .waitForEvent('page', { timeout: 1000 })
          .then(() => undefined)
          .catch(() => undefined),
        sleep(400),
      ]);
      if (searchPopups(page).length > 0) continue;
      if (Date.now() < appearUntil) continue;
    }

    break;
  }

  if (searchPopups(page).length > 0) {
    throw new Error(`#${rowIndex} 검색 팝업이 ${TOTAL_MS / 1000}초 안에 닫히지 않았습니다.`);
  }

  // 팝업을 못 본 경우: 망고 URL 신호 + 모두저장 버튼
  if (mangoSearchStarted(page.url())) {
    await saveAllButton(page)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => undefined);
    pushLog(ctx, 'wait-search-popup', '[2] 팝업 미감지·망고 URL 신호로 완료', rowIndex, page.url().slice(0, 120));
    return;
  }

  throw new Error(`#${rowIndex} 검색 시작/완료 신호를 확인하지 못했습니다.`);
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

/** 단계 로그만 남기고 즉시 실행 — 검색 팝업이 열려 있으면 bringToFront 안 함 */
async function actStep(
  page: Page,
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  run: () => Promise<void>,
  rowIndex?: number,
  message?: string,
) {
  if (externalPages(page).length === 0) {
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
  if (externalPages(page).length > 0) {
    pushLog(ctx, 'next-row', `${reason}: 검색 모달 종료 대기`, rowIndex);
    await waitExternalPopupsGone(page, Date.now() + 180_000);
  }

  const modal = saveSettingsModal(page);
  if (await modal.isVisible().catch(() => false)) {
    pushLog(ctx, 'wait-save-popup', `${reason}: 저장 모달 종료 대기`, rowIndex);
    await modal.waitFor({ state: 'hidden', timeout: 180_000 });
    await sleep(300);
  }

  if (externalPages(page).length > 0) {
    throw new Error(`#${rowIndex} ${reason}: 검색 모달이 아직 열려 있어 다음 입력을 할 수 없습니다.`);
  }
  if (await modal.isVisible().catch(() => false)) {
    throw new Error(`#${rowIndex} ${reason}: 저장 모달이 아직 열려 있어 다음 입력을 할 수 없습니다.`);
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
  if (externalPages(page).length > 0) {
    pushLog(ctx, 'paste-url', '[2] 이전 팝업 닫힘 대기', rowIndex);
    await waitExternalPopupsGone(page, Date.now() + 180_000);
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

  const popupPromise = page
    .context()
    .waitForEvent('page', { timeout: 45_000 })
    .catch(() => null);

  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭 — 완료', rowIndex);

  // 망고 수집 끝날 때까지 (ABC 팝업 종료) 대기
  await waitSearchFinished(page, ctx, rowIndex, popupPromise);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  // [3] ABC 팝업이 완전히 끝난 뒤에만
  if (searchPopups(page).length > 0) {
    pushLog(ctx, 'save-all', '[3] ABC팝업 종료 대기', rowIndex);
    await waitExternalPopupsGone(page, Date.now() + 300_000);
  }
  if (searchPopups(page).length > 0) {
    throw new Error(`#${rowIndex} 검색 팝업이 열린 채라 모두저장을 클릭할 수 없습니다.`);
  }

  await focusMangoBulk(page);
  pushLog(ctx, 'save-all', '[3] 검색된 상품 모두저장 클릭', rowIndex);
  const btn = await waitSaveAllButtonVisible(page);
  await btn.click({ force: true }).catch(async () => {
    await hardClick(page, btn);
  });

  // 신호: #layer 또는 상품저장설정 팝업
  pushLog(ctx, 'save-all', '[3] 상품저장설정(#layer) 대기', rowIndex);
  const layerDeadline = Date.now() + 60_000;
  while (Date.now() < layerDeadline) {
    if (mangoSaveLayerOpen(page.url())) break;
    if (await isSaveSettingsOpen(page)) break;
    await sleep(300);
  }

  await waitSaveSettingsOpen(page);
  if (!(await isSaveSettingsOpen(page))) {
    await hardClick(page, saveAllButton(page));
    await waitSaveSettingsOpen(page);
  }
  if (!(await isSaveSettingsOpen(page))) {
    throw new Error(`#${rowIndex} 상품저장설정 모달(#layer)이 안 떴습니다.`);
  }
  pushLog(ctx, 'save-all', '[3] 상품저장설정 열림', rowIndex, page.url().includes('#layer') ? '#layer' : 'modal');
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
