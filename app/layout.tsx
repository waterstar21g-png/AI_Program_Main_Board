import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '카테고리별 상품목록 URL LIST 추출',
    template: '%s · URL LIST',
  },
  description: '카테고리별 대표 URL·상품 URL을 추출하여 엑셀 파일로 저장합니다.',
  applicationName: '카테고리별_상품목록_URL_LIST추출',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
