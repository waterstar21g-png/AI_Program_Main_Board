import { TMG_MAIN_URL } from '@/lib/product-data-collect/steps';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  // Vercel(서버리스)에서는 브라우저 자동화 불가 — 로컬 PC 전용
  if (process.env.VERCEL) {
    return Response.json(
      {
        ok: false,
        message:
          '상품데이터수집(브라우저)은 로컬 PC에서만 실행됩니다.\n' +
          'PC에서 .\\run.ps1 실행 후 사용하세요.\n' +
          `보드 UI: https://ai-program-main-board.vercel.app`,
      },
      { status: 400 },
    );
  }

  try {
    const { openBrowserToLoginUrl } = await import('@/lib/product-data-collect/browser-session');
    const page = await openBrowserToLoginUrl(TMG_MAIN_URL);
    const url = page.url();
    const onBulk = url.includes('getGoodsNew.php');
    const onLogin = url.includes('admin_login');
    return Response.json({
      ok: true,
      message: onBulk
        ? '메인화면 → 대량수집 화면까지 자동 진입 완료. ② 수집 시작을 누르세요.'
        : onLogin
          ? '로그인이 필요합니다. 브라우저에서 직접 로그인해 주세요.'
          : `브라우저 열림. 현재: ${url.split('?')[0]}`,
      url,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '브라우저 열기 실패';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
