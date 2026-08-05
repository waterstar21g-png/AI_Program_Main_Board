import { APP_VERSION } from '@/lib/app-version';

/** 화면 하단 고정 — 버전 확인용 */
export function VersionBanner() {
  return (
    <div className="version-banner" role="status" aria-live="polite">
      ▶ 현재 프로그램 버전: <strong>{APP_VERSION}</strong>
    </div>
  );
}
