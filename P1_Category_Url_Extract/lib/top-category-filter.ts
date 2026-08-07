import type { LeafCategory } from './types';

/** 상위 카테고리명 정규화 (비교용) */
export function normalizeTopName(name: string): string {
  return name.trim().toUpperCase();
}

/** 사용자 입력 상위 카테고리 목록 정리 (빈 값 제거, 최대 15개) */
export function sanitizeTopCategories(input: string[], max = 15): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeTopName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

/** GNB 상위 카테고리가 사용자 지정 목록에 포함되는지 */
export function matchesTopCategory(leafTop: string, allowed: string[]): boolean {
  if (!allowed.length) return false;
  const key = normalizeTopName(leafTop);
  return allowed.some(a => normalizeTopName(a) === key);
}

export function filterLeavesByTop(leaves: LeafCategory[], topCategories: string[]): LeafCategory[] {
  const allowed = sanitizeTopCategories(topCategories);
  if (!allowed.length) return [];
  return leaves.filter(l => matchesTopCategory(l.top, allowed));
}
