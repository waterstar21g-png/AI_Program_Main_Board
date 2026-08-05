import * as cheerio from 'cheerio';
import type { LeafCategory } from '@/lib/types';
import { fetchHtml, parseBrandNo, parseCtgrNo, resolveUrl } from '@/lib/site-crawler/fetch';

export function isArtPlatform(html: string, url: string): boolean {
  return (
    /a-rt\.com/i.test(url) ||
    html.includes('gnb-menu-depth1') ||
    html.includes('abcmart') ||
    html.includes('abc.biz.category')
  );
}

/** A-RT(ABC마트 등) GNB에서 4단계 카테고리 + BRAND 추출 */
export function parseArtPlatformGnb(html: string, baseUrl: string): LeafCategory[] {
  const $ = cheerio.load(html);
  const leaves: LeafCategory[] = [];
  const origin = new URL(baseUrl).origin;

  $('ul.gnb-menu > li.gnb-menu-depth1').each((_, el) => {
    const $el = $(el);

    if ($el.hasClass('menu-brand')) {
      parseBrandSection($, $el, origin, leaves);
      return;
    }

    const top = cleanText($el.find('> button.menu-name, > a.menu-name').first().text());
    if (!top) return;

    $el.find('.sub-depth2').each((__, d2) => {
      const $d2 = $(d2);
      const mid = cleanText($d2.find('.depth2-title a').first().text());

      $d2.find('.sub-depth3 > li.item').each((___, d3li) => {
        const $d3 = $(d3li);
        const lowLink = $d3.find('> a.depth3-title').first();
        const low = cleanText(lowLink.text());
        const lowHref = lowLink.attr('href');
        const d4Links = $d3.find('.sub-depth4 > li.item > a.depth4-title');

        if (d4Links.length > 0) {
          d4Links.each((____, d4a) => {
            const $d4 = $(d4a);
            const href = $d4.attr('href');
            leaves.push({
              top,
              mid,
              low,
              final: cleanText($d4.text()),
              categoryUrl: resolveUrl(href, origin),
              ctgrNo: parseCtgrNo(href),
              kind: 'category',
            });
          });
        } else if (low) {
          leaves.push({
            top,
            mid,
            low: '',
            final: low,
            categoryUrl: resolveUrl(lowHref, origin),
            ctgrNo: parseCtgrNo(lowHref),
            kind: 'category',
          });
        }
      });

      // depth2만 있고 depth3 없는 경우
      if (!$d2.find('.sub-depth3 > li.item').length && mid) {
        const midHref = $d2.find('.depth2-title a').first().attr('href');
        leaves.push({
          top,
          mid: '',
          low: '',
          final: mid,
          categoryUrl: resolveUrl(midHref, origin),
          ctgrNo: parseCtgrNo(midHref),
          kind: 'category',
        });
      }
    });
  });

  return dedupeLeaves(leaves);
}

function parseBrandSection(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $brandLi: cheerio.Cheerio<any>,
  origin: string,
  leaves: LeafCategory[],
): void {
  $brandLi.find('.all-brand-list-wrap a[href*="brandNo"]').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href');
    const name =
      cleanText($a.find('.brand-name').text()) ||
      cleanText($a.attr('title') ?? '') ||
      cleanText($a.text());
    if (!name || !href) return;

    leaves.push({
      top: 'BRAND',
      mid: '',
      low: '',
      final: name,
      categoryUrl: resolveUrl(href, origin),
      brandNo: parseBrandNo(href),
      kind: 'brand',
    });
  });
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function dedupeLeaves(leaves: LeafCategory[]): LeafCategory[] {
  const seen = new Set<string>();
  return leaves.filter(l => {
    const key = [l.top, l.mid, l.low, l.final, l.ctgrNo ?? l.brandNo ?? l.categoryUrl].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 카테고리 목록 API에서 첫 상품 URL */
export async function fetchCategoryProductUrl(origin: string, ctgrNo: string): Promise<string> {
  const api = new URL('/display/category/product/list', origin);
  api.searchParams.set('ctgrNo', ctgrNo);
  api.searchParams.set('pagingSortType', 'best');
  api.searchParams.set('rowsPerPage', '1');
  api.searchParams.set('pageNum', '1');

  const html = await fetchHtml(api.toString(), `${origin}/display/category`);
  const m = html.match(/href="(\/product\?prdtNo=\d+)"/i);
  if (!m) return '';
  return resolveUrl(m[1], origin);
}

/** 브랜드 페이지에서 첫 상품 URL */
export async function fetchBrandProductUrl(origin: string, brandPageUrl: string): Promise<string> {
  const html = await fetchHtml(brandPageUrl, origin);
  const m = html.match(/href="(\/product\?prdtNo=\d+)"/i);
  if (!m) return brandPageUrl;
  return resolveUrl(m[1], origin);
}

export async function fetchRepresentativeProductUrl(origin: string, leaf: LeafCategory): Promise<string> {
  try {
    if (leaf.kind === 'brand') {
      return (await fetchBrandProductUrl(origin, leaf.categoryUrl)) || leaf.categoryUrl;
    }
    if (leaf.ctgrNo) {
      const url = await fetchCategoryProductUrl(origin, leaf.ctgrNo);
      return url || leaf.categoryUrl;
    }
    return leaf.categoryUrl;
  } catch {
    return leaf.categoryUrl;
  }
}
