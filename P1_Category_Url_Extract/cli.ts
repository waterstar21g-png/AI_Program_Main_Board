/**
 * P1_Category_Url_Extract — CLI
 *
 * 사용:
 *   npx tsx cli.ts
 *   npx tsx cli.ts --site-name ABC마트 --site-url https://abcmart.a-rt.com/ --tops MEN,WOMEN,KIDS
 *   npx tsx cli.ts --config config.json --out out.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as XLSX from 'xlsx';
import { crawlSite } from '@/lib/site-crawler';
import { hierarchyToSheetData } from '@/lib/excel-export';
import { sanitizeTopCategories } from '@/lib/top-category-filter';
import { MAX_TOP_CATEGORIES } from '@/lib/types';

const DEFAULTS = {
  siteName: 'ABC마트',
  siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
  topCategories: ['MEN', 'WOMEN', 'KIDS'],
};

type Args = {
  siteName?: string;
  siteUrl?: string;
  tops?: string[];
  out?: string;
  config?: string;
  help?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? '';
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--site-name') out.siteName = next();
    else if (a === '--site-url') out.siteUrl = next();
    else if (a === '--tops') {
      out.tops = next()
        .split(/[,|]/)
        .map(s => s.trim())
        .filter(Boolean);
    } else if (a === '--out' || a === '-o') out.out = next();
    else if (a === '--config' || a === '-c') out.config = next();
  }
  return out;
}

function printHelp() {
  console.log(`P1_Category_Url_Extract — 카테고리 URL 배치 추출

사용법:
  run.bat
  run.bat --site-name ABC마트 --site-url https://abcmart.a-rt.com/ --tops MEN,WOMEN,KIDS
  run.bat --config config.json --out result.xlsx

옵션:
  --site-name   사이트명
  --site-url    사이트 URL
  --tops        상위 카테고리 (쉼표 구분, 최대 ${MAX_TOP_CATEGORIES})
  --out, -o     출력 엑셀 경로
  --config, -c  JSON 설정 파일 { siteName, siteUrl, topCategories, out? }
  -h, --help    도움말
`);
}

async function promptMissing(args: Args): Promise<{
  siteName: string;
  siteUrl: string;
  topCategories: string[];
  outPath: string;
}> {
  let siteName = args.siteName?.trim() || '';
  let siteUrl = args.siteUrl?.trim() || '';
  let tops = args.tops ?? [];
  let outPath = args.out?.trim() || '';

  if (args.config) {
    const raw = fs.readFileSync(path.resolve(args.config), 'utf8');
    const cfg = JSON.parse(raw) as {
      siteName?: string;
      siteUrl?: string;
      topCategories?: string[];
      out?: string;
    };
    siteName ||= (cfg.siteName ?? '').trim();
    siteUrl ||= (cfg.siteUrl ?? '').trim();
    if (!tops.length && Array.isArray(cfg.topCategories)) tops = cfg.topCategories.map(String);
    outPath ||= (cfg.out ?? '').trim();
  }

  const needPrompt = !siteName || !siteUrl || !tops.length;
  if (needPrompt) {
    const rl = readline.createInterface({ input, output });
    console.log('인자/설정이 없으면 대화형으로 받습니다. (Enter = 기본값)\n');
    if (!siteName) {
      const v = (await rl.question(`사이트명 [${DEFAULTS.siteName}]: `)).trim();
      siteName = v || DEFAULTS.siteName;
    }
    if (!siteUrl) {
      const v = (await rl.question(`사이트 URL [${DEFAULTS.siteUrl}]: `)).trim();
      siteUrl = v || DEFAULTS.siteUrl;
    }
    if (!tops.length) {
      const v = (
        await rl.question(`상위 카테고리(쉼표) [${DEFAULTS.topCategories.join(',')}]: `)
      ).trim();
      tops = v
        ? v.split(/[,|]/).map(s => s.trim()).filter(Boolean)
        : [...DEFAULTS.topCategories];
    }
    if (!outPath) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const def = `${siteName || '사이트'}_카테고리URL_LIST_${stamp}.xlsx`.replace(
        /[\\/:*?"<>|]/g,
        '_',
      );
      const v = (await rl.question(`출력 파일 [${def}]: `)).trim();
      outPath = v || def;
    }
    rl.close();
  }

  if (!outPath) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safe = (siteName || '사이트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    outPath = `${safe}_카테고리URL_LIST_${stamp}.xlsx`;
  }

  return {
    siteName,
    siteUrl,
    topCategories: sanitizeTopCategories(tops, MAX_TOP_CATEGORIES),
    outPath: path.resolve(outPath),
  };
}

function writeExcel(outPath: string, data: string[][]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 56 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
  XLSX.writeFile(wb, outPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { siteName, siteUrl, topCategories, outPath } = await promptMissing(args);
  console.log(`\n수집 시작: ${siteName}`);
  console.log(`URL: ${siteUrl}`);
  console.log(`상위: ${topCategories.join(', ')}\n`);

  const result = await crawlSite({ siteName, siteUrl, topCategories });
  if (!result.ok) {
    console.error('[실패]', result.errors.join('\n') || '수집 실패');
    process.exitCode = 1;
    return;
  }

  for (const w of result.warnings) console.log('[경고]', w);

  const data = hierarchyToSheetData(result.rows);
  writeExcel(outPath, data);

  console.log(`완료: ${result.totalCategories}건`);
  console.log(`저장: ${outPath}`);
}

main().catch(e => {
  console.error('[오류]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
