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

/** 단위 프로그램 등록 — 신규는 항목만 추가 (lazy load) */
export const PROGRAMS: ProgramEntry[] = [
  {
    id: 'category-item-url-list',
    name: 'Category_Item_Url_List',
    description: '카테고리별 상품 URL 리스트 추출',
    summaryLine: '사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장 (ABC마트/A-RT)',
    component: CategoryExtractorApp,
  },
  {
    id: 'product-data-collect',
    name: '상품데이터수집',
    description: '더망고 URL 엑셀 기반 상품 대량수집',
    summaryLine: '수집용 엑셀 업로드 → 더망고 로그인 → 스텝별 자동 수집 반복',
    component: ProductDataCollectApp,
  },
];

export const DEFAULT_PROGRAM_ID = PROGRAMS[0].id;
