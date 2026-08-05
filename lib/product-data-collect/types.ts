/** 엑셀 1행 = 더망고 1회 수집 작업 */
export interface TmgCollectRow {
  rowIndex: number;
  /** 엑셀: 최종 카테고리 URL주소 */
  finalCategoryUrl: string;
  /** 엑셀: 상위 최종 카테고리명 → 검색필터명 */
  topFinalLabel: string;
}

export type WorkflowStepId =
  | 'login'
  | 'open-page'
  | 'clear-grid'
  | 'paste-url'
  | 'url-search'
  | 'wait-search-popup'
  | 'save-all'
  | 'fill-save-form'
  | 'wait-save-popup'
  | 'next-row';

export interface WorkflowStepLog {
  step: WorkflowStepId;
  label: string;
  rowIndex?: number;
  at: string;
  message?: string;
}

export interface TmgCollectRequest {
  /** 사용 안 함 — 로그인은 Chromium에서 직접 */
  loginId?: string;
  loginPw?: string;
  siteName?: string;
  rows: TmgCollectRow[];
  /** 검색결과상위 저장 개수 (기본 3) */
  saveCount?: number;
  headless?: boolean;
  /** false면 Chromium 창을 자동으로 닫지 않음 (기본: 화면 보기 모드에서 true) */
  keepBrowserOpen?: boolean;
  /** true면 이미 연 Chromium에서 바로 단계별 수집 (5분 대기 없음) */
  useExistingBrowser?: boolean;
  startRowIndex?: number;
}

export interface TmgCollectResult {
  ok: boolean;
  logs: WorkflowStepLog[];
  processedCount: number;
  message?: string;
}
