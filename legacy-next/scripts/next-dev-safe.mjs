/**
 * dev 시작 — 기본 Turbopack (빠름).
 * Windows에서 turbo가 깨지면: set NEXT_USE_WEBPACK=1
 * 캐시 초기화: npm run dev:fresh
 */
import { spawn } from 'node:child_process';
import { killPort, prepareNextRun, projectRoot } from './clean-next.mjs';

const port = Number(process.env.PORT) || 3000;
const fresh = process.argv.includes('--fresh');
const useWebpack =
  process.env.NEXT_USE_WEBPACK === '1' ||
  process.argv.includes('--webpack');

async function main() {
  if (fresh) {
    console.log('[dev-safe] fresh — port + .next-dev 삭제...');
    await prepareNextRun({ killDevPort: true, port, mode: 'dev', cleanCache: true });
  } else {
    console.log('[dev-safe] port cleanup only (캐시 유지)...');
    killPort(port);
    if (process.platform === 'win32') {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const args = ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'];
  if (!useWebpack) {
    args.push('--turbo');
    console.log('[dev-safe] Turbopack ON (느리면 NEXT_USE_WEBPACK=1)');
  } else {
    console.log('[dev-safe] webpack mode (NEXT_USE_WEBPACK=1)');
  }

  const child = spawn('npx', args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      NEXT_TELEMETRY_DISABLED: '1',
      // Windows Defender / OneDrive 환경에서 파일 감시 부담 완화 힌트
      WATCHPACK_POLLING: process.env.WATCHPACK_POLLING || '',
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

main().catch(err => {
  console.error('[dev-safe] failed:', err);
  process.exit(1);
});
