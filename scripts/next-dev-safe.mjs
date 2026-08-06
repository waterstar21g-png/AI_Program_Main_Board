/**
 * dev 시작 — 포트 정리 후 next dev (webpack)
 * Next 15.5+ 는 turbopack이 기본일 수 있어 --webpack 을 명시한다.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killPort, prepareNextRun, projectRoot } from './clean-next.mjs';

const port = Number(process.env.PORT) || 3000;
const fresh = process.argv.includes('--fresh') || process.env.DEV_FRESH === '1';
const useTurbo = process.env.TURBO === '1' || process.argv.includes('--turbo');

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

  // Next 15.5+: turbopack default → --webpack 으로 강제
  const args = ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'];
  if (useTurbo) {
    args.splice(2, 0, '--turbo');
  } else {
    args.splice(2, 0, '--webpack');
  }

  console.log(`[dev-safe] npx ${args.join(' ')}`);

  const child = spawn('npx', args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      TURBOPACK: useTurbo ? '1' : '0',
    },
  });

  child.on('exit', (code, signal) => {
    // --webpack 미지원(구버전 next)이면 turbo 없이 재시도
    if (!useTurbo && code && code !== 0) {
      console.log('[dev-safe] --webpack failed, retry plain next dev...');
      const fallback = spawn(
        'npx',
        ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'],
        {
          cwd: projectRoot,
          stdio: 'inherit',
          shell: true,
          env: { ...process.env, FORCE_COLOR: '1', TURBOPACK: '0' },
        },
      );
      fallback.on('exit', (c, s) => {
        if (s) process.kill(process.pid, s);
        process.exit(c ?? 0);
      });
      process.on('SIGINT', () => fallback.kill('SIGINT'));
      process.on('SIGTERM', () => fallback.kill('SIGTERM'));
      return;
    }
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
