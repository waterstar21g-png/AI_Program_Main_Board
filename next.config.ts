import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** dev(build)와 production build 캐시 분리 — 청크 충돌 방지 */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['playwright', 'playwright-core', 'xlsx'],
  /** 불필요 패키지 클라이언트 번들 제외 유도 */
  experimental: {
    optimizePackageImports: ['xlsx'],
  },
};

export default nextConfig;
