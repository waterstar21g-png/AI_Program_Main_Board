import * as XLSX from 'xlsx';
import type { TmgCollectRow } from '@/lib/product-data-collect/types';

/** 스크린샷·내보내기 양식과 동일한 헤더만 사용 */
export const EXCEL_LABEL_HEADER = '상위 최종 카테고리명';
export const EXCEL_URL_HEADER = '최종 카테고리 URL주소';

function normalizeHeader(s: unknown): string {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .toLowerCase();
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** 시트에서 셀 값 — 하이퍼링크면 Target(실제 URL) 우선 */
function readCell(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return '';

  const target = cell.l?.Target ? String(cell.l.Target).trim() : '';
  if (target) {
    // 엑셀 내부 링크(#...)가 아니면 Target 사용
    if (/^https?:\/\//i.test(target)) return target;
    if (target.startsWith('mailto:')) return target;
  }

  if (cell.w != null && String(cell.w).trim()) return String(cell.w).trim();
  if (cell.v != null && cell.v !== '') return String(cell.v).trim();
  return '';
}

function pickSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const prefer = wb.SheetNames.find(n => /카테고리/.test(n)) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[prefer];
  if (!sheet) throw new Error('엑셀 시트를 읽을 수 없습니다.');
  return sheet;
}

function findHeaderRow(sheet: XLSX.WorkSheet): {
  headerRow: number;
  labelCol: number;
  urlCol: number;
  headers: string[];
} {
  const ref = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  if (!ref) throw new Error('엑셀 범위가 비어 있습니다.');

  const maxScan = Math.min(ref.e.r, 15);
  const labelKey = normalizeHeader(EXCEL_LABEL_HEADER);
  const urlKey = normalizeHeader(EXCEL_URL_HEADER);

  for (let r = ref.s.r; r <= maxScan; r++) {
    const headers: string[] = [];
    let labelCol = -1;
    let urlCol = -1;

    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const raw = readCell(sheet, r, c);
      headers[c] = raw;
      const key = normalizeHeader(raw);
      if (!key) continue;

      // 정확히 「상위 최종 카테고리명」만 (「상위 카테고리명」과 구분)
      if (key === labelKey) labelCol = c;

      // 정확히 「최종 카테고리 URL주소」만 (「최종 카테고리명」과 구분)
      if (key === urlKey) urlCol = c;
    }

    // 주소 헤더 변형: URL/url 포함 + 최종 + 카테고리 + (주소|url)
    if (urlCol < 0) {
      for (let c = ref.s.c; c <= ref.e.c; c++) {
        const key = normalizeHeader(headers[c]);
        if (!key) continue;
        if (key.includes('최종') && key.includes('카테고리') && (key.includes('url') || key.includes('주소'))) {
          // 「최종 카테고리명」만 있는 열 제외
          if (key === normalizeHeader('최종 카테고리명')) continue;
          urlCol = c;
          break;
        }
      }
    }

    if (labelCol >= 0 && urlCol >= 0) {
      return { headerRow: r, labelCol, urlCol, headers };
    }
  }

  throw new Error(
    `엑셀에 "${EXCEL_LABEL_HEADER}" / "${EXCEL_URL_HEADER}" 열이 없습니다.\n` +
      'Category_Item_Url_List에서 저장한 양식을 그대로 업로드하세요.',
  );
}

/** Category_Item_Url_List 엑셀 → 수집 행 목록 */
export function parseCategoryUrlExcel(buffer: ArrayBuffer): TmgCollectRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellHTML: false });
  const sheet = pickSheet(wb);
  const { headerRow, labelCol, urlCol } = findHeaderRow(sheet);

  const ref = XLSX.utils.decode_range(sheet['!ref']!);
  const out: TmgCollectRow[] = [];

  for (let r = headerRow + 1; r <= ref.e.r; r++) {
    let finalCategoryUrl = readCell(sheet, r, urlCol);
    let topFinalLabel = readCell(sheet, r, labelCol);

    // 하이퍼링크 Target이 상대경로면 스킴만 보정
    if (finalCategoryUrl && !isHttpUrl(finalCategoryUrl) && /^\/\//.test(finalCategoryUrl)) {
      finalCategoryUrl = `https:${finalCategoryUrl}`;
    }

    // URL 열에 표시문구만 있고 링크도 없으면 — 같은 행에서 http 셀을 찾지 않음(엉뚱한 열 금지)
    if (!finalCategoryUrl) continue;

    // URL이 http가 아니면 이 행은 스킵(카테고리명 등이 URL칸에 들어간 경우)
    if (!isHttpUrl(finalCategoryUrl)) {
      continue;
    }

    // 라벨 칸에 URL이 들어간 경우 — URL 열 값을 라벨로 쓰지 않음
    if (isHttpUrl(topFinalLabel)) {
      topFinalLabel = '';
    }

    out.push({
      rowIndex: r + 1, // 엑셀 행 번호(1-based)
      finalCategoryUrl,
      topFinalLabel,
    });
  }

  if (!out.length) {
    throw new Error(
      `"${EXCEL_URL_HEADER}" 열에서 http(s) URL을 찾지 못했습니다.\n` +
        '엑셀 URL 칸이 하이퍼링크/텍스트인지 확인하세요.',
    );
  }

  return out;
}
