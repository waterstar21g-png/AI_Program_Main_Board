import type { CategoryInput, ProductUrlRow } from '@/lib/types';
import { resolveCategoryUrl } from '@/lib/category-url';

interface NaverShopItem {
  title: string;
  link: string;
  lprice: string;
  mallName: string;
}

interface NaverShopResponse {
  total?: number;
  items?: NaverShopItem[];
  errorMessage?: string;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

function parsePrice(raw: string): number {
  return Number(String(raw).replace(/,/g, '')) || 0;
}

async function searchNaverShop(
  query: string,
  clientId: string,
  clientSecret: string,
  display: number,
): Promise<NaverShopItem[]> {
  const url = new URL('https://openapi.naver.com/v1/search/shop.json');
  url.searchParams.set('query', query);
  url.searchParams.set('display', String(Math.min(Math.max(display, 1), 100)));
  url.searchParams.set('sort', 'sim');

  const res = await fetch(url.toString(), {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`naver_api_${res.status}: ${err.slice(0, 120)}`);
  }

  const data = (await res.json()) as NaverShopResponse;
  if (data.errorMessage) throw new Error(data.errorMessage);
  return data.items ?? [];
}

/** 카테고리별 상품 URL 추출 (네이버 검색 API) */
export async function extractProductUrls(
  categories: CategoryInput[],
): Promise<{ rows: ProductUrlRow[]; errors: { category: string; message: string }[]; usedNaverApi: boolean }> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  const usedNaverApi = Boolean(clientId && clientSecret);

  const rows: ProductUrlRow[] = [];
  const errors: { category: string; message: string }[] = [];

  for (const cat of categories) {
    const name = cat.name.trim();
    if (!name) continue;

    const categoryUrl = resolveCategoryUrl(name, cat.catId, cat.listUrl);
    const count = Math.min(Math.max(cat.count || 20, 1), 100);

    if (!usedNaverApi) {
      rows.push({
        category: name,
        categoryUrl,
        rank: 1,
        title: '(API 키 없음 — 카테고리 대표 URL만)',
        productUrl: categoryUrl,
        price: 0,
        mallName: '-',
      });
      errors.push({
        category: name,
        message:
          'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정. 카테고리 대표 URL만 포함됩니다. .env.local에 키를 넣으면 상품 URL이 추출됩니다.',
      });
      continue;
    }

    try {
      const items = await searchNaverShop(name, clientId!, clientSecret!, count);
      if (!items.length) {
        rows.push({
          category: name,
          categoryUrl,
          rank: 0,
          title: '(검색 결과 없음)',
          productUrl: categoryUrl,
          price: 0,
          mallName: '-',
        });
        continue;
      }

      items.forEach((item, idx) => {
        rows.push({
          category: name,
          categoryUrl,
          rank: idx + 1,
          title: stripHtml(item.title),
          productUrl: item.link,
          price: parsePrice(item.lprice),
          mallName: (item.mallName || '').trim() || '네이버쇼핑',
        });
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'extract_failed';
      errors.push({ category: name, message });
      rows.push({
        category: name,
        categoryUrl,
        rank: 0,
        title: `(오류: ${message})`,
        productUrl: categoryUrl,
        price: 0,
        mallName: '-',
      });
    }
  }

  return { rows, errors, usedNaverApi };
}
