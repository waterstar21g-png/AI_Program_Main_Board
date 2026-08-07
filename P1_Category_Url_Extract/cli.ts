#!/usr/bin/env node
/**
 * P1_Category_Url_Extract — CLI
 * 사이트 URL + 상위 카테고리 → 카테고리 URL 엑셀
 */
import fs from 'fs';
import path from 'path';
import { crawlSite } from './lib/site-crawler/index.js';
import { downloadHierarchyExcel } from './lib/excel-export.js';

const DEFAULT_SITE = 'ABC마트';
const DEFAULT_URL = 'https://abcmart.a-rt.com/?track=W0009';
const DEFAULT_TOPS = 'MEN,WOMEN,KIDS,BRAND';

function parseArgs(argv: string[]) {
  let siteName = DEFAULT_SITE;
  let siteUrl = DEFAULT_URL;
  let tops = DEFAULT_TOPS;
  let out = '';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--site-name' && argv[i + 1]) siteName = argv[++i];
    else if (a === '--site-url' && argv[i + 1]) siteUrl = argv[++i];
    else if ((a === '--tops' || a === '--top-categories') && argv[i + 1]) tops = argv[++i];
    else if ((a === '--out' || a === '-o') && argv[i + 1]) out = argv[++i];
    else if (a === '--help' || a === '-h') return { help: true, siteName, siteUrl, tops, out };
  }
  return { help: false, siteName, siteUrl, tops, out };
}

function printHelp() {
  console.log(`
P1_Category_Url_Extract — 카테고리 URL 엑셀 추출

사용법:
  run.bat
  run.bat --site-url "https://abcmart.a-rt.com/" --tops MEN,WOMEN,KIDS

옵션:
  --site-name   사이트 이름 (기본: ${DEFAULT_SITE})
  --site-url    사이트 URL (기본: ABC마트)
  --tops        상위 카테고리, 쉼표 구분 (기본: ${DEFAULT_TOPS})
  --out, -o     출력 xlsx 경로 (미지정 시 자동 파일명)
`);
}

async function main() {
  const { help, siteName, siteUrl, tops, out } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const topCategories = tops.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  console.log(`[P1] 수집 시작: ${siteName}`);
  console.log(`     URL: ${siteUrl}`);
  console.log(`     상위: ${topCategories.join(', ')}`);

  const result = await crawlSite({ siteName, siteUrl, topCategories });

  if (!result.ok) {
    console.error('[P1] 실패:', result.errors.join('; '));
    process.exit(1);
  }

  for (const w of result.warnings) console.warn('[P1] 경고:', w);
  console.log(`[P1] ${result.totalCategories}건 추출 완료`);

  if (out) {
    const { buildHierarchyExcelBuffer } = await import('./lib/excel-export.js');
    const buf = buildHierarchyExcelBuffer(result.rows);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, buf);
    console.log(`[P1] 저장: ${path.resolve(out)}`);
  } else {
    downloadHierarchyExcel(result.rows, siteName);
    console.log('[P1] 현재 폴더에 엑셀 저장됨');
  }
}

main().catch(e => {
  console.error('[P1] 오류:', e instanceof Error ? e.message : e);
  process.exit(1);
});
