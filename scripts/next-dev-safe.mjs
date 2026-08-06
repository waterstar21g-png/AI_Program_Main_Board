/**
 * dev 시작 — 포트 정리 후 next dev
 * Windows에서 --turbo(Turbopack)는
 *   TurbopackInternalError: Failed to write page endpoint ...
 * 로 자주 죽으므로 기본은 webpack dev 서버 사용.
 * TURBO=1 이면 turbopack 사용.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killPort, prepareNextRun, projectRoot } from './clean-next.mjs';

const port = Number(process.env.PORT) || 3000;
const fresh = process.argv.includes('--fresh') || process.env.DEV_FRESH === '1';
const useTurbo = process.env.TURBO === '1' || process.argv.includes('--turbo');

/** 로컬에 잘못 생긴 잔여 라우트 제거 (Turbopack이 이걸 컴파일하다 터짐) */
function removeStrayAppRoutes() {
  const stray = ['elastic-beanstalk', 'elastic_beanstalk', 'aws-deploy'];
  for (const name of stray) {
    const dir = path.join(projectRoot, 'app', name);
    if (fs.existsSync(dir)) {
      console.log(`[dev-safe] remove stray route: app/${name}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

async function main() {
  removeStrayAppRoutes();

  if (fresh) {
    console.log('[dev-safe] fresh start — port + .next-dev cleanup...');
    await prepareNextRun({ killDevPort: true, port, mode: 'dev', cleanCache: true });
  } else {
    console.log('[dev-safe] starting (port cleanup only, cache kept)...');
    killPort(port);
    if (process.platform === 'win32') {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  const args = ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'];
  if (useTurbo) args.splice(2, 0, '--turbo');

  console.log(`[dev-safe] next dev${useTurbo ? ' --turbo' : ' (webpack)'} ...`);

  const child = spawn('npx', args, {
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
