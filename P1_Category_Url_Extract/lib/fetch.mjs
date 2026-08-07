const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function normalizeSiteUrl(input) {
  const raw = input.trim();
  if (!raw) throw new Error('사이트 URL이 비어 있습니다.');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function resolveUrl(href, base) {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export function parseCtgrNo(href) {
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

export function parseBrandNo(href) {
  if (!href) return undefined;
  try {
    const u = new URL(href, 'https://example.com');
    return u.searchParams.get('brandNo') || undefined;
  } catch {
    const m = href.match(/brandNo=([^&]+)/i);
    return m?.[1];
  }
}

export async function fetchHtml(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`페이지 요청 실패 (${res.status}): ${url}`);
  return res.text();
}
