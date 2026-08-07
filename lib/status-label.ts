/** 점검 상태 → 화면 표시용 한글 라벨 */
export type SmokeStatusLabel = 'pass' | 'fail' | 'warn';

export function statusLabelKo(status: SmokeStatusLabel | string): string {
  switch (status) {
    case 'pass':
      return '통과';
    case 'fail':
      return '실패';
    case 'warn':
      return '경고';
    default:
      return String(status);
  }
}

export function resultOkLabelKo(ok: boolean): string {
  return ok ? '정상' : '확인';
}

export function verifySummaryKo(ok: boolean): string {
  return ok ? '통과' : '실패/확인';
}
