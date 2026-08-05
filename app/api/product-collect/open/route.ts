import { openBrowserToMainUrl } from '@/lib/product-data-collect/browser-session';
import { TMG_BULK_URL } from '@/lib/product-data-collect/steps';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await openBrowserToMainUrl(TMG_BULK_URL);
    return Response.json({
      ok: true,
      message: `메인 URL로 Chromium을 열었습니다.\n${TMG_BULK_URL}\n로그인 후 ② 수집 시작을 누르세요.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chromium 열기 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
