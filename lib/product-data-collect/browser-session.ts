import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import {
  TMG_BULK_URL,
  TMG_MAIN_URL,
  TMG_ADMIN_HOST,
  TMG_BULK_PATH,
} from '@/lib/product-data-collect/steps';

export const TMG_PROFILE_DIR = path.join(process.cwd(), '.local', 'tmg-chromium-profile');
export const CDP_URL = 'http://127.0.0.1:9222';
export { TMG_ADMIN_HOST, TMG_BULK_PATH } from '@/lib/product-data-collect/steps';

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

function contextAlive(ctx: BrowserContext | null): ctx is BrowserContext {
  return !!ctx && ctx.pages().some(p => !p.isClosed());
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function isLoginPage(url: string) {
  return url.includes('admin_login');
}

function isBulkPage(url: string) {
  return url.includes(TMG_BULK_PATH);
}

/* ── 페이지 전환 중 오류 방어 ──────────────────────────────
 * 로그인 직후 사이트 자체가 리다이렉트 중일 때 page.goto()나
 * DOM 조회를 하면 "interrupted by another navigation" /
 * "Execution context was destroyed" / "Target closed" 오류가 난다.
 * 페이지가 안정될 때까지 기다렸다가 재시도한다.
 */
const NAV_ERROR_MARKERS = [
  'interrupted by another navigation',
  'Execution context was destroyed',
  'context was destroyed',
  'Target closed',
  'Target page, context or browser has been closed',
];

function isNavError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return NAV_ERROR_MARKERS.some(m => msg.includes(m));
}

export async function withNavRetry<T>(page: Page, fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isNavError(e)) throw e;
      lastErr = e;
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      await sleep(800);
    }
  }
  throw lastErr;
}

export async function safeGoto(page: Page, url: string, retries = 3): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      return;
    } catch (e) {
      if (!isNavError(e)) throw e;
      lastErr = e;
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
      await sleep(800);
    }
  }
  throw lastErr;
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
  if (current.includes(TMG_BULK_PATH) && url.includes(TMG_BULK_PATH)) return;
  if (current === url) return;
  await safeGoto(page, url);
}

async function clickLoginIfNeeded(page: Page) {
  if (!isLoginPage(page.url())) return;
  const loginBtn = page
    .locator('form#loginForm button[type="submit"], form#loginForm input[type="submit"]')
    .or(page.getByRole('button', { name: /^로그인$/ }))
    .or(page.locator('input[type="submit"][value="로그인"]'))
    .first();
  await loginBtn.waitFor({ state: 'visible', timeout: 30_000 });
  await loginBtn.click();
  await page.waitForURL(u => !isLoginPage(u.toString()), { timeout: 120_000 }).catch(() => undefined);
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
}

async function waitBulkReadyOnce(page: Page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
  if (!isBulkPage(page.url())) {
    await safeGoto(page, TMG_BULK_URL);
  }
  await page
    .locator('input[type="button"][value*="URL"], input[type="submit"][value*="URL"]')
    .or(page.getByText(/URL\s*상품\s*검색/))
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 });
}

async function waitBulkReady(page: Page) {
  await withNavRetry(page, () => waitBulkReadyOnce(page));
}

async function resetBulkCollectViaMenuOnce(page: Page): Promise<void> {
  // href 직접 클릭이 가장 확실
  const href = page.locator('a[href*="getGoodsNew"]').first();
  if (await href.count().then(c => c > 0).catch(() => false)) {
    await href.click({ timeout: 5000 }).catch(async () => {
      await href.evaluate(el => (el as HTMLElement).click());
    });
    await sleep(800);
    if (isBulkPage(page.url())) {
      await waitBulkReady(page);
      return;
    }
  }

  // 메뉴 텍스트로 클릭 (대량데이터수집 / 상품데이터 대량수집 등 표기 차이 허용)
  await page.evaluate(() => {
    const clean = (s: string | null) => (s || '').replace(/\s+/g, '');
    const nodes = Array.from(document.querySelectorAll('a, li, span, td, div, button'));

    const byHref = Array.from(
      document.querySelectorAll('a[href*="getGoodsNew"]'),
    ) as HTMLAnchorElement[];
    if (byHref[0]) {
      byHref[0].click();
      return;
    }

    const top = nodes.find(el => clean(el.textContent) === '상품데이터수집');
    if (top) (top as HTMLElement).click();

    const sub = nodes.find(el => {
      const t = clean(el.textContent);
      if (t.length > 30) return false;
      return /대량데이터수집|대량수집|상품데이터대량/.test(t);
    });
    if (sub) ((sub.closest('a') as HTMLElement) || (sub as HTMLElement)).click();
  }).catch(() => undefined);

  await sleep(1000);
  if (!isBulkPage(page.url())) {
    await safeGoto(page, TMG_BULK_URL);
  }
  await waitBulkReady(page);
}

/** 상품데이터수집 → 대량데이터수집 (실패 시 URL 이동) */
export async function resetBulkCollectViaMenu(page: Page): Promise<void> {
  await withNavRetry(page, () => resetBulkCollectViaMenuOnce(page));
}

