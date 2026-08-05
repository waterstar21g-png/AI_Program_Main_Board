import { openBrowserToLoginUrl } from '@/lib/product-data-collect/browser-session';
import { TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  try {
    const page = await openBrowserToLoginUrl(TMG_LOGIN_URL);
    const url = page.url();
    const onBulk = url.includes('getGoodsNew.php');
    return Response.json({
      ok: true,
      message: onBulk
        ? '로그인 → 대량수집 화면까지 자동 진입 완료. ② 수집 시작을 누르세요.'
        : `브라우저 열림. 현재: ${url.split('?')[0]}`,
      url,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chromium 열기 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
