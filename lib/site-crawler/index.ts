import type { CrawlRequest, CrawlResult, HierarchyRow, LeafCategory } from '@/lib/types';
import { filterLeavesByTop, sanitizeTopCategories } from '@/lib/top-category-filter';
import {
  fetchHtml,
  getOrigin,
  mapPool,
  normalizeSiteUrl,
  sleep,
} from '@/lib/site-crawler/fetch';
import {
  fetchRepresentativeProductUrl,
  isArtPlatform,
  parseArtPlatformGnb,
} from '@/lib/site-crawler/art-platform';

export async function crawlSite(req: CrawlRequest): Promise<CrawlResult> {
  const siteName = req.siteName.trim() || '사이트';
  const siteUrl = normalizeSiteUrl(req.siteUrl);
  const origin = getOrigin(siteUrl);
  const fetchProducts = req.fetchProducts !== false;
  const productLimit = req.productLimit ?? 0;
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

  const targetLeaves =
    productLimit > 0 && fetchProducts ? leaves.slice(0, productLimit) : leaves;

  if (productLimit > 0 && leaves.length > productLimit) {
    warnings.push(`상품 URL 수집을 ${productLimit}개 카테고리로 제한했습니다.`);
  }

  let productsFetched = 0;
  const rows: HierarchyRow[] = [];

  if (fetchProducts) {
    const productUrls = await mapPool(targetLeaves, 4, async (leaf, idx) => {
      if (idx > 0 && idx % 10 === 0) await sleep(120);
      const productUrl = await fetchRepresentativeProductUrl(origin, leaf);
      if (productUrl.includes('prdtNo=')) productsFetched++;
      return productUrl || leaf.categoryUrl;
    });

    targetLeaves.forEach((leaf, i) => {
      rows.push(toRow(siteName, leaf, productUrls[i]));
    });

    if (productLimit > 0 && leaves.length > productLimit) {
      for (const leaf of leaves.slice(productLimit)) {
        rows.push(toRow(siteName, leaf, leaf.categoryUrl));
      }
    }
  } else {
    for (const leaf of leaves) {
      rows.push(toRow(siteName, leaf, ''));
    }
  }

  return {
    ok: true,
    siteName,
    siteUrl,
    platform: 'A-RT (ABC마트 계열)',
    appliedTopCategories,
    rows,
    totalCategories: leaves.length,
    productsFetched,
    errors,
    warnings,
  };
}

function toRow(siteName: string, leaf: LeafCategory, productUrl: string): HierarchyRow {
  return {
    siteName,
    top: leaf.top,
    mid: leaf.mid,
    low: leaf.low,
    final: leaf.final,
    productUrl,
    categoryUrl: leaf.categoryUrl,
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
    productsFetched: 0,
    errors: [message],
    warnings: [],
  };
}
