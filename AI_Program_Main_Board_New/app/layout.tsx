import type { Metadata, Viewport } from 'next';
import { MobileEnv } from '@/components/MobileEnv';
import { APP_NAME } from '@/lib/app-name';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: 'AI_Program_Main_Board_New — 카테고리 URL 추출 · 파이썬 독립 수집기',
  applicationName: APP_NAME,
  keywords: ['카테고리URL추출', '파이썬수집', '더망고'],
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
