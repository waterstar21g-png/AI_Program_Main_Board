import { NextRequest, NextResponse } from 'next/server';
import { crawlSite } from '@/lib/site-crawler';
import { MAX_TOP_CATEGORIES } from '@/lib/types';
import { sanitizeTopCategories } from '@/lib/top-category-filter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: {
    siteName?: string;
    siteUrl?: string;
    topCategories?: unknown;
    fetchProducts?: boolean;
    productLimit?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }

  const siteName = (body.siteName ?? '').trim();
  const siteUrl = (body.siteUrl ?? '').trim();
  const rawTops = Array.isArray(body.topCategories)
    ? body.topCategories.map(v => String(v))
    : [];
  const topCategories = sanitizeTopCategories(rawTops, MAX_TOP_CATEGORIES);

  if (!siteName) {
    return NextResponse.json({ ok: false, message: '사이트명을 입력하세요.' }, { status: 400 });
  }
  if (!siteUrl) {
    return NextResponse.json({ ok: false, message: '사이트 URL을 입력하세요.' }, { status: 400 });
  }
  if (!topCategories.length) {
    return NextResponse.json(
      { ok: false, message: '상위 카테고리를 1개 이상 입력하세요. (최대 15개)' },
      { status: 400 },
    );
  }

  const result = await crawlSite({
    siteName,
    siteUrl,
    topCategories,
    fetchProducts: body.fetchProducts !== false,
    productLimit: Number(body.productLimit) || 0,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.errors[0] ?? '수집 실패', ...result, ok: false },
      { status: 502 },
    );
  }

  return NextResponse.json({ ...result, ok: true });
}
