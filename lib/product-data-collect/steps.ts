import type { WorkflowStepId } from '@/lib/product-data-collect/types';

export const TMG_LOGIN_URL =
  'https://tmg1898.cafe24.com/mall/admin/admin_login.php';

export const TMG_BULK_URL =
  'https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php';

/** 로그인 제외 — 대량수집 메인 진입 후 1~6 (엑셀 전체 반복 = 7~8) */
export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string }[] = [
  { id: 'open-page', label: '[1] 로그인→대량수집 메인 (getGoodsNew.php)' },
  { id: 'clear-grid', label: '[2] 입력 그리드 CLEAR → URL 입력 → URL상품검색하기' },
  { id: 'wait-search-popup', label: '[3] 검색 팝업 닫힘 대기 (망고 속도)' },
  { id: 'save-all', label: '[4] 검색된 상품 모두 저장 클릭' },
  { id: 'fill-save-form', label: '[5] 상품저장설정 (검색필터명→저장상품수→저장하기)' },
  { id: 'wait-save-popup', label: '[6] 저장 팝업 닫힘 대기 (망고 속도)' },
  { id: 'next-row', label: '[7~8] 다음 엑셀 행으로 1번부터 반복' },
];
