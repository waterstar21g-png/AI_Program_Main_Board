import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';

export const TMG_PROFILE_DIR = path.join(process.cwd(), '.local', 'tmg-chromium-profile');
export const CDP_URL = 'http://127.0.0.1:9222';
export const TMG_BULK_PATH = 'getGoodsNew.php';

export const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-crash-restore-bubble',
  '--disable-session-crashed-bubble',
  '--remote-debugging-port=9222',
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

async function launchBrowserOnce(headless = false): Promise<BrowserContext> {
  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(TMG_PROFILE_DIR, {
    headless,
    slowMo: 0,
    viewport: { width: 1400, height: 900 },
    args: CHROMIUM_ARGS,
  });
  setStoredContext(ctx);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
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

  throw new Error(
    'Chromium이 연결되지 않았습니다.\n' +
      '① 로그인 URL 열기 → 로그인 → 대량수집 메인 이동 → ② 수집 시작',
  );
}

export function findBulkPage(context: BrowserContext): Page | null {
  for (const p of context.pages()) {
    if (!p.isClosed() && p.url().includes(TMG_BULK_PATH)) return p;
  }
  return null;
}

/** ① 로그인 URL로 Chromium 열기 */
export async function openBrowserToLoginUrl(loginUrl = TMG_LOGIN_URL): Promise<Page> {
  const context = await attachBrowser();
  const page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());
  await gotoUrl(page, loginUrl);
  await page.bringToFront();
  return page;
}

export async function openTmgBrowserPage(): Promise<Page> {
  return openBrowserToLoginUrl();
}
