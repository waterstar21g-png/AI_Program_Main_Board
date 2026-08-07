#!/usr/bin/env node
/**
 * P2_Product_Capture_App — CLI
 * 엑셀(카테고리 URL) → 더망고 대량수집
 */
import fs from 'fs';
import path from 'path';
import { parseCategoryUrlExcel } from './lib/product-data-collect/excel-import.js';
import { openBrowserToLoginUrl } from './lib/product-data-collect/browser-session.js';
import { runTmgCollectWorkflow } from './lib/product-data-collect/runner.js';
import { TMG_MAIN_URL } from './lib/product-data-collect/steps.js';
import type { WorkflowStepLog } from './lib/product-data-collect/types.js';

function parseArgs(argv: string[]) {
  let excel = '';
  let saveCount = 3;
  let startRow = 0;
  let openOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--open-only' || a === '--open') openOnly = true;
    else if ((a === '--save-count' || a === '-n') && argv[i + 1]) saveCount = Number(argv[++i]);
    else if (a === '--start-row' && argv[i + 1]) startRow = Number(argv[++i]);
    else if (a === '--help' || a === '-h') return { help: true, excel, saveCount, startRow, openOnly };
    else if (!a.startsWith('-') && !excel) excel = a;
  }
  return { help: false, excel, saveCount, startRow, openOnly };
}

function printHelp() {
  console.log(`
P2_Product_Capture_App — 더망고 상품 대량수집

사용법:
  run.bat 엑셀파일.xlsx
  run.bat --open-only          (브라우저만 열기 — 로그인 후 수집)
  run.bat 엑셀.xlsx --save-count 5

옵션:
  --open-only       브라우저를 열고 로그인 대기 (수집 안 함)
  --save-count, -n  검색결과 상위 저장 개수 (기본 3)
  --start-row       시작 행 인덱스 (0부터, 기본 0)
`);
}

function logStep(log: WorkflowStepLog) {
  const row = log.rowIndex != null ? ` [#${log.rowIndex}]` : '';
  const msg = log.message ? ` — ${log.message}` : '';
  console.log(`  ${log.label}${row}${msg}`);
}

async function main() {
  const { help, excel, saveCount, startRow, openOnly } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  if (openOnly) {
    console.log('[P2] 브라우저 열기 — 로그인 후 엑셀로 run.bat 실행하세요.');
    const page = await openBrowserToLoginUrl(TMG_MAIN_URL);
    const url = page.url();
    console.log(`[P2] 현재 URL: ${url}`);
    if (url.includes('admin_login')) {
      console.log('[P2] 로그인이 필요합니다. 브라우저에서 로그인한 뒤 run.bat로 수집을 시작하세요.');
    } else {
      console.log('[P2] 준비 완료. 엑셀 파일을 run.bat에 드래그하세요.');
    }
    return;
  }

  if (!excel) {
    console.error('[P2] 엑셀 파일 경로가 필요합니다.');
    printHelp();
    process.exit(1);
  }

  const resolved = path.resolve(excel);
  if (!fs.existsSync(resolved)) {
    console.error(`[P2] 파일 없음: ${resolved}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved).buffer;
  const rows = parseCategoryUrlExcel(buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  console.log(`[P2] ${rows.length}행 로드 — 저장수 ${saveCount}`);

  const result = await runTmgCollectWorkflow(
    {
      rows,
      saveCount,
      startRowIndex: startRow,
      keepBrowserOpen: true,
      useExistingBrowser: true,
    },
    logStep,
  );

  if (result.ok) {
    console.log(`[P2] 완료 — ${result.processedCount}행 처리`);
  } else {
    console.error(`[P2] 실패: ${result.message ?? '알 수 없는 오류'}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('[P2] 오류:', e instanceof Error ? e.message : e);
  process.exit(1);
});
