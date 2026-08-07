#!/usr/bin/env node
/**
 * CLI 스모크 — 보드 API와 동일 로직을 쓰려면 서버가 떠 있어야 함.
 * 서버 없이 파일/파이썬만 빠르게 보려면: node scripts/smoke-projects.mjs --local
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localOnly = process.argv.includes('--local');
const base = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';

function ok(label, detail) {
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label, detail) {
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}
function warn(label, detail) {
  console.log(`  WARN  ${label}${detail ? ` — ${detail}` : ''}`);
}

function localSmoke() {
  let failed = 0;
  console.log('\n== P1 파일 ==');
  for (const f of [
    'components/CategoryExtractorApp.tsx',
    'lib/site-crawler/index.ts',
    'app/api/crawl/route.ts',
  ]) {
    existsSync(join(root, f)) ? ok(f) : (fail(f, 'missing'), failed++);
  }

  console.log('\n== P2 파일 ==');
  for (const f of [
    'components/ProductDataCollectApp.tsx',
    'lib/product-data-collect/runner.ts',
    'app/api/product-collect/run/route.ts',
  ]) {
    existsSync(join(root, f)) ? ok(f) : (fail(f, 'missing'), failed++);
  }

  console.log('\n== P3 파일/파이썬 ==');
  for (const f of [
    'python-collector/collect.py',
    'python-collector/run.bat',
    'python-collector/requirements.txt',
  ]) {
    existsSync(join(root, f)) ? ok(f) : (fail(f, 'missing'), failed++);
  }
  const py = spawnSync('python3', ['-c', 'import sys; print(sys.version.split()[0])'], {
    encoding: 'utf8',
  });
  if (py.status === 0) ok('python3', py.stdout.trim());
  else {
    fail('python3', 'not found');
    failed++;
  }

  console.log(failed ? `\nRESULT FAIL (${failed})` : '\nRESULT PASS');
  process.exit(failed ? 1 : 0);
}

async function apiSmoke() {
  console.log(`\n호출: POST ${base}/api/project-test { project: "all" }\n`);
  const res = await fetch(`${base}/api/project-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: 'all' }),
  });
  const data = await res.json();
  for (const r of data.results ?? []) {
    console.log(`== ${r.name} (${r.ok ? 'OK' : 'CHECK'}) ==`);
    for (const c of r.checks ?? []) {
      const fn = c.status === 'pass' ? ok : c.status === 'fail' ? fail : warn;
      fn(c.name, c.detail);
    }
    console.log('');
  }
  console.log(data.ok ? 'RESULT PASS' : 'RESULT FAIL/WARN');
  process.exit(data.ok ? 0 : 1);
}

if (localOnly) localSmoke();
else {
  apiSmoke().catch(err => {
    console.error('API 스모크 실패 — 서버가 켜져 있는지 확인하세요.');
    console.error('또는: npm run test:projects:local');
    console.error(err.message || err);
    process.exit(1);
  });
}
