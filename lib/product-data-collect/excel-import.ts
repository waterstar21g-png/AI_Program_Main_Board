import * as XLSX from 'xlsx';
import type { TmgCollectRow } from '@/lib/product-data-collect/types';

const URL_HEADERS = ['최종 카테고리 URL주소', '최종 카테고리 URL', 'finalCategoryUrl'];
const LABEL_HEADERS = ['상위 최종 카테고리명', '상위 최종', 'topFinalLabel'];

function findCol(headers: string[], candidates: string[]): number {
  const norm = (s: string) => s.replace(/\s/g, '').toLowerCase();
  const h = headers.map(norm);
  for (const c of candidates) {
    const i = h.indexOf(norm(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** Category_Item_Url_List 엑셀 → 수집 행 목록 */
export function parseCategoryUrlExcel(buffer: ArrayBuffer): TmgCollectRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][];

  if (!rows.length) return [];

  const headers = rows[0].map(c => String(c).trim());
  const urlCol = findCol(headers, URL_HEADERS);
  const labelCol = findCol(headers, LABEL_HEADERS);

  if (urlCol < 0) {
    throw new Error('엑셀에 "최종 카테고리 URL주소" 열이 없습니다.');
  }
  if (labelCol < 0) {
    throw new Error('엑셀에 "상위 최종 카테고리명" 열이 없습니다.');
  }

  const out: TmgCollectRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    const finalCategoryUrl = String(line[urlCol] ?? '').trim();
    const topFinalLabel = String(line[labelCol] ?? '').trim();
    if (!finalCategoryUrl) continue;
    out.push({ rowIndex: i, finalCategoryUrl, topFinalLabel });
  }
  return out;
}
