/**
 * Windows-safe Next.js dev starter.
 * NEVER enables Turbopack. Uses local next binary + webpack only.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killPort, prepareNextRun, projectRoot } from './clean-next.mjs';

const port = Number(process.env.PORT) || 3000;
const fresh = process.argv.includes('--fresh') || process.env.DEV_FRESH === '1';

function removeStrayAppRoutes() {
  for (const name of ['elastic-beanstalk', 'elastic_beanstalk', 'aws-deploy']) {
    const dir = path.join(projectRoot, 'app', name);
    if (fs.existsSync(dir)) {
      console.log(`[dev-safe] remove stray route: app/${name}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

function nextBinPath() {
  const bin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!fs.existsSync(bin)) {
    throw new Error('node_modules/next missing — run npm install');
  }
  return bin;
}

function nextVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'node_modules', 'next', 'package.json'), 'utf8'),
    );
    return pkg.version || '?';
  } catch {
    return '?';
  }
}

async function main() {
  removeStrayAppRoutes();

  // Always clean cache when DEV_FRESH or --fresh (run.ps1 sets DEV_FRESH=1)
  if (fresh) {
    console.log('[dev-safe] fresh — kill port + delete .next-dev');
    await prepareNextRun({ killDevPort: true, port, mode: 'dev', cleanCache: true });
  } else {
    console.log('[dev-safe] kill port only, keep cache');
    killPort(port);
    if (process.platform === 'win32') await new Promise(r => setTimeout(r, 800));
  }

  const bin = nextBinPath();
  const ver = nextVersion();
  const args = [bin, 'dev', '-p', String(port), '-H', '0.0.0.0'];

  // Strip any turbo-related env that could force Turbopack
  const env = { ...process.env, FORCE_COLOR: '1' };
  for (const k of ['TURBO', 'TURBOPACK', 'IS_TURBOPACK_TEST', 'NEXT_TURBOPACK', 'DEV_FRESH']) {
    delete env[k];
  }

  console.log(`[dev-safe] Next.js ${ver} — WEBPACK only (Turbopack OFF)`);
  console.log(`[dev-safe] ${process.execPath} ${args.join(' ')}`);

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env,
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
