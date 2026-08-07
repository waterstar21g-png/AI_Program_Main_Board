import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/app-name';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'AI_Program_Main_Board_New — 카테고리 URL 추출 · 파이썬 독립 수집기',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'ko',
    dir: 'ltr',
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
