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
