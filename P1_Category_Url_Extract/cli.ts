/**
 * P1_Category_Url_Extract — CLI
 *
 * Usage:
 *   npx tsx cli.ts
 *   npx tsx cli.ts --site "ABC마트" --url "https://abcmart.a-rt.com/" --tops MEN,WOMEN,KIDS
 *   npx tsx cli.ts --out ./out.xlsx
 */
import fs from 'fs';
import path from 'path';
import { crawlSite } from './lib/site-crawler/index';
import { buildHierarchyExcelBuffer } from './lib/excel-export';

const DEFAULTS = {
  siteName: 'ABC마트',
  siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
  topCategories: ['MEN', 'WOMEN', 'KIDS'],
};

function parseArgs(argv: string[]) {
  const out = {
    siteName: DEFAULTS.siteName,
    siteUrl: DEFAULTS.siteUrl,
    topCategories: [...DEFAULTS.topCategories],
    outPath: '' as string,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v) throw new Error(`옵션 ${a} 뒤에 값이 필요합니다`);
      return v;
    };
    if (a === '--site' || a === '-n') out.siteName = next();
    else if (a === '--url' || a === '-u') out.siteUrl = next();
    else if (a === '--tops' || a === '-t') {
      out.topCategories = next()
        .split(/[,|]/)
        .map(s => s.trim())
        .filter(Boolean);
    } else if (a === '--out' || a === '-o') out.outPath = next();
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (!a.startsWith('-') && !out.outPath) {
      out.outPath = a;
    } else {
      throw new Error(`알 수 없는 인자: ${a}`);
    }
  }
  return out;
}

function printHelp() {
  console.log(`P1_Category_Url_Extract

Usage:
  run.bat
  run.bat --tops MEN,WOMEN
  run.bat --site ABC마트 --url https://abcmart.a-rt.com/ --tops MEN,WOMEN,KIDS --out result.xlsx

Options:
  --site, -n   사이트 이름 (기본: ABC마트)
  --url,  -u   사이트 URL
  --tops, -t   상위 카테고리 콤마 구분 (기본: MEN,WOMEN,KIDS)
  --out,  -o   저장 엑셀 경로 (생략 시 현재 폴더에 자동 생성)
`);
}

function defaultOutName(siteName: string): string {
  const safe = (siteName || '사이트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${safe}_카테고리URL_LIST_${stamp}.xlsx`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('========================================');
  console.log('  P1_Category_Url_Extract');
  console.log('========================================');
  console.log(`사이트: ${args.siteName}`);
  console.log(`URL:    ${args.siteUrl}`);
  console.log(`상위:   ${args.topCategories.join(', ')}`);
  console.log('');

  const result = await crawlSite({
    siteName: args.siteName,
    siteUrl: args.siteUrl,
    topCategories: args.topCategories,
  });

  for (const w of result.warnings) console.log(`[경고] ${w}`);
  if (!result.ok) {
    for (const e of result.errors) console.error(`[오류] ${e}`);
    process.exit(1);
  }

  const outPath = path.resolve(args.outPath || defaultOutName(result.siteName));
  fs.writeFileSync(outPath, buildHierarchyExcelBuffer(result.rows));
  console.log(`완료: ${result.totalCategories}건 → ${outPath}`);
}

main().catch(err => {
  console.error('[오류]', err instanceof Error ? err.message : err);
  process.exit(1);
});
