import type { WorkflowStepId } from '@/lib/product-data-collect/types';

export const TMG_LOGIN_URL =
  'https://tmg1898.cafe24.com/mall/admin/admin_login.php';

export const TMG_BULK_URL =
  'https://tmg1898.cafe24.com/mall/admin/shop/getGoodsNew.php';

/**
 * URL 신호 기준 1~4단계 (공식 API 없음)
 * 1) getGoodsNew.php 진입
 * 2) URL상품검색하기 → ABC팝업(pmode=mango) → 팝업 종료까지 대기(망고 속도)
 * 3) 검색된 상품 모두저장 → #layer / 상품저장설정
 * 4) 검색필터명·저장상품수 → 저장하기 → 모달 종료 대기
 */
export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string }[] = [
  { id: 'open-page', label: '[1] getGoodsNew.php 대량수집 진입' },
  { id: 'clear-grid', label: '[2] URL입력 → URL상품검색하기' },
  { id: 'wait-search-popup', label: '[2] ABC팝업 종료 대기 (망고 수집)' },
  { id: 'save-all', label: '[3] 검색된 상품 모두저장 (#layer)' },
  { id: 'fill-save-form', label: '[4] 상품저장설정 → 저장하기' },
  { id: 'wait-save-popup', label: '[4] 저장 모달 종료 대기' },
  { id: 'next-row', label: '다음 행 → 다시 [1] getGoodsNew.php' },
];
