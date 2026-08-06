import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** dev(build)와 production build 캐시 분리 — 청크 충돌 방지 */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: __dirname,
  /** playwright만 서버 외부화 — xlsx는 optimize/transpile과 충돌하므로 제외 */
  serverExternalPackages: ['playwright', 'playwright-core'],
};

export default nextConfig;
