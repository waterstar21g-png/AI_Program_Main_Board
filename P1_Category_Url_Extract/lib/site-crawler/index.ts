import type { CrawlRequest, CrawlResult, HierarchyRow, LeafCategory } from '../types';
import { buildTopFinalLabel } from '../top-final-label';
import { filterLeavesByTop, sanitizeTopCategories } from '../top-category-filter';
import { fetchHtml, normalizeSiteUrl } from './fetch';
import { isArtPlatform, parseArtPlatformGnb } from './art-platform';

export async function crawlSite(req: CrawlRequest): Promise<CrawlResult> {
  const siteName = req.siteName.trim() || '사이트';
  const siteUrl = normalizeSiteUrl(req.siteUrl);
  const appliedTopCategories = sanitizeTopCategories(req.topCategories);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!appliedTopCategories.length) {
    return fail(siteName, siteUrl, [], '상위 카테고리를 1개 이상 입력하세요. (최대 15개)');
  }

  let html: string;
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

  const leaves = filterLeavesByTop(allLeaves, appliedTopCategories);
  if (!leaves.length) {
    return fail(
      siteName,
      siteUrl,
      appliedTopCategories,
      `지정한 상위 카테고리(${appliedTopCategories.join(', ')})에 해당하는 메뉴를 찾지 못했습니다.`,
    );
  }

  if (leaves.length < allLeaves.length) {
    warnings.push(
      `상위 카테고리 필터 적용: 전체 ${allLeaves.length}건 중 ${leaves.length}건만 추출 (${appliedTopCategories.join(', ')})`,
    );
  }

  const rows: HierarchyRow[] = leaves.map(leaf => toRow(siteName, leaf));

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

function toRow(siteName: string, leaf: LeafCategory): HierarchyRow {
  return {
    siteName,
    top: leaf.top,
    mid: leaf.mid,
    low: leaf.low,
    final: leaf.final,
    topFinalLabel: buildTopFinalLabel(leaf.top, leaf.final),
    finalCategoryUrl: leaf.categoryUrl,
  };
}

function fail(
  siteName: string,
  siteUrl: string,
  appliedTopCategories: string[],
  message: string,
): CrawlResult {
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
