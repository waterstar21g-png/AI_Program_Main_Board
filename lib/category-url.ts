/** 네이버 쇼핑 대분류 catId — 데이터랩·쇼핑인사이트 기준 */
export const DEFAULT_CATEGORIES = [
  { name: '패션의류', catId: '50000000' },
  { name: '패션잡화', catId: '50000001' },
  { name: '화장품/미용', catId: '50000002' },
  { name: '디지털/가전', catId: '50000003' },
  { name: '가구/인테리어', catId: '50000004' },
  { name: '출산/육아', catId: '50000005' },
  { name: '식품', catId: '50000006' },
  { name: '스포츠/레저', catId: '50000007' },
  { name: '생활/건강', catId: '50000008' },
  { name: '여가/생활편의', catId: '50000009' },
] as const;

export function buildCategoryListUrl(catId: string): string {
  const id = catId.trim();
  return `https://search.shopping.naver.com/search/category?catId=${encodeURIComponent(id)}`;
}

/** URL 또는 catId 숫자에서 catId 추출 */
export function parseCatId(input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  if (/^\d{5,}$/.test(raw)) return raw;
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const fromQuery = url.searchParams.get('catId') ?? url.searchParams.get('cat_id');
    if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
    const pathMatch = url.pathname.match(/(\d{5,})/);
    if (pathMatch) return pathMatch[1];
  } catch {
  }
  return undefined;
}

/** 카테고리 대표 목록 URL 결정 */
export function resolveCategoryUrl(name: string, catId?: string, listUrl?: string): string {
  const fromId = catId?.trim() || (listUrl ? parseCatId(listUrl) : undefined);
  if (fromId) return buildCategoryListUrl(fromId);
  const url = (listUrl ?? '').trim();
  if (url) return url.startsWith('http') ? url : `https://${url}`;
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(name.trim())}`;
}
