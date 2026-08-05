import { openTmgBrowserPage } from '@/lib/product-data-collect/browser-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await openTmgBrowserPage();
    return Response.json({
      ok: true,
      message: 'Chromium이 열렸습니다. (직접) 상품데이터 대량수집 메인으로 이동한 뒤 ② 수집 시작을 누르세요.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chromium 열기 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
