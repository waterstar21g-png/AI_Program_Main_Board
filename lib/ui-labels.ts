/** 화면에 보이는 점검·상태 문구 (한국어) */

export type SmokeStatus = 'pass' | 'fail' | 'warn';

export function smokeStatusLabel(status: SmokeStatus): string {
  switch (status) {
    case 'pass':
      return '통과';
    case 'fail':
      return '실패';
    case 'warn':
      return '주의';
  }
}

export const RESULT_PASS = '통과';
export const RESULT_FAIL = '실패';
export const RESULT_CHECK = '확인';
export const RESULT_FAIL_OR_CHECK = '실패/확인';
export const RESULT_OK = '정상';
export const BADGE_LIVE = '실시간';
