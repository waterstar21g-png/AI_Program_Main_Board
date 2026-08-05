/**
 * 더망고 대량수집 — 화면에서 하는 순서 그대로
 *
 * 0. 초기화 : 상품데이터수집 → 대량데이터수집 클릭
 * 1. URL상품검색하기 → 필드값 입력후 → 팝업창이 없어질때까지 대기
 * 2. 검색된 상품 모두저장 클릭후 → 팝업창에서 검색필터명 입력후 → 저장하기
 * 3. 팝업창이 없어질때까지 대기
 * 4. → 0. 초기화
 *
 * 팝업을 강제로 열거나 닫거나 포커스하지 않는다.
 */
import type { BrowserContext, Locator, Page } from 'playwright';
import {
  ensureBulkCollectPage,
  getCollectBrowserContext,
  resetBulkCollectViaMenu,
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

/** ABC 팝업 자연 종료만 대기 (열기/닫기/포커스 금지) */
async function waitAbcPopupsGoneNaturally(page: Page, deadlineMs: number): Promise<void> {
  while (abcSearchPopups(page).length > 0) {
    if (Date.now() >= deadlineMs) {
      throw new Error('ABC 팝업이 아직 닫히지 않았습니다. (강제 종료하지 않음)');
    }
    const open = abcSearchPopups(page);
    await Promise.race([
      ...open.map(p => p.waitForEvent('close').catch(() => undefined)),
      sleep(1000),
    ]);
  }
}

/** 검색 결과 상품이 하단에 보이는가 */
async function hasProductResults(page: Page): Promise<boolean> {
  if (await page.getByText(/검색된\s*상품\s*[1-9]\d*/).first().isVisible().catch(() => false)) {
    return true;
  }
  if (await page.getByText(/KRW\s*[\d,]+/).first().isVisible().catch(() => false)) return true;
  return false;
}

/**
 * 망고 빨간 로딩 레이어 (스크린샷)
 * "load product .." / "상품정보를 불러오는 중입니다." / "잠시만 기다려주세요."
 * ※ 이 동안 망고 창 bringToFront 금지 — ABC 팝업이 뒤로 밀리면 수집 실패
 */
async function mangoIsCollecting(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const t = (document.body?.innerText || '').replace(/\s+/g, ' ');
      // 빨간 로딩 팝업 문구만 (다른 「중입니다」 오탐 금지)
      return (
        /load\s*product/i.test(t) ||
        /상품정보를\s*불러오는\s*중/i.test(t) ||
        /상품\s*정보를\s*불러오는\s*중/i.test(t) ||
        /잠시만\s*기다려\s*주세요/i.test(t)
      );
    })
    .catch(() => false);
}

/**
 * 하단부 검색결과 없음 — 로딩이 끝난 뒤에만 유효
 * (결과 있는 카테고리인데 로딩 중 오판하면 안 됨)
 */
async function hasNoSearchResults(page: Page): Promise<boolean> {
  const patterns = [
    /검색하신\s*검색에\s*대한\s*검색결과가\s*없습니다/,
    /검색결과가\s*없습니다/,
    /정확한\s*검색어인지\s*다시한번\s*확인/,
    /정확한\s*검색어인지\s*다시\s*한번\s*확인/,
  ];
  for (const re of patterns) {
    if (await page.getByText(re).first().isVisible().catch(() => false)) return true;
  }
  if (await page.getByText(/검색된\s*상품\s*0\s*개/).first().isVisible().catch(() => false)) {
    return true;
  }
  return false;
}

type SearchOutcome = 'products' | 'empty';

/**
 * [1] URL검색 후 대기 — 팝업/포커스/창순서 절대 건드리지 않음
 * 완료: ABC팝업 없음 + load product 로딩 끝 + 상품 그리드 보임
 */
async function waitSearchFinished(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
  popupPromise: Promise<Page | null>,
): Promise<SearchOutcome> {
  pushLog(ctx, 'wait-search-popup', '[1] 수집 대기 (팝업·창순서 미터치)', rowIndex);

  const deadline = Date.now() + 300_000;
  let sawPopup = false;
  let sawCollecting = false;
  let emptySince = 0;
  let lastBeat = 0;

  void popupPromise
    .then(p => {
      if (p && !p.isClosed() && isAbcSearchPopup(p)) sawPopup = true;
    })
    .catch(() => undefined);

  while (Date.now() < deadline) {
    // 대기 중에는 bringToFront / maximize / 클릭 일절 금지
    const pops = abcSearchPopups(page);
    if (pops.length > 0) sawPopup = true;

    const collecting = await mangoIsCollecting(page);
    if (collecting) {
      sawCollecting = true;
      emptySince = 0;
    }

    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      const results = await hasProductResults(page);
      pushLog(
        ctx,
        'wait-search-popup',
        '[1] 대기중…',
        rowIndex,
        `popup=${pops.length} collecting=${collecting} results=${results} sawCollect=${sawCollecting}`,
      );
    }

    // ABC 팝업 열려 있으면: 닫힐 때만 기다림 (포커스/뒤로보내기 금지)
    if (pops.length > 0) {
      await Promise.race([
        ...pops.map(p => p.waitForEvent('close').catch(() => undefined)),
        sleep(1000),
      ]);
      continue;
    }

    // 빨간 load product 로딩 중이면 결과 판정하지 않음
    if (collecting) {
      await sleep(500);
      continue;
    }

    // 상품이 보이면 성공 (결과 있는 카테고리 정상 경로)
    if (await hasProductResults(page)) {
      pushLog(ctx, 'wait-search-popup', '[1] 수집 완료 · 검색결과 확인', rowIndex);
      return 'products';
    }

    // 로딩이 끝난 뒤에만 «결과 없음» 인정 (5초 유지)
    if (await hasNoSearchResults(page)) {
      if (!emptySince) emptySince = Date.now();
      if (Date.now() - emptySince >= 5_000) {
        pushLog(ctx, 'wait-search-popup', '[1] 검색결과 없음 확정 — 저장 스킵', rowIndex);
        return 'empty';
      }
    } else {
      emptySince = 0;
    }

    await sleep(500);
  }

  throw new Error(
    `#${rowIndex} [1] 수집 대기 시간 초과 (popup=${sawPopup}, collecting=${sawCollecting})`,
  );
}

