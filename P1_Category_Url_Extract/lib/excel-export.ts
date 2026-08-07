import * as XLSX from 'xlsx';
import type { HierarchyRow } from './types';

/** Category_Item_Url_List / 상품데이터수집 공통 엑셀 헤더 (순서 고정) */
export const CATEGORY_EXCEL_HEADERS = [
  '상위 카테고리명',
  '중위 카테고리명',
  '하위 카테고리명',
  '최종 카테고리명',
  '상위 최종 카테고리명',
  '최종 카테고리 URL주소',
] as const;

export const EXCEL_COL_TOP_FINAL_LABEL = '상위 최종 카테고리명' as const;
export const EXCEL_COL_FINAL_URL = '최종 카테고리 URL주소' as const;

const HEADERS = CATEGORY_EXCEL_HEADERS;

export function hierarchyToSheetData(rows: HierarchyRow[]): string[][] {
  const data: string[][] = [HEADERS.slice()];
  for (const r of rows) {
    data.push([r.top, r.mid, r.low, r.final, r.topFinalLabel, r.finalCategoryUrl]);
  }
  return data;
}

export function downloadHierarchyExcel(rows: HierarchyRow[], siteName: string): void {
  const safeName = (siteName || '사이트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${safeName}_카테고리URL_LIST_${stamp}.xlsx`;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(hierarchyToSheetData(rows));
  ws['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 56 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
  XLSX.writeFile(wb, filename);
}

export function buildHierarchyExcelBuffer(rows: HierarchyRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(hierarchyToSheetData(rows));
  XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
