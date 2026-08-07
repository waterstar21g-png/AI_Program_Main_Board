#!/usr/bin/env node
/**
 * P3_Python_Item_Collector — 독립 실행 명령 순서
 *
 *   npm run p3
 *   p3.bat
 *   node scripts/run-p3.mjs
 *
 * 명령 순서 (이 프로젝트만):
 *   1) 파일·Python 환경 점검
 *   2) collect.py 구문 검사
 *   3) 데이터 검증 — 샘플 엑셀 openpyxl 읽기
 *   (실제 더망고 수집은 python-collector/run.bat 에 엑셀 드래그)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');

console.log(`
========================================
  P3_Python_Item_Collector  (독립)
========================================
명령 순서:
  1) 파일·Python 환경 점검
  2) collect.py 구문 검사
  3) 데이터 검증 (샘플 엑셀 읽기)
  ※ 실제 더망고 수집: python-collector\\run.bat 에 엑셀 드래그
`);

const args = ['scripts/verify-projects.mjs', 'p3'];
if (local) args.push('--local');
const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
