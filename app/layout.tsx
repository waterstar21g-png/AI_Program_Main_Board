import type { Metadata, Viewport } from 'next';
import { MobileEnv } from '@/components/MobileEnv';
import { APP_NAME } from '@/lib/app-name';
import './globals.css';

/**
 * next/font/google 사용 금지
 * Windows에서 Compiling / 중 Google Fonts 다운로드로 프로세스가 죽는 경우가 많음
 */

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: 'AI 프로그램 메인 보드 — 카테고리 URL 추출 · 상품 대량수집 · 파이썬 독립수집',
  applicationName: APP_NAME,
  keywords: ['카테고리URL추출', '상품데이터수집', '더망고'],
  authors: [{ name: '함께온라인' }],
  creator: '함께온라인',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f172a' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <MobileEnv>{children}</MobileEnv>
      </body>
    </html>
  );
}