async function setFieldValue(locator: Locator, text: string) {
  const el = locator.first();
  await el.evaluate(
    (node, value) => {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        node.value = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    text,
  );
}

/** 입력 — 클릭·스크롤·포커스·키보드 없이 value만 설정 */
async function pasteField(_page: Page, locator: Locator, text: string) {
  await setFieldValue(locator, text);
}

/** 클릭 — 스크롤·포커스·force 없이 DOM 이벤트만 */
async function domClick(locator: Locator) {
  const el = locator.first();
  await el.waitFor({ state: 'attached' });
  await el.evaluate(node => {
    const n = node as HTMLElement;
    n.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    n.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    n.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function fastClick(_page: Page, locator: Locator) {
  await domClick(locator);
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

/** 단계 로그 — bringToFront 금지 (ABC 팝업이 뒤로 밀림) */
async function actStep(
  _page: Page,
  ctx: LogCtx,
  step: WorkflowStepLog['step'],
  label: string,
  run: () => Promise<void>,
  rowIndex?: number,
  message?: string,
) {
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
      // bringToFront 하지 않음 — ABC 수집 팝업이 뒤로 밀리면 실패함
      return p;
    }
  }
  return null;
}

async function resolveBulkPageOrThrow(context: BrowserContext, logCtx: LogCtx): Promise<Page> {
  const ready = await findBulkReadyPage(context);
  if (ready) {
    pushLog(logCtx, 'open-page', '[0] 대량수집 메인 화면 확인', undefined, ready.url().split('?')[0]);
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

/** [0] 초기화: 상품데이터수집 → 대량수집 (실패 시 URL 진입) */
async function step0Init(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'open-page', '[0] 초기화: 상품데이터수집→대량수집', rowIndex);
  try {
    await resetBulkCollectViaMenu(page);
  } catch {
    await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  }
  await assertBulkCollectPage(page);
  pushLog(ctx, 'open-page', '[0] 초기화 완료', rowIndex, page.url().split('?')[0]);
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
    pushLog(ctx, 'paste-url', '[1] 이전 ABC팝업 자연종료 대기', rowIndex);
    await waitAbcPopupsGoneNaturally(page, Date.now() + 300_000);
  }

  const normalized = normalizeUrl(url);
  pushLog(ctx, 'paste-url', '[1] URL 필드 입력', rowIndex, normalized);
  const input = await findUrlInput(page);
  await pasteField(page, input, normalized);
  const fieldValue = (await readInputValue(input)) || normalized;
  if (fieldValue !== normalized && !fieldValue.includes(normalized.slice(0, 40))) {
    pushLog(ctx, 'paste-url', '[1] URL 입력값 불일치 경고', rowIndex, fieldValue);
  }
  pushLog(ctx, 'paste-url', '[1] URL 입력 확인', rowIndex, fieldValue);
}

async function clickUrlSearchAndWaitPopup(
  page: Page,
  ctx: LogCtx,
  rowIndex: number,
): Promise<SearchOutcome> {
  pushLog(ctx, 'url-search', '[1] URL상품검색하기 클릭', rowIndex);

  // 리스너만 등록 — 팝업을 직접 열지 않음
  const popupPromise = page
    .context()
    .waitForEvent('page', { timeout: 60_000 })
    .catch(() => null);

  const ok = await clickFirstVisible(page, [urlSearchButton(page)]);
  if (!ok) throw new Error('URL상품검색하기 버튼을 찾지 못했습니다.');
  pushLog(ctx, 'url-search', '[1] URL상품검색하기 클릭 — 완료', rowIndex);

  // ABC 팝업: 인위적으로 띄우거나 건드리지 않음. 없어질 때까지만 대기
  return waitSearchFinished(page, ctx, rowIndex, popupPromise);
}

async function clickSaveAll(page: Page, ctx: LogCtx, rowIndex: number) {
  if (abcSearchPopups(page).length > 0) {
    pushLog(ctx, 'save-all', '[2] ABC팝업 자연종료 대기 (미터치)', rowIndex);
    await waitAbcPopupsGoneNaturally(page, Date.now() + 300_000);
  }
  if (abcSearchPopups(page).length > 0) {
    throw new Error(`#${rowIndex} ABC 검색 팝업이 열린 채라 모두저장을 클릭할 수 없습니다.`);
  }

  // 팝업 종료 후에만 망고 버튼 클릭 (창순서·포커스 변경 없음)
  pushLog(ctx, 'save-all', '[2] 검색된 상품 모두저장 클릭', rowIndex);
  const btn = await waitSaveAllButtonVisible(page);
  await domClick(btn);

  // 상품저장설정은 망고가 띄움 — 강제 재클릭/강제 오픈 금지
  pushLog(ctx, 'save-all', '[2] 상품저장설정 자연 오픈 대기', rowIndex);
  const layerDeadline = Date.now() + 90_000;
  while (Date.now() < layerDeadline) {
    if (await isSaveSettingsOpen(page)) break;
    await sleep(300);
  }
  if (!(await isSaveSettingsOpen(page))) {
    throw new Error(`#${rowIndex} 상품저장설정이 열리지 않았습니다. (강제 재클릭 안 함)`);
  }
  pushLog(ctx, 'save-all', '[2] 상품저장설정 열림', rowIndex);
}

async function fillSaveForm(
  page: Page,
  filterName: string,
  saveCount: number,
  ctx: LogCtx,
  rowIndex: number,
) {
  await actStep(page, ctx, 'fill-save-form', '[2] 상품저장설정 (검색필터명→저장하기)', async () => {
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
    pushLog(ctx, 'fill-save-form', '[2] 검색필터명←상위 최종 카테고리명', rowIndex, filterWritten);

    const countRow = modal.locator('tr').filter({ hasText: '저장상품수' }).first();
    const countInput = countRow.locator('input[type="text"], input[type="number"], input:not([type="hidden"])').first();
    await pasteField(page, countInput, String(saveCount));
    pushLog(ctx, 'fill-save-form', '[2] 저장상품수', rowIndex, String(saveCount));

    const filterNow = await readInputValue(filterInput);
    if (filterNow !== filterName) {
      await pasteField(page, filterInput, filterName);
      pushLog(ctx, 'fill-save-form', '[2] 검색필터명 복구', rowIndex, filterName);
    }
  }, rowIndex);

  pushLog(ctx, 'fill-save-form', '[2] 저장하기 클릭', rowIndex);
  const saveBtn = saveSubmitButton(page).first();
  await saveBtn.waitFor({ state: 'visible' });
  await fastClick(page, saveBtn);
  pushLog(ctx, 'fill-save-form', '[2] 저장하기 클릭 — 완료', rowIndex);
}

async function waitSavePopupDone(page: Page, ctx: LogCtx, rowIndex: number) {
  pushLog(ctx, 'wait-save-popup', '[3] 팝업창 없어질 때까지 대기', rowIndex);
  await waitForSavePopupClosed(page);
  pushLog(ctx, 'wait-save-popup', '[3] 팝업 종료 — 완료', rowIndex);
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
   * 화면 순서 그대로:
   * [0] 초기화: 상품데이터수집 → 대량데이터수집
   * [1] URL상품검색하기 → 필드 입력 → 팝업 없어질 때까지 대기
   * [2] 검색된 상품 모두저장 → 검색필터명 입력 → 저장하기
   * [3] 팝업 없어질 때까지 대기
   * [4] → [0]
   */
  await assertIdleBeforeInput(page, ctx, rowIndex, '행 시작 전');

  await step0Init(page, ctx, rowIndex);

  await pasteUrl(page, finalCategoryUrl, ctx, rowIndex);
  const searchOutcome = await clickUrlSearchAndWaitPopup(page, ctx, rowIndex);
  await assertIdleBeforeInput(page, ctx, rowIndex, '검색 팝업 종료 후');

  // 하단에 「검색결과가 없습니다」면 모두저장 하지 않고 다음 행([0])으로
  if (searchOutcome === 'empty') {
    pushLog(
      ctx,
      'next-row',
      `[1] #${rowIndex} 검색결과 없음 → 저장 생략 → [4]다음 행 [0]`,
      rowIndex,
    );
    return;
  }

  await clickSaveAll(page, ctx, rowIndex);
  await fillSaveForm(page, topFinalLabel, saveCount, ctx, rowIndex);
  await waitSavePopupDone(page, ctx, rowIndex);
  await assertIdleBeforeInput(page, ctx, rowIndex, '저장 모달 종료 후');

  pushLog(ctx, 'next-row', `[4] #${rowIndex} 완료 → 다음 행은 [0] 초기화`, rowIndex);
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
    '화면순서: [0]초기화 → [1]URL검색·팝업대기 → [2]모두저장·필터명·저장하기 → [3]팝업대기 → [4]→[0]',
    undefined,
    '팝업 강제 열기/닫기/포커스 금지 · 망고가 끝날 때까지 대기',
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
