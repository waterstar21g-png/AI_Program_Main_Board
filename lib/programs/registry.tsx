import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
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

const ProductDataCollectApp = dynamic(
  () => import('@/components/ProductDataCollectApp').then(m => m.ProductDataCollectApp),
  { ssr: false, loading: () => <p className="panel__hint">로딩…</p> },
);

const PythonItemCollectorApp = dynamic(
  () => import('@/components/PythonItemCollectorApp').then(m => m.PythonItemCollectorApp),
  { ssr: false, loading: () => <p className="panel__hint">로딩…</p> },
);

/**
 * 단위 프로그램 등록 — 신규는 항목만 추가 (lazy load)
 *
 * P1_Category_Url_Extract  — 카테고리별 URL 추출 (이 보드)
 * P2_Product_Capture_App   — 상품 대량데이터 추출/더망고 자동수집 (이 보드)
 * P3_Python_Item_Collector — P2의 파이썬 독립 버전 (/python-collector)
 */
export const PROGRAMS: ProgramEntry[] = [
  {
    id: 'p1-category-url-extract',
    name: 'P1 · 카테고리 URL 추출',
    description: '카테고리별 상품 URL 리스트 추출',
    summaryLine: '사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장 (ABC마트/A-RT)',
    component: CategoryExtractorApp,
  },
  {
    id: 'p2-product-capture-app',
    name: 'P2 · 상품 대량수집',
    description: '더망고 URL 엑셀 기반 상품 대량수집',
    summaryLine: '수집용 엑셀 업로드 → 더망고 로그인 → 스텝별 자동 수집 반복',
    component: ProductDataCollectApp,
  },
  {
    id: 'p3-python-item-collector',
    name: 'P3 · 파이썬 독립수집',
    description: 'P2의 파이썬 독립 버전',
    summaryLine: 'python-collector/run.bat 에 엑셀 드래그 → 더망고 대량수집',
    component: PythonItemCollectorApp,
  },
];

export const DEFAULT_PROGRAM_ID = PROGRAMS[0].id;
