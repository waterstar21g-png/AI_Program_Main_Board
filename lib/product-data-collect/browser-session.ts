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

/** 망고 메인 → 상품데이터수집 → 상품데이터 대량수집 */
async function openBulkMenuFromMain(page: Page) {
  if (isBulkPage(page.url())) return;

  // 상단 메뉴「상품데이터수집」
  const menu = page
    .getByText('상품데이터수집', { exact: true })
    .or(page.locator('a, span, li, div').filter({ hasText: /^상품데이터수집$/ }))
    .first();

  if (await menu.isVisible().catch(() => false)) {
    await menu.hover().catch(() => undefined);
    await menu.click();
  }

  // 하위「상품데이터 대량수집 …」
  const sub = page
    .getByText(/상품데이터\s*대량수집/)
    .or(page.locator('a').filter({ hasText: /상품데이터\s*대량수집/ }))
    .first();

  if (await sub.isVisible().catch(() => false)) {
    await sub.click();
    await page.waitForURL(u => isBulkPage(u.toString()), { timeout: 60000 }).catch(() => undefined);
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  }

  // 메뉴 클릭으로 안 열리면 URL 직접 이동
  if (!isBulkPage(page.url())) {
    await gotoUrl(page, TMG_BULK_URL);
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
