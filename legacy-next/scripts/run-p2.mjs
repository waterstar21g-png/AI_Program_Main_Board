#!/usr/bin/env node
/**
 * P2_Product_Capture_App — 독립 실행 명령 순서
 *
 *   npm run p2
 *   p2.bat
 *   node scripts/run-p2.mjs
 *
 * 명령 순서 (이 프로젝트만):
 *   1) 모듈·워크플로 점검
 *   2) 샘플 엑셀 파싱 실행
 *   3) 데이터 검증 — 라벨/URL 필드 분리
 *   (실제 더망고 수집은 보드 P2 화면에서 ①→②)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');

console.log(`
========================================
  P2_Product_Capture_App  (독립)
========================================
명령 순서:
  1) 모듈·워크플로 점검
  2) 샘플 엑셀 파싱 실행
  3) 데이터 검증 (라벨 / URL 필드)
  ※ 실제 더망고 수집: 보드 P2 → ①로그인→대량수집 → ②수집시작
`);

const args = ['scripts/verify-projects.mjs', 'p2'];
if (local) args.push('--local');
const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
