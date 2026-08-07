/**
 * P2_Product_Capture_App — CLI (더망고 대량수집)
 *
 * Usage:
 *   npx tsx cli.ts 엑셀.xlsx
 *   npx tsx cli.ts 엑셀.xlsx 5
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { parseCategoryUrlExcel } from './lib/product-data-collect/excel-import';
import { runTmgCollectWorkflow } from './lib/product-data-collect/runner';

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const excelArg = process.argv[2];
  const saveCountArg = process.argv[3];

  console.log('========================================');
  console.log('  P2_Product_Capture_App');
  console.log('========================================');

  let excelPath = excelArg?.trim() || '';
  if (!excelPath) {
    excelPath = (await ask('Excel file path: ')).trim().replace(/^"|"$/g, '');
  }
  if (!excelPath || !fs.existsSync(excelPath)) {
    console.error(`[오류] 파일을 찾을 수 없습니다: ${excelPath || '(없음)'}`);
    process.exit(1);
  }

  const saveCount = Math.max(1, Number(saveCountArg) || 3);
  const abs = path.resolve(excelPath);
  console.log(`엑셀: ${abs}`);
  console.log(`저장수: ${saveCount}`);
  console.log('(Chrome/Edge CDP — 로그인 필요 시 브라우저에서 직접 로그인)');
  console.log('');

  const buf = fs.readFileSync(abs);
  const rows = parseCategoryUrlExcel(buf);
  console.log(`행 수: ${rows.length}`);

  const result = await runTmgCollectWorkflow(
    {
      siteName: '더망고',
      rows,
      saveCount,
      keepBrowserOpen: true,
      useExistingBrowser: true,
    },
    e => {
      const tip = e.rowIndex != null ? `#${e.rowIndex} ` : '';
      const msg = e.message ? ` — ${e.message}` : '';
      console.log(`[${e.at}] ${tip}${e.label}${msg}`);
    },
  );

  if (!result.ok) {
    console.error(`[오류] ${result.message ?? '실패'} (처리 ${result.processedCount}건)`);
    process.exit(1);
  }
  console.log(`완료: ${result.processedCount}건 처리`);
}

main().catch(err => {
  console.error('[오류]', err instanceof Error ? err.message : err);
  process.exit(1);
});
