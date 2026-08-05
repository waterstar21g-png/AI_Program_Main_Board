import type { BrowserContext, Locator, Page } from 'playwright';
import {
  ensureBulkCollectPage,
  getCollectBrowserContext,
  resetBulkCollectViaMenu,
  TMG_ADMIN_HOST,
} from '@/lib/product-data-collect/browser-session';
import { TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
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

/**
 * URL검색 클릭 직후 — 1행·N행 동일 규칙
 * - 팝업이 떠 있는 동안: URL입력/망고 DOM/bringToFront/maximize/강제close 금지
 * - 팝업 close 이벤트만 대기
 * - waitForEvent('page') 무한대기 금지 (타임아웃)
 * - 팝업이 Playwright에 안 잡히면 나타남 대기 후 망고 결과만 확인
 */
async function waitSearchFinished(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
  popupPromise: Promise<Page | null>,
) {
  pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 닫힘 대기(입력·포커스 금지)', rowIndex);

  const APPEAR_MS = 30_000;
  const TOTAL_MS = 180_000;
  const start = Date.now();
  const appearUntil = start + APPEAR_MS;
  const deadline = start + TOTAL_MS;

  // 클릭 전 걸어둔 리스너 소비 (타임아웃 시 null — 무한대기 없음)
  const firstPopup = await popupPromise.catch(() => null);
  const firstIsExternal = (() => {
    if (!firstPopup) return false;
    try {
      return !firstPopup.url().includes(TMG_ADMIN_HOST);
    } catch {
      // 이미 닫혀 URL을 못 읽어도 외부 팝업으로 간주
      return true;
    }
  })();
  let sawExternal = externalPages(page).length > 0 || firstIsExternal;
  let loggedPopup = false;

  /** about:blank 등이 먼저 닫힌 뒤 실제 검색창이 이어 열릴 수 있음 → 짧게 재확인 */
  async function settleNoExternal(): Promise<boolean> {
    const settleUntil = Date.now() + 3_000;
    while (Date.now() < settleUntil && Date.now() < deadline) {
      if (externalPages(page).length > 0) return false;
      await Promise.race([
        page
          .context()
          .waitForEvent('page', { timeout: 400 })
          .then(p => {
            if (p && !p.isClosed() && !p.url().includes(TMG_ADMIN_HOST)) {
              sawExternal = true;
            }
          })
          .catch(() => undefined),
        sleep(300),
      ]);
    }
    return externalPages(page).length === 0;
  }

  while (Date.now() < deadline) {
    const extras = externalPages(page);

    if (extras.length > 0) {
      sawExternal = true;
      if (!loggedPopup) {
        const url = (() => {
          try {
            return extras[0]!.url();
          } catch {
            return '(unknown)';
          }
        })();
        pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 감지 — 닫힘만 대기', rowIndex, url);
        loggedPopup = true;
      }
      // 팝업 떠 있는 동안 망고·입력 절대 접근 금지
      await waitExternalPopupsGone(page, deadline);
      continue;
    }

    if (sawExternal) {
      const reallyGone = await settleNoExternal();
      if (!reallyGone) continue;
      pushLog(ctx, 'wait-search-popup', '[3] 검색 팝업 닫힘 — 완료', rowIndex);
      return;
    }

    // 아직 외부 팝업을 못 봄 → 나타남 창구 동안은 망고 DOM 조회하지 않음
    if (Date.now() < appearUntil) {
      await Promise.race([
        page
          .context()
          .waitForEvent('page', { timeout: 800 })
          .then(p => {
            if (p && !p.url().includes(TMG_ADMIN_HOST)) sawExternal = true;
          })
          .catch(() => undefined),
        sleep(400),
      ]);
      continue;
    }

    break;
  }

  if (Date.now() >= deadline) {
    throw new Error(`#${rowIndex} 검색 팝업 대기 시간 초과(180초)`);
  }

  // Playwright가 팝업을 못 본 경우만: 망고에서 실패/완료 신호 확인
  const empty = await page
    .getByText(/검색결과가\s*없습니다/)
    .first()
    .isVisible()
    .catch(() => false);
  if (empty) {
    throw new Error(`#${rowIndex} 검색결과가 없습니다 — URL 붙여넣기/검색 실패`);
  }

  const remain = Math.max(5_000, deadline - Date.now());
  try {
    await saveAllButton(page).first().waitFor({ state: 'visible', timeout: remain });
  } catch {
    throw new Error(`#${rowIndex} 검색 완료 확인 실패(팝업 미감지·모두저장 없음)`);
  }
  pushLog(ctx, 'wait-search-popup', '[3] 검색 완료(외부 팝업 미감지)', rowIndex);
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

/** 매 단계 시작: 상품데이터수집 → 대량수집 메뉴 (CLEAR 대체 초기화) */
async function resetViaMenu(page: Page, ctx: LogCtx, rowIndex: number) {
  await actStep(
    page,
    ctx,
    'clear-grid',
    '[2] 상품데이터수집 → 대량수집 메뉴 (초기화)',
    async () => {
      await resetBulkCollectViaMenu(page);
      await assertBulkCollectPage(page);
    },
    rowIndex,
    '상품데이터 대량수집 (리스팅페이지 URL 이용)',
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

  // 클릭 전에 팝업 리스너 등록 (놓치지 않음) — 타임아웃으로 무한대기 방지
  const popupPromise = page
    .context()
    .waitForEvent('page', { timeout: 30_000 })
    .catch(() => null);

  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  pushLog(ctx, 'url-search', '[2] URL상품검색하기 클릭 — 완료', rowIndex);

  // 1행부터: 팝업이 스스로 닫힐 때까지 입력·망고·포커스 금지
  await waitSearchFinished(page, ctx, rowIndex, popupPromise);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  // 게이트: 검색 모달이 완전히 끝난 뒤에만 다음 버튼 클릭
  if (externalPages(page).length > 0) {
    pushLog(ctx, 'save-all', '[4] 검색 모달 종료 대기 (버튼 클릭 보류)', rowIndex);
    await waitExternalPopupsGone(page, Date.now() + 180_000);
  }
  if (externalPages(page).length > 0) {
    throw new Error(`#${rowIndex} 검색 모달이 열린 채라 모두저장을 클릭할 수 없습니다.`);
  }

  await focusMangoBulk(page);
  pushLog(ctx, 'save-all', '[4] 모달 종료 확인 → 검색된 상품 모두저장 클릭', rowIndex);
  const btn = await waitSaveAllButtonVisible(page);
  await btn.click({ force: true }).catch(async () => {
    await hardClick(page, btn);
  });

  pushLog(ctx, 'save-all', '[4] 상품저장설정 모달 대기', rowIndex);
  await waitSaveSettingsOpen(page);
  if (!(await isSaveSettingsOpen(page))) {
    await hardClick(page, saveAllButton(page));
    await waitSaveSettingsOpen(page);
  }
  if (!(await isSaveSettingsOpen(page))) {
    throw new Error(`#${rowIndex} 상품저장설정 모달이 안 떴습니다.`);
  }
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
    pushLog(ctx, 'fill-save-form', '[5] 엑셀 상위최종카테고리명 → 검색필터명', rowIndex, filterName);
    await pasteField(page, filterInput, filterName);
    const filterWritten = await readInputValue(filterInput);
    pushLog(ctx, 'fill-save-form', '[5] 검색필터명 확인', rowIndex, filterWritten || filterName);

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

  /*
   * 필수 순서 (고정):
   * 1) 이전 모달 종료 확인
   * 2) 메뉴 재진입으로 초기화 (CLEAR 없음)
   * 3) URL 필드 입력 → URL상품검색하기
   * 4) 검색 모달 종료까지 대기
   * 5) 모두저장 → 저장설정 → 저장하기
   * 6) 저장 모달 종료 후 → 다음 행(다시 메뉴 초기화부터)
   */
  await assertIdleBeforeInput(page, ctx, rowIndex, '행 시작 전');

  // 매 행 시작: 상품데이터수집 → 상품데이터 대량수집 (초기화)
  await resetViaMenu(page, ctx, rowIndex);

  // URL 필드 입력
  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);

  // 3) 검색 클릭 → 모달 종료 대기
  await clickUrlSearchAndWaitPopup(page, ctx, rowIndex);
  await assertIdleBeforeInput(page, ctx, rowIndex, '검색 모달 종료 후');

  // 4) 다음 버튼(모두저장) 클릭 → 5) 저장설정 입력·저장하기
  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);

  // 6) 저장 모달 종료까지 대기 — 끝나기 전 다음 행 입력 금지
  await waitSavePopupDone(page, ctx, rowIndex);
  await assertIdleBeforeInput(page, ctx, rowIndex, '저장 모달 종료 후');

  pushLog(ctx, 'next-row', `#${rowIndex} 행 완료 — 다음 URL 입력 가능`, rowIndex);
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
    '순서 고정: 입력→대기→모달종료→버튼→모달종료→다음입력',
    undefined,
    '모달 종료 전 다음 입력·클릭 금지',
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
