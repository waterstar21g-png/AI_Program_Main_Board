#!/usr/bin/env node
/**
 * P1 → P2 → P3 실행·검증 순서 명령
 *
 *   npm run verify:p1
 *   npm run verify:p2
 *   npm run verify:p3
 *   npm run verify:all
 *   node scripts/verify-projects.mjs all
 *
 * 서버(http://127.0.0.1:3000)가 떠 있으면 보드 API와 동일 로직을 호출합니다.
 * 서버가 없으면 --local 로 파일/환경만 점검합니다.
 */
const base = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';
const arg = (process.argv[2] || 'all').toLowerCase();
const localOnly = process.argv.includes('--local');

const map = {
  p1: 'verify-p1',
  p2: 'verify-p2',
  p3: 'verify-p3',
  all: 'verify-all',
  'verify-p1': 'verify-p1',
  'verify-p2': 'verify-p2',
  'verify-p3': 'verify-p3',
  'verify-all': 'verify-all',
};

const action = map[arg] || 'verify-all';

async function viaApi() {
  console.log(`\n[VERIFY] POST ${base}/api/board-actions { action: "${action}" }\n`);
  const res = await fetch(`${base}/api/board-actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const data = await res.json();
  for (const line of data.logs || []) console.log(line);
  if (data.smoke?.results) {
    for (const r of data.smoke.results) {
      console.log(`\n== ${r.name} (${r.ok ? 'OK' : 'CHECK'}) ==`);
      for (const c of r.checks || []) {
        console.log(`  ${c.status.toUpperCase()}  ${c.name} — ${c.detail}`);
      }
    }
  }
  console.log(data.ok ? '\nRESULT PASS' : '\nRESULT FAIL/CHECK');
  process.exit(data.ok ? 0 : 1);
}

async function main() {
  if (localOnly) {
    const { spawnSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const r = spawnSync(process.execPath, ['scripts/smoke-projects.mjs', '--local'], {
      stdio: 'inherit',
      cwd: root,
    });
    process.exit(r.status ?? 1);
  }
  try {
    await viaApi();
  } catch (e) {
    console.error('API 호출 실패 — 보드 서버가 켜져 있는지 확인하세요.');
    console.error('  .\\run.bat  또는  npm run dev');
    console.error('또는: npm run verify:all -- --local  (파일 점검만)');
    console.error(e.message || e);
    process.exit(1);
  }
}

main();
