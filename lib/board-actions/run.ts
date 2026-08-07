import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runProjectSmoke, type SmokeRunResult } from '@/lib/project-smoke/run';

export type BoardAction =
  | 'verify-p1'
  | 'verify-p2'
  | 'verify-p3'
  | 'verify-all'
  | 'sync'
  | 'clean';

export type BoardActionResult = {
  ok: boolean;
  action: BoardAction;
  at: string;
  logs: string[];
  smoke?: SmokeRunResult;
};

const REPO = 'waterstar21g-png/AI_Program_Main_Board';
const REF = 'main';

/** PowerShell run.ps1 -Sync 에 해당하는 핵심 파일 */
const SYNC_FILES = [
  'lib/app-version.ts',
  'lib/programs/registry.tsx',
  'lib/project-smoke/run.ts',
  'lib/board-actions/run.ts',
  'components/ProgramBoardApp.tsx',
  'components/BoardCommandPanel.tsx',
  'components/ProductDataCollectApp.tsx',
  'next.config.ts',
  'tsconfig.json',
  'scripts/windows-speed-fix.ps1',
  'scripts/next-dev-safe.mjs',
  'components/PythonItemCollectorApp.tsx',
  'components/CategoryExtractorApp.tsx',
  'app/globals.css',
  'app/api/project-test/route.ts',
  'app/api/board-actions/route.ts',
  'scripts/verify-projects.mjs',
  'scripts/run-p1.mjs',
  'scripts/run-p2.mjs',
  'scripts/run-p3.mjs',
  'scripts/COMMANDS.txt',
  'scripts/smoke-projects.mjs',
  'scripts/clean-next.mjs',
  'scripts/next-dev-safe.mjs',
  'package.json',
  'run.ps1',
  'run.bat',
  'verify.ps1',
  'verify.bat',
  'p1.bat',
  'p2.bat',
  'p3.bat',
];

function localOnlyGuard(): string | null {
  if (process.env.VERCEL) {
    return '동기화·캐시정리는 로컬 PC에서만 가능합니다. (Vercel 불가)';
  }
  return null;
}

async function downloadFile(rel: string, logs: string[]): Promise<boolean> {
  const urls = [
    `https://raw.githubusercontent.com/${REPO}/${REF}/${rel}`,
    `https://cdn.jsdelivr.net/gh/${REPO}@${REF}/${rel}`,
  ];
  const dest = join(process.cwd(), rel);
  mkdirSync(dirname(dest), { recursive: true });

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AI_Program_Main_Board-board-actions', 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5) continue;
      const head = buf.subarray(0, 40).toString('utf8');
      if (/^\s*\{\s*"message"/.test(head)) continue;
      writeFileSync(dest, buf);
      logs.push(`OK ${rel}`);
      return true;
    } catch {
      /* try next */
    }
  }
  logs.push(`FAIL ${rel}`);
  return false;
}

async function actionSync(logs: string[]): Promise<boolean> {
  logs.push(`[SYNC] GitHub ${REPO}@${REF}`);
  let failed = 0;
  for (const f of SYNC_FILES) {
    const ok = await downloadFile(f, logs);
    if (!ok) failed += 1;
  }
  logs.push(failed ? `[SYNC] 실패 ${failed}개` : '[SYNC] 완료');
  return failed === 0;
}

function actionClean(logs: string[]): boolean {
  logs.push('[CLEAN] node scripts/clean-next.mjs --all');
  const script = join(process.cwd(), 'scripts', 'clean-next.mjs');
  if (!existsSync(script)) {
    logs.push('FAIL scripts/clean-next.mjs 없음');
    return false;
  }
  const r = spawnSync(process.execPath, [script, '--all'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60000,
  });
  if (r.stdout) logs.push(...r.stdout.trim().split('\n').filter(Boolean));
  if (r.stderr) logs.push(...r.stderr.trim().split('\n').filter(Boolean));
  if (r.error) {
    logs.push(`FAIL ${r.error.message}`);
    return false;
  }
  logs.push(r.status === 0 ? '[CLEAN] 완료' : `[CLEAN] exit ${r.status}`);
  return r.status === 0;
}

export async function runBoardAction(action: BoardAction): Promise<BoardActionResult> {
  const at = new Date().toISOString();
  const logs: string[] = [];

  if (action === 'sync' || action === 'clean') {
    const blocked = localOnlyGuard();
    if (blocked) {
      return { ok: false, action, at, logs: [blocked] };
    }
  }

  if (action === 'sync') {
    const ok = await actionSync(logs);
    return { ok, action, at, logs };
  }

  if (action === 'clean') {
    const ok = actionClean(logs);
    return { ok, action, at, logs };
  }

  const map = {
    'verify-p1': 'p1',
    'verify-p2': 'p2',
    'verify-p3': 'p3',
    'verify-all': 'all',
  } as const;

  const target = map[action];
  if (target === 'all') {
    logs.push('[VERIFY] P1·P2·P3 각각 독립 실행 후 결과만 모음 (연쇄 아님)');
  } else {
    logs.push(`[VERIFY] ${target.toUpperCase()} 독립 실행 — 해당 프로젝트 명령 순서만`);
  }
  const smoke = await runProjectSmoke(target);
  for (const r of smoke.results) {
    logs.push(`— ${r.name}: ${r.ok ? 'OK' : 'FAIL'}`);
    for (const c of r.checks) {
      logs.push(`  ${c.status.toUpperCase()} ${c.name} — ${c.detail}`);
    }
  }
  logs.push(smoke.ok ? '[VERIFY] PASS' : '[VERIFY] FAIL/CHECK');
  return { ok: smoke.ok, action, at, logs, smoke };
}

export const BOARD_ACTIONS: BoardAction[] = [
  'verify-p1',
  'verify-p2',
  'verify-p3',
  'verify-all',
  'sync',
  'clean',
];
