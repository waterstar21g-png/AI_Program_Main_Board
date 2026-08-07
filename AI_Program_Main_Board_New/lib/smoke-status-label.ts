import type { SmokeStatus } from '@/lib/project-smoke/run';

/** 점검 항목 상태 → 화면 표시 */
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

/** 전체 점검 결과 배지 */
export function verifyResultLabel(ok: boolean): string {
  return ok ? '통과' : '실패/확인';
}