export async function ensureBulkCollectPage(page: Page): Promise<Page> {
  if (isBulkPage(page.url())) {
    await waitBulkReady(page);
    return page;
  }

  if (isLoginPage(page.url()) || !page.url().includes(TMG_ADMIN_HOST)) {
    await gotoUrl(page, TMG_MAIN_URL);
    await clickLoginIfNeeded(page);
  }
  if (isLoginPage(page.url())) {
    await clickLoginIfNeeded(page);
  }

  if (!isBulkPage(page.url())) {
    await resetBulkCollectViaMenu(page);
  }
  if (!isBulkPage(page.url())) {
    await gotoUrl(page, TMG_BULK_URL);
  }
  if (isLoginPage(page.url())) {
    await clickLoginIfNeeded(page);
    await gotoUrl(page, TMG_BULK_URL);
  }
  await waitBulkReady(page);
  return page;
}

async function launchBrowserOnce(): Promise<BrowserContext> {
  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  const opts = { headless: false, slowMo: 0, viewport: null as null, args: CHROMIUM_ARGS };
  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext(TMG_PROFILE_DIR, { ...opts, channel: 'chrome' });
  } catch {
    try {
      ctx = await chromium.launchPersistentContext(TMG_PROFILE_DIR, { ...opts, channel: 'msedge' });
    } catch {
      ctx = await chromium.launchPersistentContext(TMG_PROFILE_DIR, opts);
    }
  }
  setStoredContext(ctx);
  return ctx;
}

export function findBulkPage(context: BrowserContext): Page | null {
  for (const p of context.pages()) {
    if (!p.isClosed() && p.url().includes(TMG_BULK_PATH)) return p;
  }
  return null;
}

export async function findMangoWorkPage(context: BrowserContext): Promise<Page | null> {
  const bulk = findBulkPage(context);
  if (bulk) return bulk;
  for (const p of context.pages()) {
    if (p.isClosed()) continue;
    const hasBtn = await p
      .locator('input[type="button"][value*="URL"], input[type="submit"][value*="URL"]')
      .or(p.getByText(/URL\s*상품\s*검색/))
      .first()
      .isVisible()
      .catch(() => false);
    if (hasBtn) return p;
  }
  return null;
}

/**
 * 탭이 닫혔으면(로그인 중계 페이지가 자기 자신을 닫는 경우 등)
 * 같은 컨텍스트에서 살아있는 페이지를 다시 찾아온다.
 */
export function refreshIfClosed(context: BrowserContext, page: Page): Page {
  if (!page.isClosed()) return page;
  const openPages = context.pages().filter(p => !p.isClosed());
  for (const p of openPages) {
    try {
      if (p.url().includes(TMG_ADMIN_HOST)) return p;
    } catch {
      continue;
    }
  }
  return openPages[0] ?? page;
}

/**
 * 수집용 브라우저 준비 — 반드시 대량수집 화면까지 연 뒤 context 반환
 * 세션이 살아있으면 로그인 화면을 거치지 않고 바로 메인화면(admin.php)에서
 * 시작한다. 만료된 경우에만 로그인 화면으로 리다이렉트되어 수동 로그인이
 * 필요할 수 있다(그 경우 ensureBulkCollectPage가 로그인 완료를 기다린다).
 */
export async function ensureCollectBrowserReady(): Promise<{ context: BrowserContext; page: Page }> {
  // 1) 이미 열린 CDP/저장 컨텍스트에 대량수집 있으면 그대로
  for (const tryCtx of [await tryConnectCdp(), getStoredContext()]) {
    if (!contextAlive(tryCtx)) continue;
    setStoredContext(tryCtx);
    let page = await findMangoWorkPage(tryCtx);
    if (page) {
      await waitBulkReady(page);
      return { context: tryCtx, page };
    }
    // 탭은 있는데 대량수집 아님 → 그 탭에서 진입
    page = tryCtx.pages().find(p => !p.isClosed()) ?? (await tryCtx.newPage());
    await ensureBulkCollectPage(page);
    page = refreshIfClosed(tryCtx, page);
    return { context: tryCtx, page };
  }

  // 2) 새로 실행 — 로그인 화면이 아닌 메인화면으로 바로 이동
  const ctx = await launchBrowserOnce();
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await gotoUrl(page, TMG_MAIN_URL);
  await ensureBulkCollectPage(page);
  return { context: ctx, page: refreshIfClosed(ctx, page) };
}

export async function openBrowserToLoginUrl(loginUrl = TMG_MAIN_URL): Promise<Page> {
  const { page } = await ensureCollectBrowserReady();
  if (!isBulkPage(page.url()) && loginUrl) {
    await gotoUrl(page, loginUrl);
    await ensureBulkCollectPage(page);
  }
  return page;
}

export async function openTmgBrowserPage(): Promise<Page> {
  return openBrowserToLoginUrl();
}

/** 하위 호환 */
export async function getCollectBrowserContextForRun(): Promise<BrowserContext> {
  const { context } = await ensureCollectBrowserReady();
  return context;
}

export async function maximizePage(_page: Page) {
  /* no-op */
}
