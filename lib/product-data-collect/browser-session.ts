import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';

export const TMG_PROFILE_DIR = path.join(process.cwd(), '.local', 'tmg-chromium-profile');
export const CDP_URL = 'http://127.0.0.1:9222';
export const TMG_BULK_PATH = 'getGoodsNew.php';
export const TMG_ADMIN_HOST = 'tmg1898.cafe24.com';

export const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-crash-restore-bubble',
  '--disable-session-crashed-bubble',
  '--remote-debugging-port=9222',
  '--start-maximized',
];

type BrowserGlobal = { __tmgBrowserContext?: BrowserContext | null };
const g = globalThis as BrowserGlobal;

function getStoredContext(): BrowserContext | null {
  return g.__tmgBrowserContext ?? null;
}

function setStoredContext(ctx: BrowserContext | null) {
  g.__tmgBrowserContext = ctx;
}

export function getSharedContext() {
  return getStoredContext();
}

function contextAlive(ctx: BrowserContext | null): ctx is BrowserContext {
  return !!ctx && ctx.pages().some(p => !p.isClosed());
}

/** 창 최대화 — 모달·버튼이 잘리지 않도록 */
export async function maximizePage(page: Page) {
  try {
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'maximized' },
    });
  } catch {
    await page
      .evaluate(() => {
        try {
          window.moveTo(0, 0);
          window.resizeTo(screen.availWidth, screen.availHeight);
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);
  }
}

export async function tryConnectCdp(): Promise<BrowserContext | null> {
  try {
    const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
    const ctx = browser.contexts()[0] ?? null;
    if (ctx) setStoredContext(ctx);
    return ctx;
  } catch {
    return null;
  }
}

async function gotoUrl(page: Page, url: string) {
  const current = page.url();
  if (current === url || current.startsWith(url.replace(/\/$/, ''))) return;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
}

function isLoginPage(url: string) {
  return url.includes('admin_login');
}

function isBulkPage(url: string) {
  return url.includes(TMG_BULK_PATH);
}

async function clickLoginIfNeeded(page: Page) {
  if (!isLoginPage(page.url())) return;

  const loginBtn = page
    .locator('form#loginForm button[type="submit"]')
    .or(page.locator('form#loginForm input[type="submit"]'))
    .or(page.getByRole('button', { name: /^로그인$/ }))
    .or(page.locator('input[type="submit"][value="로그인"], button:has-text("로그인")'))
    .first();

  await loginBtn.waitFor({ state: 'visible' });
  // ID/PW는 프로필에 이미 채워진 값 사용 — 입력하지 않고 로그인만 클릭
  await loginBtn.click();
  await page.waitForURL(u => !isLoginPage(u.toString()), { timeout: 120000 }).catch(() => undefined);
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function waitBulkReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page
    .waitForURL(u => isBulkPage(u.toString()), { timeout: 60_000 })
    .catch(() => undefined);
  if (!isBulkPage(page.url())) {
    await gotoUrl(page, TMG_BULK_URL);
  }
  await page
    .locator('input[type="button"][value*="URL"][value*="상품"][value*="검색"]')
    .or(page.getByText(/URL\s*상품\s*검색하기/))
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
}

/** 하위「상품데이터 대량수집 …」후보 (보이는 것 우선) */
function bulkSubmenuLocators(page: Page) {
  return [
    // 가장 확실: getGoodsNew.php 링크
    page.locator('a[href*="getGoodsNew.php"]'),
    page.locator('a[href*="getGoodsNew"]'),
    // 스크린샷 문구 전체
    page.getByRole('link', { name: /상품데이터\s*대량수집/ }),
    page.locator('a').filter({ hasText: /상품데이터\s*대량수집/ }),
    page.locator('a, li, span, td, div').filter({ hasText: /상품데이터\s*대량수집/ }),
    page.getByText(/상품데이터\s*대량수집\s*\(?\s*리스팅페이지/),
    page.getByText(/상품데이터\s*대량수집/),
  ];
}

async function clickFirstVisible(
  locators: ReturnType<typeof bulkSubmenuLocators>,
  timeoutMs = 2_500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const loc of locators) {
      const el = loc.first();
      if (await el.isVisible().catch(() => false)) {
        await el.scrollIntoViewIfNeeded().catch(() => undefined);
        await el.click({ force: true }).catch(async () => {
          await el.evaluate((n: HTMLElement) => n.click());
        });
        return true;
      }
    }
    await sleep(200);
  }
  return false;
}

/**
 * 상단「상품데이터수집」→「상품데이터 대량수집 (리스팅페이지 URL 이용)」클릭
 * (이미 대량수집 화면이어도 다시 클릭 — 초기화 효과)
 */
