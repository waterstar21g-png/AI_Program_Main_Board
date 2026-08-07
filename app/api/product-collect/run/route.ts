import { NextRequest } from 'next/server';
import type { TmgCollectRequest } from '@/lib/product-data-collect/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (process.env.VERCEL) {
    return new Response(
      JSON.stringify({
        type: 'done',
        ok: false,
        message:
          '상품데이터수집(브라우저)은 로컬 PC에서만 실행됩니다.\nPC에서 .\\run.ps1 실행 후 사용하세요.',
        logs: [],
        processedCount: 0,
      }) + '\n',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      },
    );
  }

  let body: TmgCollectRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, message: 'JSON 본문이 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { runTmgCollectWorkflow } = await import('@/lib/product-data-collect/runner');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        const result = await runTmgCollectWorkflow(body, log => {
          send({ type: 'log', log });
        });
        send({ type: 'done', ...result });
      } catch (e) {
        const message = e instanceof Error ? e.message : '실행 실패';
        send({ type: 'done', ok: false, message, logs: [], processedCount: 0 });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
