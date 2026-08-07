import { NextRequest, NextResponse } from 'next/server';
import { defaultBrowseRoots, searchExcelFiles } from '@/lib/p3-excel-library';

export const dynamic = 'force-dynamic';

/** GET ?dir=&q= — 로컬 폴더에서 .xlsx 검색 (P1 출력 찾기) */
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get('dir') ?? '';
  const q = req.nextUrl.searchParams.get('q') ?? '';

  if (!dir.trim()) {
    return NextResponse.json({
      ok: true,
      roots: defaultBrowseRoots(),
      files: [],
      message: '폴더를 지정한 뒤 검색하세요.',
    });
  }

  const result = searchExcelFiles(dir, { query: q || undefined });
  return NextResponse.json({
    ...result,
    roots: defaultBrowseRoots(),
  });
}
