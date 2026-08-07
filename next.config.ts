import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** dev와 production 캐시 분리 */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: __dirname,
  /** Playwright/xlsx 는 서버에서만 — 번들 추적 부담 감소 */
  serverExternalPackages: ['playwright', 'playwright-core', 'xlsx'],
  /** 사용하지 않는 무거운 경로를 번들러가 덜 보게 */
  experimental: {
    optimizePackageImports: ['cheerio'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/python-collector/**',
          '**/docs/**',
          '**/.next/**',
          '**/.next-dev/**',
          '**/scripts/probe-*/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
