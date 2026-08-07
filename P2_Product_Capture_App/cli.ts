#!/usr/bin/env node
/**
 * P2_Product_Capture_App — CLI (더망고 대량수집)
 *
 * Usage:
 *   tsx cli.ts excel.xlsx
 *   tsx cli.ts excel.xlsx 5
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { parseCategoryUrlExcel } from './lib/excel-import.ts';
import { runTmgCollectWorkflow } from './lib/runner.ts';

function ask(rl: readline.Interface, q: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(q, ans => resolve((ans || '').trim()));
  });
}

async function resolveExcelPath(arg?: string): Promise<string> {
  if (arg && fs.existsSync(arg)) return path.resolve(arg);
  if (arg) {
    console.error(`[ERROR] File not found: ${arg}`);
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('엑셀 파일을 이 창으로 드래그하거나 경로를 입력하세요.');
  const p = await ask(rl, 'Excel file path: ');
  rl.close();
  if (!p || !fs.existsSync(p)) {
    console.error(`[ERROR] File not found: ${p}`);
    process.exit(1);
  }
  return path.resolve(p);
}

async function main() {
  console.log('========================================');
  console.log('  P2_Product_Capture_App (Node)');
  console.log('========================================');

  const excelPath = await resolveExcelPath(process.argv[2]);
  const saveCount = Number(process.argv[3] || 3) || 3;

  const buf = fs.readFileSync(excelPath);
  const rows = parseCategoryUrlExcel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log(`엑셀: ${excelPath}`);
  console.log(`행 수: ${rows.length}, 저장수: ${saveCount}`);
  console.log('(Chrome/Edge CDP — 로컬 PC 전용)\n');

  const result = await runTmgCollectWorkflow(
    { rows, saveCount, useExistingBrowser: true, keepBrowserOpen: true },
    log => {
      const idx = log.rowIndex != null ? `#${log.rowIndex} ` : '';
      const msg = log.message ? ` — ${log.message}` : '';
      console.log(`[${log.step}] ${idx}${log.label}${msg}`);
    },
  );

  if (!result.ok) {
    console.error('\n[실패]', result.message || '수집 실패');
    console.error(`처리됨: ${result.processedCount}행`);
    process.exit(1);
  }

  console.log(`\n완료: ${result.processedCount}행 처리`);
}

main().catch(e => {
  console.error('[오류]', e instanceof Error ? e.message : e);
  process.exit(1);
});
