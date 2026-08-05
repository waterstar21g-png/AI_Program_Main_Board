import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { TMG_BULK_URL } from '@/lib/product-data-collect/steps';

export const TMG_PROFILE_DIR = path.join(process.cwd(), '.local', 'tmg-chromium-profile');

export const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-crash-restore-bubble',
  '--disable-session-crashed-bubble',
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

/** ① Chromium 열기 — 여기서만 새 창을 연다 */
export async function getOrOpenBrowserContext(headless = false): Promise<BrowserContext> {
  let sharedContext = getStoredContext();
  if (sharedContext) {
    const alive = sharedContext.pages().some(p => !p.isClosed());
    if (alive) return sharedContext;
    await sharedContext.close().catch(() => undefined);
    setStoredContext(null);
    sharedContext = null;
  }

  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  sharedContext = await chromium.launchPersistentContext(TMG_PROFILE_DIR, {
    headless,
    slowMo: ACTION_SLOW_MO,
    viewport: { width: 1400, height: 900 },
    args: CHROMIUM_ARGS,
  });
  setStoredContext(sharedContext);
  return sharedContext;
}

/** ② 수집 시작 — 이미 연 Chromium만 사용, 새 창 절대 안 연다 */
export async function requireExistingBrowserContext(): Promise<BrowserContext> {
  const sharedContext = getStoredContext();
  if (sharedContext) {
    const alive = sharedContext.pages().some(p => !p.isClosed());
    if (alive) return sharedContext;
    await sharedContext.close().catch(() => undefined);
    setStoredContext(null);
  }

  throw new Error(
    '먼저 ① Chromium 열기를 누르세요.\n' +
      '②는 새 창을 열지 않습니다. ①으로 연 Chromium에서 대량수집(getGoodsNew.php) 화면을 연 뒤 다시 시도하세요.',
  );
}

export async function openTmgBrowserPage(): Promise<Page> {
  const context = await getOrOpenBrowserContext(false);

  for (const p of context.pages()) {
    if (!p.isClosed() && p.url().includes('getGoodsNew.php')) {
      await p.bringToFront();
      return p;
    }
  }

  const page =
    context.pages().find(p => !p.isClosed() && !p.url().includes('about:blank')) ??
    context.pages().find(p => !p.isClosed()) ??
    (await context.newPage());

  if (!page.url().includes('getGoodsNew.php')) {
    await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.bringToFront();
  return page;
}
