/**
 * P2_Product_Capture_App — CLI
 *
 * 사용:
 *   npx tsx cli.ts 엑셀파일.xlsx
 *   npx tsx cli.ts 엑셀파일.xlsx 5
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseCategoryUrlExcel } from '@/lib/product-data-collect/excel-import';
import { runTmgCollectWorkflow } from '@/lib/product-data-collect/runner';

function printHelp() {
  console.log(`P2_Product_Capture_App — 더망고 상품 대량수집 (Playwright CDP)

사용법:
  run.bat 엑셀파일.xlsx
  run.bat 엑셀파일.xlsx 5

인자:
  1) 엑셀 경로 (P1 출력 양식: 상위 최종 카테고리명 + 최종 카테고리 URL주소)
  2) 저장수 (선택, 기본 3)

브라우저:
  PC에 설치된 Chrome/Edge에 CDP(9222)로 연결합니다.
  Playwright 전용 Chromium을 따로 받지 않습니다.
`);
}

async function resolveExcelPath(arg?: string): Promise<string> {
  if (arg?.trim()) {
    const p = path.resolve(arg.trim());
    if (!fs.existsSync(p)) throw new Error(`파일을 찾을 수 없습니다: ${p}`);
    return p;
  }
  const rl = readline.createInterface({ input, output });
  console.log('엑셀 파일을 run.bat에 드래그하거나, 경로를 입력하세요.\n');
  const v = (await rl.question('Excel file path: ')).trim().replace(/^"|"$/g, '');
  rl.close();
  if (!v) throw new Error('엑셀 경로가 필요합니다.');
  const p = path.resolve(v);
  if (!fs.existsSync(p)) throw new Error(`파일을 찾을 수 없습니다: ${p}`);
  return p;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return;
  }

  const excelPath = await resolveExcelPath(argv[0]);
  const saveCount = Math.max(1, Number(argv[1] ?? 3) || 3);

  console.log(`엑셀: ${excelPath}`);
  console.log(`저장수: ${saveCount}\n`);

  const buf = fs.readFileSync(excelPath);
  const rows = parseCategoryUrlExcel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log(`행 ${rows.length}건 로드\n`);

  const result = await runTmgCollectWorkflow(
    { rows, saveCount, keepBrowserOpen: true, useExistingBrowser: true },
    log => {
      const row = log.rowIndex != null ? `#${log.rowIndex} ` : '';
      const msg = log.message ? ` — ${log.message}` : '';
      console.log(`[${log.step}] ${row}${log.label}${msg}`);
    },
  );

  if (!result.ok) {
    console.error(`\n[실패] ${result.message ?? '수집 실패'} (처리 ${result.processedCount}건)`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n완료: ${result.processedCount}건 처리`);
}

main().catch(e => {
  console.error('[오류]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
