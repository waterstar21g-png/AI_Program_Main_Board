import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { TMG_BULK_URL } from '@/lib/product-data-collect/steps';

export const TMG_PROFILE_DIR = path.join(process.cwd(), '.local', 'tmg-chromium-profile');

export const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
];

export const ACTION_SLOW_MO = 800;

let sharedContext: BrowserContext | null = null;

export function getSharedContext() {
  return sharedContext;
}

export async function getOrOpenBrowserContext(headless = false): Promise<BrowserContext> {
  if (sharedContext) {
    const alive = sharedContext.pages().some(p => !p.isClosed());
    if (alive) return sharedContext;
    await sharedContext.close().catch(() => undefined);
    sharedContext = null;
  }

  fs.mkdirSync(TMG_PROFILE_DIR, { recursive: true });
  sharedContext = await chromium.launchPersistentContext(TMG_PROFILE_DIR, {
    headless,
    slowMo: ACTION_SLOW_MO,
    viewport: { width: 1400, height: 900 },
    args: CHROMIUM_ARGS,
  });
  return sharedContext;
}

export async function openTmgBrowserPage(): Promise<Page> {
  const context = await getOrOpenBrowserContext(false);
  const page = context.pages().find(p => !p.isClosed()) ?? await context.newPage();
  await page.goto(TMG_BULK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.bringToFront();
  return page;
}
