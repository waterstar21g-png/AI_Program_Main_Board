import { NextRequest, NextResponse } from 'next/server';
import { buildExcelBuffer } from '@/lib/excel-export';
import type { ProductUrlRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { rows?: ProductUrlRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }

  const rows = body.rows ?? [];
  if (!rows.length) {
    return NextResponse.json({ ok: false, message: '추출된 데이터가 없습니다.' }, { status: 400 });
  }

  const buffer = buildExcelBuffer(rows);
  const filename = encodeURIComponent('카테고리별_상품URL_LIST.xlsx');

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
