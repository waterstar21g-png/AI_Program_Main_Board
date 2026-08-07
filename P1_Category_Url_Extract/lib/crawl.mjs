import { fetchHtml, normalizeSiteUrl } from './fetch.mjs';
import {
  buildTopFinalLabel,
  filterLeavesByTop,
  sanitizeTopCategories,
} from './helpers.mjs';
import { isArtPlatform, parseArtPlatformGnb } from './art-platform.mjs';

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

export async function crawlSite({ siteName, siteUrl: rawUrl, topCategories }) {
  const site = (siteName || '사이트').trim() || '사이트';
  const siteUrl = normalizeSiteUrl(rawUrl);
  const appliedTopCategories = sanitizeTopCategories(topCategories);
  const errors = [];
  const warnings = [];

  if (!appliedTopCategories.length) {
    return fail(site, siteUrl, [], '상위 카테고리를 1개 이상 입력하세요. (최대 15개)');
  }

  let html;
  try {
    html = await fetchHtml(siteUrl);
  } catch (e) {
    return fail(site, siteUrl, appliedTopCategories, e instanceof Error ? e.message : '홈페이지 로드 실패');
  }

  if (!isArtPlatform(html, siteUrl)) {
    return fail(
      site,
      siteUrl,
      appliedTopCategories,
      '지원하지 않는 사이트 형식입니다. 현재 A-RT 계열(ABC마트 등) GNB 구조를 지원합니다.',
    );
  }

  const allLeaves = parseArtPlatformGnb(html, siteUrl);
  if (!allLeaves.length) {
    return fail(site, siteUrl, appliedTopCategories, '카테고리 메뉴(GNB)를 찾지 못했습니다.');
  }

  const leaves = filterLeavesByTop(allLeaves, appliedTopCategories);
  if (!leaves.length) {
    return fail(
      site,
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
    siteName: site,
    top: leaf.top,
    mid: leaf.mid,
    low: leaf.low,
    final: leaf.final,
    topFinalLabel: buildTopFinalLabel(leaf.top, leaf.final),
    finalCategoryUrl: leaf.categoryUrl,
  }));

  return {
    ok: true,
    siteName: site,
    siteUrl,
    platform: 'A-RT (ABC마트 계열)',
    appliedTopCategories,
    rows,
    totalCategories: leaves.length,
    errors,
    warnings,
  };
}
