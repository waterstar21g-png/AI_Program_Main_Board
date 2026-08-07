#!/usr/bin/env node
/**
 * P1_Category_Url_Extract — CLI
 *
 * Usage:
 *   node cli.mjs
 *   node cli.mjs --site "ABC마트" --url "https://abcmart.a-rt.com/?track=W0009" --tops MEN,WOMEN,KIDS
 *   node cli.mjs --config config.json
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import * as XLSX from 'xlsx';
import { crawlSite } from './lib/crawl.mjs';

const DEFAULTS = {
  siteName: 'ABC마트',
  siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
  topCategories: ['MEN', 'WOMEN', 'KIDS'],
};

const HEADERS = [
  '상위 카테고리명',
  '중위 카테고리명',
  '하위 카테고리명',
  '최종 카테고리명',
  '상위 최종 카테고리명',
  '최종 카테고리 URL주소',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--site' || a === '-s') out.siteName = argv[++i];
    else if (a === '--url' || a === '-u') out.siteUrl = argv[++i];
    else if (a === '--tops' || a === '-t') out.tops = argv[++i];
    else if (a === '--config' || a === '-c') out.config = argv[++i];
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function ask(rl, q, def) {
  const hint = def ? ` [${def}]` : '';
  return new Promise(resolve => {
    rl.question(`${q}${hint}: `, ans => {
      const v = (ans || '').trim();
      resolve(v || def || '');
    });
  });
}

async function promptInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('=== P1_Category_Url_Extract ===');
  console.log('Enter 만 누르면 기본값(ABC마트) 사용\n');
  const siteName = await ask(rl, '사이트명', DEFAULTS.siteName);
  const siteUrl = await ask(rl, '사이트 URL', DEFAULTS.siteUrl);
  const topsRaw = await ask(rl, '상위 카테고리(쉼표구분)', DEFAULTS.topCategories.join(','));
  rl.close();
  return {
    siteName,
    siteUrl,
    topCategories: topsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean),
  };
}

function writeExcel(rows, siteName, outPath) {
  const data = [HEADERS.slice()];
  for (const r of rows) {
    data.push([r.top, r.mid, r.low, r.final, r.topFinalLabel, r.finalCategoryUrl]);
  }
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

  const safeName = (siteName || '사이트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = outPath || path.join(process.cwd(), `${safeName}_카테고리URL_LIST_${stamp}.xlsx`);
  XLSX.writeFile(wb, filename);
  return filename;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`P1_Category_Url_Extract

Usage:
  run.bat
  node cli.mjs --site "ABC마트" --url "https://abcmart.a-rt.com/?track=W0009" --tops MEN,WOMEN,KIDS
  node cli.mjs --config config.json --out result.xlsx
`);
    process.exit(0);
  }

  let req;
  if (args.config) {
    const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8'));
    req = {
      siteName: cfg.siteName || DEFAULTS.siteName,
      siteUrl: cfg.siteUrl || DEFAULTS.siteUrl,
      topCategories: cfg.topCategories || DEFAULTS.topCategories,
    };
  } else if (args.siteName || args.siteUrl || args.tops) {
    req = {
      siteName: args.siteName || DEFAULTS.siteName,
      siteUrl: args.siteUrl || DEFAULTS.siteUrl,
      topCategories: (args.tops || DEFAULTS.topCategories.join(','))
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean),
    };
  } else {
    req = await promptInteractive();
  }

  console.log(`\n수집 중… ${req.siteName} / ${req.siteUrl}`);
  console.log(`상위 카테고리: ${req.topCategories.join(', ')}`);

  const result = await crawlSite(req);
  if (!result.ok) {
    console.error('\n[실패]', result.errors[0] || '수집 실패');
    process.exit(1);
  }

  for (const w of result.warnings) console.log('[경고]', w);
  const file = writeExcel(result.rows, result.siteName, args.out);
  console.log(`\n완료: ${result.totalCategories}건`);
  console.log(`엑셀 저장: ${file}`);
}

main().catch(e => {
  console.error('[오류]', e instanceof Error ? e.message : e);
  process.exit(1);
});
