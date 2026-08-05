export const MAX_TOP_CATEGORIES = 15;

export interface CrawlRequest {
  siteName: string;
  siteUrl: string;
  /** 사용자 지정 상위 카테고리 (1~15개, 이 목록에 해당하는 것만 추출) */
  topCategories: string[];
}

export interface HierarchyRow {
  siteName: string;
  top: string;
  mid: string;
  low: string;
  final: string;
  /** 최종 카테고리 클릭 시 이동하는 URL */
  finalCategoryUrl: string;
}

export interface CrawlResult {
  ok: boolean;
  siteName: string;
  siteUrl: string;
  platform: string;
  appliedTopCategories: string[];
  rows: HierarchyRow[];
  totalCategories: number;
  errors: string[];
  warnings: string[];
}

export interface LeafCategory {
  top: string;
  mid: string;
  low: string;
  final: string;
  categoryUrl: string;
  ctgrNo?: string;
  brandNo?: string;
  kind: 'category' | 'brand';
}
