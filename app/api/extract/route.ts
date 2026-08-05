import { NextRequest, NextResponse } from 'next/server';
import { extractProductUrls } from '@/lib/naver-extract';
import type { CategoryInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

function normalizeCategories(raw: unknown): CategoryInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const o = item as Partial<CategoryInput>;
      return {
        id: String(o.id ?? `cat-${idx}`),
        name: String(o.name ?? '').trim(),
        catId: o.catId ? String(o.catId).trim() : undefined,
        listUrl: o.listUrl ? String(o.listUrl).trim() : undefined,
        count: Number(o.count) || 20,
      };
    })
    .filter(c => c.name);
}

export async function POST(req: NextRequest) {
  let body: { categories?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }

  const categories = normalizeCategories(body.categories);
  if (!categories.length) {
    return NextResponse.json({ ok: false, message: '카테고리를 1개 이상 입력하세요.' }, { status: 400 });
  }

  const result = await extractProductUrls(categories);
  return NextResponse.json({ ok: true, ...result });
}
