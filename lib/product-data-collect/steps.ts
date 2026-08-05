import type { WorkflowStepId } from '@/lib/product-data-collect/types';

export const TMG_LOGIN_URL =
  'https://tmg1898.cafe24.com/mall/admin/admin_login.php';

export const TMG_BULK_URL =
  'https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php';

export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string }[] = [
  { id: 'login', label: '더망고 로그인' },
  { id: 'open-page', label: '상품데이터 대량수집 페이지 이동' },
  { id: 'clear-grid', label: 'URL 입력란 CLEAR' },
  { id: 'paste-url', label: '최종 카테고리 URL 붙여넣기' },
  { id: 'url-search', label: 'URL상품검색하기 클릭' },
  { id: 'wait-search-popup', label: '검색 팝업 종료 대기' },
  { id: 'save-all', label: '검색된 상품 모두 저장' },
  { id: 'fill-save-form', label: '상품저장설정 입력 (저장상품수·검색필터명)' },
  { id: 'wait-save-popup', label: '저장 팝업 종료 대기' },
];
