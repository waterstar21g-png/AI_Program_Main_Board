import { attachBrowser } from '@/lib/product-data-collect/browser-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await attachBrowser();
    return Response.json({
      ok: true,
      message:
        'Chromium에 연결되었습니다. (새 창·새 탭 없음) 직접 대량수집 메인을 연 뒤 ② 수집 시작을 누르세요.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chromium 연결 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
