import * as XLSX from 'xlsx';
import {
  CATEGORY_EXCEL_HEADERS,
  EXCEL_COL_FINAL_URL,
  EXCEL_COL_TOP_FINAL_LABEL,
} from './excel-headers.js';
import type { TmgCollectRow } from './types.js';

export const EXCEL_LABEL_HEADER = EXCEL_COL_TOP_FINAL_LABEL;
export const EXCEL_URL_HEADER = EXCEL_COL_FINAL_URL;

function normHeader(s: unknown): string {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .toLowerCase();
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function cleanUrl(s: string): string {
  return s
    .trim()
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

/** 헤더 셀 — 표시값(v)만. 하이퍼링크 Target 사용 금지 */
function headerText(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  return String(cell.v ?? '').trim();
}

/**
 * 「상위 최종 카테고리명」셀
 * - 텍스트(v)만 사용
 * - URL/하이퍼링크 Target 절대 사용 안 함
 */
function readLabelValue(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  const v = String(cell.v ?? '').trim();
  if (v && !isHttpUrl(v)) return v;
  const w = String(cell.w ?? '').trim();
  if (w && !isHttpUrl(w)) return w;
  return '';
}

/**
 * 「최종 카테고리 URL주소」셀
 * - http(s) 인 후보 중 가장 긴 값 선택 (v / w / 하이퍼링크 Target)
 */
function readUrlValue(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';

  const candidates = [cell.v, cell.w, cell.l?.Target]
    .map(x => cleanUrl(String(x ?? '')))
    .filter(Boolean)
    .map(s => (s.startsWith('//') ? `https:${s}` : s));

  const httpOnes = candidates.filter(isHttpUrl);
  if (httpOnes.length) {
    httpOnes.sort((a, b) => b.length - a.length);
    return httpOnes[0]!;
  }
  return '';
}

function pickSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const name =
    wb.SheetNames.find(n => n === '카테고리표') ??
    wb.SheetNames.find(n => /카테고리/.test(n)) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[name!];
  if (!sheet) throw new Error('엑셀 시트를 읽을 수 없습니다.');
  return sheet;
}

function findExactColumns(sheet: XLSX.WorkSheet): {
  headerRow: number;
  labelCol: number;
  urlCol: number;
} {
  const ref = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  if (!ref) throw new Error('엑셀 범위가 비어 있습니다.');

  const labelKey = normHeader(EXCEL_COL_TOP_FINAL_LABEL);
  const urlKey = normHeader(EXCEL_COL_FINAL_URL);
  const maxScan = Math.min(ref.e.r, 20);

  for (let r = ref.s.r; r <= maxScan; r++) {
    let labelCol = -1;
    let urlCol = -1;
    const keys: string[] = [];

    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const key = normHeader(headerText(sheet, r, c));
      keys[c] = key;
      if (key === labelKey) labelCol = c;
      if (key === urlKey) urlCol = c;
    }

    // 표준 6열 양식(Category_Item_Url_List)이면 열 위치로 확정
    if (labelCol < 0 || urlCol < 0) {
      const standard = CATEGORY_EXCEL_HEADERS.map(normHeader);
      const slice: string[] = [];
      for (let c = ref.s.c; c <= Math.min(ref.e.c, ref.s.c + 5); c++) {
        slice.push(keys[c] ?? '');
      }
      if (slice.length >= 6 && standard.every((h, i) => slice[i] === h)) {
        labelCol = ref.s.c + 4;
        urlCol = ref.s.c + 5;
      }
    }

    if (labelCol >= 0 && urlCol >= 0 && labelCol !== urlCol) {
      return { headerRow: r, labelCol, urlCol };
    }
  }

  throw new Error(
    `엑셀에서 다음 열을 찾지 못했습니다.\n` +
      `1) ${EXCEL_COL_TOP_FINAL_LABEL}\n` +
      `2) ${EXCEL_COL_FINAL_URL}\n` +
      `Category_Item_Url_List 저장 양식 그대로 업로드하세요.`,
  );
}

/** 엑셀 → 수집 행: 두 필드만 읽는다 */
export function parseCategoryUrlExcel(buffer: ArrayBuffer): TmgCollectRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = pickSheet(wb);
  const { headerRow, labelCol, urlCol } = findExactColumns(sheet);
  const ref = XLSX.utils.decode_range(sheet['!ref']!);

  const out: TmgCollectRow[] = [];

  for (let r = headerRow + 1; r <= ref.e.r; r++) {
    const topFinalLabel = readLabelValue(sheet, r, labelCol);
    const finalCategoryUrl = readUrlValue(sheet, r, urlCol);

    if (!finalCategoryUrl) continue;

    out.push({
      rowIndex: r + 1,
      topFinalLabel,
      finalCategoryUrl,
    });
  }

  if (!out.length) {
    throw new Error(
      `"${EXCEL_COL_FINAL_URL}" 열에 http(s) URL이 없습니다. 엑셀 값을 확인하세요.`,
    );
  }

  return out;
}
