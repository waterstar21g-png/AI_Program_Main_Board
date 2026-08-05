/** 상위 카테고리명 + 공백 1칸 + 최종 카테고리명 */
export function buildTopFinalLabel(top: string, final: string): string {
  const t = top.trim();
  const f = final.trim();
  if (!t) return f;
  if (!f) return t;
  return `${t} ${f}`;
}
