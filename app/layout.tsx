import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { MobileEnv } from '@/components/MobileEnv';
import './globals.css';

const noto = Noto_Sans_KR({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Nutri-Farmer Front Program Board',
    template: '%s · Nutri-Farmer',
  },
  description: 'Nutri-Farmer 단위 프로그램 실행 보드 — 카테고리 URL 추출, 상품캡처·가격조회 등',
  applicationName: 'Nutri-Farmer Front',
  keywords: ['상품캡처', '가격조회', '아이템스카우트', '네이버쇼핑', '쿠팡'],
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
    title: '상품캡처',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

/** 모바일 브라우저·PWA 전용 뷰포트 (노치·홈 인디케이터 대응) */
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
    <html lang="ko" className={noto.variable}>
      <body>
        <MobileEnv>{children}</MobileEnv>
      </body>
    </html>
  );
}
