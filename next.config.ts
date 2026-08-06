import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** dev(build)와 production build 캐시 분리 — 청크 충돌 방지 */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  /** Windows Turbopack 경로 이탈 방지 */
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['playwright', 'playwright-core', 'xlsx'],
  experimental: {
    optimizePackageImports: ['xlsx'],
  },
};

export default nextConfig;
