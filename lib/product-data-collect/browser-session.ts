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

/** 창 최대화 — 수집 중 호출 금지 (ABC 팝업이 뒤로 밀림) */
export async function maximizePage(page: Page) {
  // intentionally no-op during automated collection
  void page;
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

/**
 * DOM에 숨겨진(display:none) 드롭다운도 JS로 열어
 * 「상품데이터수집」→「상품데이터 대량수집」클릭
 * 프레임 포함 전체 탐색
 */
async function jsClickBulkSubmenu(page: Page): Promise<string> {
  const contexts = [page.mainFrame(), ...page.frames().filter(f => f !== page.mainFrame())];

  for (const ctx of contexts) {
    const result = await ctx
      .evaluate(() => {
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

        const fire = (el: Element, type: string) => {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        };

        const reveal = (el: HTMLElement) => {
          let cur: HTMLElement | null = el;
          while (cur) {
            const st = cur.style;
            if (st) {
              if (st.display === 'none') st.display = 'block';
              if (st.visibility === 'hidden') st.visibility = 'visible';
            }
            cur = cur.parentElement;
          }
        };

        const clickEl = (el: HTMLElement) => {
          reveal(el);
          fire(el, 'mouseover');
          fire(el, 'mouseenter');
          fire(el, 'mousedown');
          fire(el, 'mouseup');
          el.click();
        };

        // A) href에 getGoodsNew 있는 링크 직접 클릭 (숨김 포함)
        const hrefLinks = Array.from(
          document.querySelectorAll('a[href*="getGoodsNew"]'),
        ) as HTMLAnchorElement[];
        if (hrefLinks.length) {
          const preferred =
            hrefLinks.find(a => /대량수집|리스팅/.test(norm(a.textContent || ''))) ?? hrefLinks[0]!;
          clickEl(preferred);
          return `href:${preferred.href}`;
        }

        // B) 상단「상품데이터수집」열기
        const nodes = Array.from(document.querySelectorAll('a, li, span, td, th, div, button'));
        const top = nodes.find(el => {
          const t = norm(el.textContent || '');
          // 하위메뉴 문구가 길게 섞인 노드는 제외
          if (t.includes('대량수집')) return false;
          return t === '상품데이터수집' || /^상품데이터수집$/.test(t);
        }) as HTMLElement | undefined;

        if (top) {
          clickEl(top);
          fire(top, 'mouseover');
          fire(top, 'mouseenter');
        }

        // C) 하위「상품데이터 대량수집 …」
        const sub = nodes.find(el => {
          const t = norm(el.textContent || '');
          return /상품데이터\s*대량수집/.test(t) || /대량수집.*리스팅페이지/.test(t);
        }) as HTMLElement | undefined;

        if (sub) {
          const link = (sub.closest('a') as HTMLElement | null) || sub;
          clickEl(link);
          return `text:${norm(link.textContent || '').slice(0, 80)}`;
        }

        return '';
      })
      .catch(() => '');

    if (result) return result;
  }
  return '';
}

/**
 * 상단「상품데이터수집」→「상품데이터 대량수집 (리스팅페이지 URL 이용)」클릭
 * (이미 대량수집 화면이어도 다시 클릭 — 초기화 효과)
 */
export async function clickBulkCollectMenu(page: Page): Promise<void> {
  // bringToFront / hover / force 금지 — 창순서·팝업 건드리지 않음

  const visibleSub = page
    .locator('a[href*="getGoodsNew"]')
    .or(page.getByRole('link', { name: /상품데이터\s*대량수집/ }))
    .or(page.locator('a').filter({ hasText: /상품데이터\s*대량수집/ }))
    .first();

  const top = page
    .locator('a, li, span, td')
    .filter({ hasText: /^상품데이터수집$/ })
    .first();

  if (await top.isVisible().catch(() => false)) {
    await top.click({ timeout: 5000 }).catch(() => undefined);
    await sleep(300);
  }

  if (await visibleSub.isVisible().catch(() => false)) {
    await visibleSub.click({ timeout: 5000 }).catch(() => undefined);
    await waitBulkReady(page);
    return;
  }

  const viaJs = await jsClickBulkSubmenu(page);
  if (viaJs) {
    await sleep(500);
    await waitBulkReady(page);
    return;
  }

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
  // bringToFront / maximize 금지

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

  // 로그인 직후 상단 메뉴가 그려질 때까지 대기
  if (!isBulkPage(page.url()) && !isLoginPage(page.url())) {
    await page
      .getByText(/상품데이터수집/)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => undefined);
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
    await page
      .getByText(/상품데이터수집/)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => undefined);
    await openBulkMenuFromMain(page);
  }

  if (!isBulkPage(page.url())) {
    throw new Error(
      '대량수집 메인(getGoodsNew.php) 진입 실패.\n로그인·메뉴를 확인한 뒤 ①을 다시 눌러주세요.',
    );
  }

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
  await gotoUrl(page, TMG_LOGIN_URL);
  return ctx;
}

export async function attachBrowser(): Promise<BrowserContext> {
  if (contextAlive(getStoredContext())) return getStoredContext()!;

  const cdp = await tryConnectCdp();
  if (contextAlive(cdp)) return cdp!;

  return launchBrowserOnce(false);
}

export async function getCollectBrowserContextForRun(): Promise<BrowserContext> {
  const cdp = await tryConnectCdp();
  if (contextAlive(cdp)) return cdp!;

  if (contextAlive(getStoredContext())) return getStoredContext()!;

  throw new Error(
    'Chromium에 연결되지 않았습니다.\n' +
      '먼저 ① 로그인→대량수집 을 누른 뒤 ② 수집을 누르세요.\n' +
      '(수집 중 새 창/탭을 열지 않습니다)',
  );
}

/** @deprecated 수집 루프에서는 getCollectBrowserContextForRun 사용 */
export async function getCollectBrowserContext(): Promise<BrowserContext> {
  return getCollectBrowserContextForRun();
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
  const existing = context.pages().find(p => !p.isClosed());
  if (!existing) {
    throw new Error('Chromium 탭이 없습니다. 브라우저를 먼저 실행해 주세요.');
  }
  const page = existing;
  if (!isBulkPage(page.url())) {
    await gotoUrl(page, loginUrl);
  }
  return ensureBulkCollectPage(page);
}

export async function openTmgBrowserPage(): Promise<Page> {
  return openBrowserToLoginUrl();
}
