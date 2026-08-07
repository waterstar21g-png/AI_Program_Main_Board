#!/usr/bin/env node
/**
 * P1_Category_Url_Extract CLI
 *
 * 사용:
 *   node cli.mjs
 *   node cli.mjs --site "ABC마트" --url "https://abcmart.a-rt.com/" --tops MEN,WOMEN,KIDS
 *   node cli.mjs --config config.json
 *
 * config.json 예:
 *   { "siteName": "ABC마트", "siteUrl": "https://abcmart.a-rt.com/", "topCategories": ["MEN","WOMEN","KIDS"] }
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import * as XLSX from 'xlsx';
import { crawlSite, hierarchyToSheetData } from './crawl.mjs';

const DEFAULTS = {
  siteName: 'ABC마트',
  siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
  topCategories: ['MEN', 'WOMEN', 'KIDS'],
};

function parseArgs(argv) {
  const out = { siteName: '', siteUrl: '', tops: '', config: '', out: '', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--site') out.siteName = argv[++i] ?? '';
    else if (a === '--url') out.siteUrl = argv[++i] ?? '';
    else if (a === '--tops') out.tops = argv[++i] ?? '';
    else if (a === '--config') out.config = argv[++i] ?? '';
    else if (a === '--out') out.out = argv[++i] ?? '';
  }
  return out;
}

function ask(rl, q, fallback = '') {
  const hint = fallback ? ` [${fallback}]` : '';
  return new Promise(resolve => {
    rl.question(`${q}${hint}: `, ans => {
      const v = String(ans ?? '').trim();
      resolve(v || fallback);
    });
  });
}

async function promptInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('P1_Category_Url_Extract — 카테고리 URL 엑셀 추출');
    console.log('(Enter = 기본값)\n');
    const siteName = await ask(rl, '사이트명', DEFAULTS.siteName);
    const siteUrl = await ask(rl, '사이트 URL', DEFAULTS.siteUrl);
    const topsRaw = await ask(rl, '상위 카테고리(쉼표 구분)', DEFAULTS.topCategories.join(','));
    return {
      siteName,
      siteUrl,
      topCategories: topsRaw.split(/[,|/]/).map(s => s.trim()).filter(Boolean),
    };
  } finally {
    rl.close();
  }
}

function loadConfig(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const j = JSON.parse(raw);
  return {
    siteName: String(j.siteName ?? '').trim(),
    siteUrl: String(j.siteUrl ?? '').trim(),
    topCategories: Array.isArray(j.topCategories)
      ? j.topCategories.map(v => String(v))
      : String(j.tops ?? '')
          .split(/[,|/]/)
          .map(s => s.trim())
          .filter(Boolean),
  };
}

function writeExcel(rows, siteName, outPath) {
  const safeName = (siteName || '사이트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = outPath || path.join(process.cwd(), `${safeName}_카테고리URL_LIST_${stamp}.xlsx`);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(hierarchyToSheetData(rows));
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
  XLSX.writeFile(wb, filename);
  return filename;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node cli.mjs
  node cli.mjs --site "ABC마트" --url "https://abcmart.a-rt.com/" --tops MEN,WOMEN,KIDS
  node cli.mjs --config config.json [--out out.xlsx]`);
    process.exit(0);
  }

  let req;
  if (args.config) {
    req = loadConfig(args.config);
  } else if (args.siteName || args.siteUrl || args.tops) {
    req = {
      siteName: args.siteName || DEFAULTS.siteName,
      siteUrl: args.siteUrl || DEFAULTS.siteUrl,
      topCategories: (args.tops || DEFAULTS.topCategories.join(','))
        .split(/[,|/]/)
        .map(s => s.trim())
        .filter(Boolean),
    };
  } else {
    req = await promptInteractive();
  }

  console.log('\n[1/2] 수집 중…');
  console.log(`  site=${req.siteName}`);
  console.log(`  url=${req.siteUrl}`);
  console.log(`  tops=${req.topCategories.join(', ')}`);

  const result = await crawlSite(req);
  if (!result.ok) {
    console.error('[ERROR]', result.errors[0] ?? '수집 실패');
    process.exit(1);
  }

  for (const w of result.warnings) console.log('[WARN]', w);
  console.log(`[2/2] ${result.totalCategories}건 추출 → 엑셀 저장`);
  const file = writeExcel(result.rows, result.siteName, args.out || '');
  console.log('저장됨:', file);
}

main().catch(e => {
  console.error('[ERROR]', e instanceof Error ? e.message : e);
  process.exit(1);
});
