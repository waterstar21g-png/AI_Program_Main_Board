import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/app-name';

/** 모바일 홈 화면 추가(PWA) — Android Chrome · iOS Safari */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'AI_Program_Main_Board — P1_Category_Url_Extract / P2_Product_Capture_App / P3_Python_Item_Collector',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f1f5f9',
    theme_color: '#0f172a',
    lang: 'ko',
    dir: 'ltr',
    categories: ['shopping', 'utilities'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
