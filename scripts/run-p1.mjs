#!/usr/bin/env node
/**
 * P1_Category_Url_Extract — 독립 실행 명령 순서
 *
 *   npm run p1
 *   p1.bat
 *   node scripts/run-p1.mjs
 *
 * 명령 순서 (이 프로젝트만):
 *   1) 수집 실행  — ABC마트 상위 카테고리 crawl
 *   2) 데이터 검증 — URL(http) · 상위최종라벨 전수 확인
 *   3) 결과 요약
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');

console.log(`
========================================
  P1_Category_Url_Extract  (독립)
========================================
명령 순서:
  1) 수집 실행
  2) 데이터 검증 (URL / 상위최종라벨)
  3) 결과 요약
`);

const args = ['scripts/verify-projects.mjs', 'p1'];
if (local) args.push('--local');
const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
