import type { WorkflowStepId } from './types.js';

export const TMG_LOGIN_URL =
  'https://tmg1898.cafe24.com/mall/admin/admin_login.php';

export const TMG_MAIN_URL =
  'https://tmg1898.cafe24.com/mall/admin/admin.php';

export const TMG_BULK_URL =
  'https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php';

export const TMG_ADMIN_HOST = 'tmg1898.cafe24.com';
export const TMG_BULK_PATH = 'getGoodsNew.php';

/**
 * 0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭
 * 1. URL상품검색하기 : 필드값 입력 후 클릭 -> 팝업창 없어질 때까지 대기
 * 2. 검색된 상품 모두저장 클릭 -> 팝업에서 검색필터명 입력 -> 저장하기 클릭
 * 3. 팝업창 없어질 때까지 대기
 * 4. -> 0. 초기화
 */
export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string }[] = [
  { id: 'open-page', label: '0. 초기화 : 상품데이터수집 → 대량데이터수집' },
  { id: 'paste-url', label: '1. URL상품검색하기 (필드값 입력 후 클릭)' },
  { id: 'wait-search-popup', label: '1. 팝업창 없어질 때까지 대기' },
  { id: 'save-all', label: '2. 검색된 상품 모두저장 클릭' },
  { id: 'fill-save-form', label: '2. 검색필터명 입력 → 저장하기' },
  { id: 'wait-save-popup', label: '3. 팝업창 없어질 때까지 대기' },
  { id: 'next-row', label: '4. → 0. 초기화' },
];
