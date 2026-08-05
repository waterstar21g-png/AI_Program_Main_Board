import { openBrowserToLoginUrl } from '@/lib/product-data-collect/browser-session';
import { TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await openBrowserToLoginUrl(TMG_LOGIN_URL);
    return Response.json({
      ok: true,
      message: `로그인 URL로 Chromium을 열었습니다.\n${TMG_LOGIN_URL}\n로그인 후 대량수집 메인으로 이동 → ② 수집 시작`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chromium 열기 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
