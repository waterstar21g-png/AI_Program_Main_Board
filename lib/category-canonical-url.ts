import { parseBrandNo, parseCtgrNo, resolveUrl } from '@/lib/site-crawler/fetch';

/**
 * ABC마트 등 A-RT — GNB href → 브라우저 주소창에 보이는 카테고리 URL
 * 예: /display/category/main?genderGbnCode=10000&ctgrNo=1000000762&page=1
 */
export function buildArtCategoryBrowseUrl(origin: string, href: string): string {
  const ctgrNo = parseCtgrNo(href);
  if (!ctgrNo) return resolveUrl(href, origin);

  let genderGbnCode = '10000';
  try {
    const u = new URL(href, origin);
    genderGbnCode = u.searchParams.get('genderGbnCode') ?? genderGbnCode;
  } catch {
    const m = href.match(/genderGbnCode=(\d+)/i);
    if (m) genderGbnCode = m[1];
  }

  const browse = new URL(`${origin}/display/category/main`);
  browse.searchParams.set('genderGbnCode', genderGbnCode);
  browse.searchParams.set('ctgrNo', ctgrNo);
  browse.searchParams.set('page', '1');
  return browse.toString();
}

/** 브랜드 페이지 — 브라우저 canonical URL */
export function buildArtBrandBrowseUrl(origin: string, href: string): string {
  const brandNo = parseBrandNo(href);
  if (!brandNo) return resolveUrl(href, origin);

  const browse = new URL(`${origin}/product/brand/page/main`);
  browse.searchParams.set('brandNo', brandNo);
  return browse.toString();
}

export function buildArtBrowseUrl(origin: string, href: string, kind: 'category' | 'brand'): string {
  return kind === 'brand'
    ? buildArtBrandBrowseUrl(origin, href)
    : buildArtCategoryBrowseUrl(origin, href);
}
