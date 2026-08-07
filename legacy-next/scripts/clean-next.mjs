/**
 * Next.js 캐시·3000 포트 정리
 * — dev: .next-dev / build: .next 분리 (next.config.ts distDir)
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, '..');
const DEV_DIR = path.join(projectRoot, '.next-dev');
const BUILD_DIR = path.join(projectRoot, '.next');
const DEFAULT_PORT = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function killPort(port = DEFAULT_PORT) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (!/LISTENING/i.test(line)) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`[clean] stopped PID ${pid} (port ${port})`);
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* nothing listening */
    }
    return;
  }

  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore', shell: true });
  } catch {
    /* nothing listening */
  }
}

async function removeDir(dir, label) {
  if (!existsSync(dir)) return false;

  const rmOpts = { recursive: true, force: true, maxRetries: 8, retryDelay: 400 };

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(dir, rmOpts);
      if (!existsSync(dir)) {
        console.log(`[clean] removed ${label}`);
        return true;
      }
    } catch {
      /* retry */
    }
    await sleep(350);
  }

  if (process.platform === 'win32') {
    try {
      execSync(`cmd /c rmdir /s /q "${dir}"`, { stdio: 'ignore' });
      if (!existsSync(dir)) {
        console.log(`[clean] removed ${label} (rmdir)`);
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  console.warn(`[clean] skip ${label} — folder locked; dev continues with existing cache`);
  return false;
}

/** @param {'dev'|'build'|'all'} mode */
export async function cleanNextCache(mode = 'dev') {
  let n = 0;
  if (mode === 'dev' || mode === 'all') {
    n += (await removeDir(DEV_DIR, '.next-dev (dev cache)')) ? 1 : 0;
    n += (await removeDir(BUILD_DIR, 'legacy .next')) ? 1 : 0;
  }
  if (mode === 'build' || mode === 'all') {
    n += (await removeDir(BUILD_DIR, '.next (build cache)')) ? 1 : 0;
  }
  return n > 0;
}

export async function prepareNextRun({
  killDevPort = true,
  port = DEFAULT_PORT,
  mode = 'dev',
  cleanCache = true,
} = {}) {
  if (killDevPort) {
    killPort(port);
    if (process.platform === 'win32') await sleep(1200);
  }
  if (cleanCache) await cleanNextCache(mode);
}

const isMain = process.argv[1]?.endsWith('clean-next.mjs');
if (isMain) {
  const mode = process.argv.includes('--build') ? 'build' : process.argv.includes('--all') ? 'all' : 'dev';
  await prepareNextRun({
    killDevPort: process.argv.includes('--kill-port'),
    mode,
    cleanCache: true,
  });
}
