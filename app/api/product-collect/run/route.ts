import { NextRequest, NextResponse } from 'next/server';
import { runTmgCollectWorkflow } from '@/lib/product-data-collect/runner';
import type { TmgCollectRequest } from '@/lib/product-data-collect/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: TmgCollectRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }

  try {
    const result = await runTmgCollectWorkflow(body);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : '실행 실패';
    return NextResponse.json({ ok: false, message, logs: [], processedCount: 0 }, { status: 500 });
  }
}
