const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function normalizeSiteUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('사이트 URL이 비어 있습니다.');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function getOrigin(url: string): string {
  return new URL(url).origin;
}

export function resolveUrl(href: string | undefined, base: string): string {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export function parseCtgrNo(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href, 'https://example.com');
    const id = u.searchParams.get('ctgrNo') ?? u.searchParams.get('cat_id');
    return id && /^\d+$/.test(id) ? id : undefined;
  } catch {
    const m = href.match(/ctgrNo=(\d+)/i);
    return m?.[1];
  }
}

export function parseBrandNo(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href, 'https://example.com');
    const id = u.searchParams.get('brandNo');
    return id || undefined;
  } catch {
    const m = href.match(/brandNo=([^&]+)/i);
    return m?.[1];
  }
}

export async function fetchHtml(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      ...(referer ? { Referer: referer } : {}),
    },
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`페이지 요청 실패 (${res.status}): ${url}`);
  return res.text();
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
