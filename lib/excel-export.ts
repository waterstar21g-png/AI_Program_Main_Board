import * as XLSX from 'xlsx';
import type { HierarchyRow } from '@/lib/types';

const HEADERS = [
  '상위 카테고리명',
  '중위 카테고리명',
  '하위 카테고리명',
  '최종 카테고리명',
  '최종 카테고리의 대표상품 URL주소',
] as const;

export function hierarchyToSheetData(rows: HierarchyRow[]): string[][] {
  const data: string[][] = [HEADERS.slice()];
  for (const r of rows) {
    data.push([r.top, r.mid, r.low, r.final, r.productUrl]);
  }
  return data;
}

export function downloadHierarchyExcel(rows: HierarchyRow[], siteName: string): void {
  const safeName = (siteName || '사이트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${safeName}_카테고리URL_LIST_${stamp}.xlsx`;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(hierarchyToSheetData(rows));
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
  XLSX.writeFile(wb, filename);
}

export function buildHierarchyExcelBuffer(rows: HierarchyRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(hierarchyToSheetData(rows));
  XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