export async function clickBulkCollectMenu(page: Page): Promise<void> {
  await page.bringToFront().catch(() => undefined);

  // 0) 하위 링크가 이미 보이면 바로 클릭
  if (await clickFirstVisible(bulkSubmenuLocators(page), 800)) {
    await waitBulkReady(page);
    return;
  }

  // 1) 상단 메뉴「상품데이터수집」열기 (호버 드롭다운)
  const topMenus = [
    page.getByRole('link', { name: /^상품데이터수집/ }),
    page.locator('a').filter({ hasText: /^상품데이터수집/ }),
    page.locator('li, span, td, div').filter({ hasText: /^상품데이터수집$/ }),
    page.getByText('상품데이터수집', { exact: true }),
    page.getByText(/상품데이터수집/),
  ];

  let topOpened = false;
  for (const top of topMenus) {
    const el = top.first();
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    await el.hover({ force: true }).catch(() => undefined);
    await sleep(350);
    // 호버만으로 안 열리면 클릭
    if (!(await clickFirstVisible(bulkSubmenuLocators(page), 600))) {
      await el.click({ force: true }).catch(() => undefined);
      await sleep(400);
    }
    topOpened = true;
    break;
  }

  // 2) 하위 메뉴 클릭 (최대 2회 재시도)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await clickFirstVisible(bulkSubmenuLocators(page), 4_000)) {
      await waitBulkReady(page);
      return;
    }
    if (topOpened) {
      // 다시 호버
      const top = page.getByText(/상품데이터수집/).first();
      await top.hover({ force: true }).catch(() => undefined);
      await sleep(400);
    }
  }

  // 3) 메뉴를 못 찾으면 URL 직접 이동 (초기화 목적 유지)
  await gotoUrl(page, TMG_BULK_URL);
  await waitBulkReady(page);
}

/** 최초 진입: 이미 대량수집이면 메뉴 스킵 */
async function openBulkMenuFromMain(page: Page) {
  if (isBulkPage(page.url())) return;
  await clickBulkCollectMenu(page);
}

/** 매 행/단계 시작: 메뉴 재클릭으로 화면 초기화 (CLEAR 대체) */
export async function resetBulkCollectViaMenu(page: Page): Promise<void> {
  await clickBulkCollectMenu(page);
  if (!isBulkPage(page.url())) {
    throw new Error(
      '메뉴 초기화 실패: 상품데이터수집 → 상품데이터 대량수집 화면이 아닙니다.',
    );
  }
}

/**
 * 로그인 → 메인 메뉴 → 대량수집 화면까지 자동 진입
 * (사람 개입 최소화: ID/PW는 저장된 값, 로그인·메뉴만 클릭)
 */
export async function ensureBulkCollectPage(page: Page): Promise<Page> {
  await maximizePage(page);
  await page.bringToFront();

  if (isBulkPage(page.url())) {
    return page;
  }

  if (isLoginPage(page.url()) || !page.url().includes(TMG_ADMIN_HOST)) {
    await gotoUrl(page, TMG_LOGIN_URL);
    await clickLoginIfNeeded(page);
  }

  // 로그인 후에도 로그인 화면이면 한 번 더
  if (isLoginPage(page.url())) {
    await clickLoginIfNeeded(page);
  }

  if (!isBulkPage(page.url())) {
    await openBulkMenuFromMain(page);
  }

  if (!isBulkPage(page.url())) {
    await gotoUrl(page, TMG_BULK_URL);
  }

  // 세션 만료로 로그인으로 튕기면 재시도 1회
  if (isLoginPage(page.url())) {
    await clickLoginIfNeeded(page);
    await openBulkMenuFromMain(page);
  }

  if (!isBulkPage(page.url())) {
    throw new Error(
      '대량수집 메인(getGoodsNew.php) 진입 실패.\n로그인·메뉴를 확인한 뒤 ①을 다시 눌러주세요.',
    );
  }

  await maximizePage(page);
  return page;
}

async function launchBrowserOnce(headless = false): Promise<BrowserContext> {
  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(TMG_PROFILE_DIR, {
    headless,
    slowMo: 0,
    viewport: null,
    args: CHROMIUM_ARGS,
  });
  setStoredContext(ctx);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await maximizePage(page);
  await gotoUrl(page, TMG_LOGIN_URL);
  return ctx;
}

export async function attachBrowser(): Promise<BrowserContext> {
  if (contextAlive(getStoredContext())) return getStoredContext()!;

  const cdp = await tryConnectCdp();
  if (contextAlive(cdp)) return cdp!;

  return launchBrowserOnce(false);
}

export async function getCollectBrowserContext(): Promise<BrowserContext> {
  const cdp = await tryConnectCdp();
  if (contextAlive(cdp)) return cdp!;

  if (contextAlive(getStoredContext())) return getStoredContext()!;

  return launchBrowserOnce(false);
}

export function findBulkPage(context: BrowserContext): Page | null {
  for (const p of context.pages()) {
    if (!p.isClosed() && p.url().includes(TMG_BULK_PATH)) return p;
  }
  return null;
}

/** ① Chromium 열기 → 로그인 클릭 → 대량수집 메뉴까지 자동 */
export async function openBrowserToLoginUrl(loginUrl = TMG_LOGIN_URL): Promise<Page> {
  const context = await attachBrowser();
  const page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());
  await maximizePage(page);
  await gotoUrl(page, loginUrl);
  await page.bringToFront();
  return ensureBulkCollectPage(page);
}

export async function openTmgBrowserPage(): Promise<Page> {
  return openBrowserToLoginUrl();
}
