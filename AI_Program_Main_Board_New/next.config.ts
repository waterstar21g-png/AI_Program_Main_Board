import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['xlsx'],
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
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
