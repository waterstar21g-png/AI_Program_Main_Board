import { openTmgBrowserPage } from '@/lib/product-data-collect/browser-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await openTmgBrowserPage();
    return Response.json({
      ok: true,
      message: 'Chromium이 열렸습니다. 로그인 후 대량수집 화면으로 이동하세요.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chromium 열기 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
