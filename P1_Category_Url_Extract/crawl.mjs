/**
 * P1 — A-RT(ABC마트 계열) GNB 카테고리 URL 추출
 * (구 lib/site-crawler + 관련 유틸을 배치용으로 합침)
 */
import * as cheerio from 'cheerio';

const MAX_TOP = 15;
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const CATEGORY_EXCEL_HEADERS = [
  '상위 카테고리명',
  '중위 카테고리명',
  '하위 카테고리명',
  '최종 카테고리명',
  '상위 최종 카테고리명',
  '최종 카테고리 URL주소',
];

export function normalizeSiteUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('사이트 URL이 비어 있습니다.');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

function normalizeTopName(name) {
  return name.trim().toUpperCase();
}

export function sanitizeTopCategories(input, max = MAX_TOP) {
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    const key = normalizeTopName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

function resolveUrl(href, base) {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function parseCtgrNo(href) {
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

function parseBrandNo(href) {
  if (!href) return undefined;
  try {
    const u = new URL(href, 'https://example.com');
    return u.searchParams.get('brandNo') || undefined;
  } catch {
    const m = href.match(/brandNo=([^&]+)/i);
    return m?.[1];
  }
}

function buildArtCategoryBrowseUrl(origin, href) {
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

function buildArtBrandBrowseUrl(origin, href) {
  const brandNo = parseBrandNo(href);
  if (!brandNo) return resolveUrl(href, origin);
  const browse = new URL(`${origin}/product/brand/page/main`);
  browse.searchParams.set('brandNo', brandNo);
  return browse.toString();
}

function buildArtBrowseUrl(origin, href, kind) {
  return kind === 'brand'
    ? buildArtBrandBrowseUrl(origin, href)
    : buildArtCategoryBrowseUrl(origin, href);
}

function buildTopFinalLabel(top, final) {
  const t = top.trim();
  const f = final.trim();
  if (!t) return f;
  if (!f) return t;
  return `${t} ${f}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`페이지 요청 실패 (${res.status}): ${url}`);
  return res.text();
}

function isArtPlatform(html, url) {
  return (
    /a-rt\.com/i.test(url) ||
    html.includes('gnb-menu-depth1') ||
    html.includes('abcmart') ||
    html.includes('abc.biz.category')
  );
}

function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function dedupeLeaves(leaves) {
  const seen = new Set();
  return leaves.filter(l => {
    const key = [l.top, l.mid, l.low, l.final, l.ctgrNo ?? l.brandNo ?? l.categoryUrl].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseBrandSection($, $brandLi, origin, leaves) {
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
      categoryUrl: buildArtBrowseUrl(origin, href, 'brand'),
      brandNo: parseBrandNo(href),
      kind: 'brand',
    });
  });
}

function parseArtPlatformGnb(html, baseUrl) {
  const $ = cheerio.load(html);
  const leaves = [];
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
              categoryUrl: buildArtBrowseUrl(origin, href ?? '', 'category'),
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
            categoryUrl: buildArtBrowseUrl(origin, lowHref ?? '', 'category'),
            ctgrNo: parseCtgrNo(lowHref),
            kind: 'category',
          });
        }
      });

      if (!$d2.find('.sub-depth3 > li.item').length && mid) {
        const midHref = $d2.find('.depth2-title a').first().attr('href');
        leaves.push({
          top,
          mid: '',
          low: '',
          final: mid,
          categoryUrl: buildArtBrowseUrl(origin, midHref ?? '', 'category'),
          ctgrNo: parseCtgrNo(midHref),
          kind: 'category',
        });
      }
    });
  });

  return dedupeLeaves(leaves);
}

function matchesTopCategory(leafTop, allowed) {
  const key = normalizeTopName(leafTop);
  return allowed.some(a => normalizeTopName(a) === key);
}

function fail(siteName, siteUrl, appliedTopCategories, message) {
  return {
    ok: false,
    siteName,
    siteUrl,
    platform: '',
    appliedTopCategories,
    rows: [],
    totalCategories: 0,
    errors: [message],
    warnings: [],
  };
}

/** @param {{ siteName: string, siteUrl: string, topCategories: string[] }} req */
export async function crawlSite(req) {
  const siteName = String(req.siteName ?? '').trim() || '사이트';
  const siteUrl = normalizeSiteUrl(req.siteUrl);
  const appliedTopCategories = sanitizeTopCategories(req.topCategories ?? []);
  const errors = [];
  const warnings = [];

  if (!appliedTopCategories.length) {
    return fail(siteName, siteUrl, [], '상위 카테고리를 1개 이상 입력하세요. (최대 15개)');
  }

  let html;
  try {
    html = await fetchHtml(siteUrl);
  } catch (e) {
    return fail(siteName, siteUrl, appliedTopCategories, e instanceof Error ? e.message : '홈페이지 로드 실패');
  }

  if (!isArtPlatform(html, siteUrl)) {
    return fail(
      siteName,
      siteUrl,
      appliedTopCategories,
      '지원하지 않는 사이트 형식입니다. 현재 A-RT 계열(ABC마트 등) GNB 구조를 지원합니다.',
    );
  }

  const allLeaves = parseArtPlatformGnb(html, siteUrl);
  if (!allLeaves.length) {
    return fail(siteName, siteUrl, appliedTopCategories, '카테고리 메뉴(GNB)를 찾지 못했습니다.');
  }

  const leaves = allLeaves.filter(l => matchesTopCategory(l.top, appliedTopCategories));
  if (!leaves.length) {
    return fail(
      siteName,
      siteUrl,
      appliedTopCategories,
      `지정한 상위 카테고리(${appliedTopCategories.join(', ')})에 맞는 메뉴를 찾지 못했습니다.`,
    );
  }

  if (leaves.length < allLeaves.length) {
    warnings.push(
      `상위 카테고리 필터 적용: 전체 ${allLeaves.length}건 중 ${leaves.length}건만 추출 (${appliedTopCategories.join(', ')})`,
    );
  }

  const rows = leaves.map(leaf => ({
    siteName,
    top: leaf.top,
    mid: leaf.mid,
    low: leaf.low,
    final: leaf.final,
    topFinalLabel: buildTopFinalLabel(leaf.top, leaf.final),
    finalCategoryUrl: leaf.categoryUrl,
  }));

  return {
    ok: true,
    siteName,
    siteUrl,
    platform: 'A-RT (ABC마트 계열)',
    appliedTopCategories,
    rows,
    totalCategories: leaves.length,
    errors,
    warnings,
  };
}

export function hierarchyToSheetData(rows) {
  const data = [CATEGORY_EXCEL_HEADERS.slice()];
  for (const r of rows) {
    data.push([r.top, r.mid, r.low, r.final, r.topFinalLabel, r.finalCategoryUrl]);
  }
  return data;
}
