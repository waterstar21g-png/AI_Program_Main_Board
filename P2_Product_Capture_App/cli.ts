#!/usr/bin/env node
/**
 * P2_Product_Capture_App CLI — 더망고 URL 엑셀 대량수집 (Playwright)
 *
 * 사용:
 *   npx tsx cli.ts 엑셀파일.xlsx
 *   npx tsx cli.ts 엑셀파일.xlsx 5
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { parseCategoryUrlExcel } from './src/excel-import.js';
import { runTmgCollectWorkflow } from './src/runner.js';

async function askExcelPath(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise(resolve => {
      rl.question('Excel file path: ', ans => resolve(String(ans ?? '').trim()));
    });
  } finally {
    rl.close();
  }
}

async function main() {
  let excel = process.argv[2] ?? '';
  const saveCount = Number(process.argv[3] ?? 3) || 3;

  if (!excel) {
    console.log('P2_Product_Capture_App — 더망고 대량수집');
    console.log('Drag Excel onto run.bat, or type the path.\n');
    excel = await askExcelPath();
  }

  if (!excel || !fs.existsSync(excel)) {
    console.error('[ERROR] File not found:', excel || '(empty)');
    process.exit(1);
  }

  const abs = path.resolve(excel);
  console.log(`[1/2] reading excel: ${abs}`);
  const buf = fs.readFileSync(abs);
  const rows = parseCategoryUrlExcel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log(`  rows=${rows.length}, saveCount=${saveCount}`);

  console.log('[2/2] starting collection (Chrome/Edge CDP)…');
  const result = await runTmgCollectWorkflow(
    {
      siteName: '더망고',
      rows,
      saveCount,
      headless: false,
      keepBrowserOpen: true,
      useExistingBrowser: true,
    },
    log => {
      const row = log.rowIndex != null ? `#${log.rowIndex} ` : '';
      const msg = log.message ? ` — ${log.message}` : '';
      console.log(`  [${log.step}] ${row}${log.label}${msg}`);
    },
  );

  if (!result.ok) {
    console.error('[ERROR]', result.message ?? '수집 실패');
    process.exit(1);
  }
  console.log(`done. processed=${result.processedCount}`);
}

main().catch(e => {
  console.error('[ERROR]', e instanceof Error ? e.message : e);
  process.exit(1);
});
