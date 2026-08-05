import type { WorkflowStepId } from '@/lib/product-data-collect/types';

export const TMG_LOGIN_URL =
  'https://tmg1898.cafe24.com/mall/admin/admin_login.php';

export const TMG_BULK_URL =
  'https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php';

/**
 * 필수 순서 (어기면 안 됨):
 * 메뉴초기화 → URL필드 입력 → 검색클릭 → 모달 종료 대기 → 모두저장 →
 * 저장설정 → 모달 종료 대기 → 다음 행(다시 메뉴초기화)
 */
export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string }[] = [
  { id: 'open-page', label: '[1] 로그인→대량수집 메인' },
  { id: 'clear-grid', label: '[2] 매 행: 상품데이터수집→대량수집 메뉴(초기화)' },
  { id: 'wait-search-popup', label: '[3] URL입력→검색 → 모달 종료 대기' },
  { id: 'save-all', label: '[4] 모달 종료 후 → 검색된 상품 모두저장' },
  { id: 'fill-save-form', label: '[5] 상품저장설정 입력 → 저장하기' },
  { id: 'wait-save-popup', label: '[6] 저장 모달 종료까지 대기' },
  { id: 'next-row', label: '[7] 다음 행 → 다시 메뉴 초기화부터' },
];
