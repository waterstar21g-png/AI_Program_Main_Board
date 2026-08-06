import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** dev / production 캐시 분리 */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: __dirname,
  /** playwright만 서버 외부화 (xlsx는 transpile 충돌 나므로 넣지 않음) */
  serverExternalPackages: ['playwright', 'playwright-core'],
};

export default nextConfig;
