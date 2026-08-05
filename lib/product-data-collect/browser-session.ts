import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';

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

export const ACTION_SLOW_MO = 800;

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

/** 이미 떠 있는 Chromium에 CDP로 붙기 (새 창 안 연다) */
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

/** 최초 1회만 — 이후는 CDP로 재연결 */
async function launchBrowserOnce(headless = false): Promise<BrowserContext> {
  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(TMG_PROFILE_DIR, {
    headless,
    slowMo: ACTION_SLOW_MO,
    viewport: { width: 1400, height: 900 },
    args: CHROMIUM_ARGS,
  });
  setStoredContext(ctx);
  return ctx;
}

/** 수집 시작 — 열린 Chromium만 사용, 새 탭·새 창·goto 없음 */
export async function requireExistingBrowserContext(): Promise<BrowserContext> {
  if (contextAlive(getStoredContext())) return getStoredContext()!;

  const cdp = await tryConnectCdp();
  if (contextAlive(cdp)) return cdp!;

  throw new Error(
    '대량수집 메인(getGoodsNew.php)이 열린 Chromium을 찾지 못했습니다.\n' +
      '① Chromium 연결(한 번) → 직접 대량수집 메인 열기 → ② 수집 시작.\n' +
      '②는 새 창을 열지 않습니다.',
  );
}

/** ① 연결 — CDP 재연결 또는 최초 1회만 Chromium 실행 (goto·새탭 없음) */
export async function attachBrowser(): Promise<BrowserContext> {
  if (contextAlive(getStoredContext())) return getStoredContext()!;

  const cdp = await tryConnectCdp();
  if (contextAlive(cdp)) return cdp!;

  return launchBrowserOnce(false);
}

export function findBulkPage(context: BrowserContext): Page | null {
  for (const p of context.pages()) {
    if (!p.isClosed() && p.url().includes(TMG_BULK_PATH)) return p;
  }
  return null;
}

/** @deprecated 새 화면 열지 않음 — attachBrowser 사용 */
export async function getOrOpenBrowserContext(headless = false): Promise<BrowserContext> {
  return attachBrowser();
}

export async function openTmgBrowserPage(): Promise<Page> {
  const context = await attachBrowser();
  const bulk = findBulkPage(context);
  if (bulk) {
    await bulk.bringToFront();
    return bulk;
  }
  const any = context.pages().find(p => !p.isClosed());
  if (any) {
    await any.bringToFront();
    return any;
  }
  throw new Error('Chromium 탭이 없습니다. 대량수집 메인을 직접 열어주세요.');
}
