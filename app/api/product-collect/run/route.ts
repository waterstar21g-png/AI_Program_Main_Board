import { NextRequest } from 'next/server';
import { runTmgCollectWorkflow } from '@/lib/product-data-collect/runner';
import type { TmgCollectRequest } from '@/lib/product-data-collect/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: TmgCollectRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, message: 'JSON 본문이 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
