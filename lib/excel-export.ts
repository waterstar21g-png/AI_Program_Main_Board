import * as XLSX from 'xlsx';
import type { ProductUrlRow } from '@/lib/types';

const HEADERS = ['카테고리', '카테고리대표URL', '순번', '상품명', '상품URL', '가격', '쇼핑몰'] as const;

export function rowsToSheetData(rows: ProductUrlRow[]): string[][] {
  const data: string[][] = [HEADERS.slice()];
  for (const r of rows) {
    data.push([
      r.category,
      r.categoryUrl,
      String(r.rank),
      r.title,
      r.productUrl,
      r.price > 0 ? String(r.price) : '',
      r.mallName,
    ]);
  }
  return data;
}

/** 브라우저에서 엑셀 파일 다운로드 */
export function downloadExcel(rows: ProductUrlRow[], filename = '카테고리별_상품URL_LIST.xlsx'): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rowsToSheetData(rows));
  ws['!cols'] = [{ wch: 16 }, { wch: 52 }, { wch: 6 }, { wch: 40 }, { wch: 52 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'URL_LIST');
  XLSX.writeFile(wb, filename);
}

/** 서버 응답용 Buffer */
export function buildExcelBuffer(rows: ProductUrlRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rowsToSheetData(rows));
  XLSX.utils.book_append_sheet(wb, ws, 'URL_LIST');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
