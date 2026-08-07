import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { CATEGORY_APP_NAME } from '@/lib/category-app-name';

export type ProgramEntry = {
  id: string;
  name: string;
  description: string;
  summaryLine: string;
  component: ComponentType;
};

const CategoryExtractorApp = dynamic(
  () => import('@/components/CategoryExtractorApp').then(m => m.CategoryExtractorApp),
  { ssr: false, loading: () => <p className="panel__hint">로딩…</p> },
);

const PythonItemCollectorApp = dynamic(
  () => import('@/components/PythonItemCollectorApp').then(m => m.PythonItemCollectorApp),
  { ssr: false, loading: () => <p className="panel__hint">로딩…</p> },
);

/**
 * AI_Program_Main_Board_New — P1 / P3 만 등록
 * (기존 AI_Program_Main_Board 의 P2 는 포함하지 않음)
 */
export const PROGRAMS: ProgramEntry[] = [
  {
    id: 'p1-category-url-extract',
    name: CATEGORY_APP_NAME,
    description: '카테고리별 상품 URL 리스트 추출',
    summaryLine: '사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장 (ABC마트/A-RT)',
    component: CategoryExtractorApp,
  },
  {
    id: 'p3-python-item-collector',
    name: 'P3_Python_Item_Collector',
    description: '파이썬 독립 더망고 대량수집',
    summaryLine: 'python-collector/run.bat 에 엑셀 드래그 → 더망고 대량수집',
    component: PythonItemCollectorApp,
  },
];

export const DEFAULT_PROGRAM_ID = PROGRAMS[0].id;
