/**
 * dev 시작 — 포트 정리 후 next dev (기본: 캐시 유지, --fresh 시 .next-dev 삭제)
 */
import { spawn } from 'node:child_process';
import { killPort, prepareNextRun, projectRoot } from './clean-next.mjs';

const port = Number(process.env.PORT) || 3000;
const fresh = process.argv.includes('--fresh');

async function main() {
  if (fresh) {
    console.log('[dev-safe] fresh start — port + .next-dev cleanup...');
    await prepareNextRun({ killDevPort: true, port, mode: 'dev', cleanCache: true });
  } else {
    console.log('[dev-safe] starting dev (port cleanup only, cache kept)...');
    killPort(port);
    if (process.platform === 'win32') {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  const child = spawn('npx', ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
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
