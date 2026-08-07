import { parseBrandNo, parseCtgrNo, resolveUrl } from './fetch.mjs';

export function buildArtCategoryBrowseUrl(origin, href) {
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

export function buildArtBrandBrowseUrl(origin, href) {
  const brandNo = parseBrandNo(href);
  if (!brandNo) return resolveUrl(href, origin);
  const browse = new URL(`${origin}/product/brand/page/main`);
  browse.searchParams.set('brandNo', brandNo);
  return browse.toString();
}

export function buildArtBrowseUrl(origin, href, kind) {
  return kind === 'brand'
    ? buildArtBrandBrowseUrl(origin, href)
    : buildArtCategoryBrowseUrl(origin, href);
}

export function buildTopFinalLabel(top, final) {
  const t = top.trim();
  const f = final.trim();
  if (!t) return f;
  if (!f) return t;
  return `${t} ${f}`;
}

export function normalizeTopName(name) {
  return name.trim().toUpperCase();
}

export function sanitizeTopCategories(input, max = 15) {
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const name = String(raw).trim();
    if (!name) continue;
    const key = normalizeTopName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export function filterLeavesByTop(leaves, topCategories) {
  const allowed = sanitizeTopCategories(topCategories);
  if (!allowed.length) return [];
  return leaves.filter(l =>
    allowed.some(a => normalizeTopName(a) === normalizeTopName(l.top)),
  );
}
