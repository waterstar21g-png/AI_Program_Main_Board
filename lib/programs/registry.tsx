import type { ComponentType } from 'react';
import { ProductDataCollectApp } from '@/components/ProductDataCollectApp';
import { CategoryExtractorApp } from '@/components/CategoryExtractorApp';
import { ProductCaptureApp } from '@/components/ProductCaptureApp';

export type ProgramEntry = {
  id: string;
  name: string;
  description: string;
  /** 우측 상단 1줄 요약 (작은 글씨) */
  summaryLine: string;
  component: ComponentType;
};

/** 단위 프로그램 등록 — 기존 프로그램은 수정하지 말고, 신규는 항목만 추가 */
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
  {
    id: 'product-capture-price',
    name: '상품캡처 및 가격조회',
    description: '사진으로 상품 인식 · 가격 조회',
    summaryLine: '사진·키워드 입력 → 상품 인식·가격·시장 정보 조회',
    component: ProductCaptureApp,
  },
];

export const DEFAULT_PROGRAM_ID = PROGRAMS[0].id;
