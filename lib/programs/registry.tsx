import type { ComponentType } from 'react';
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

/** 단위 프로그램 등록 — 새 프로그램은 이 배열에 항목만 추가 */
export const PROGRAMS: ProgramEntry[] = [
  {
    id: 'category-item-url-list',
    name: 'Category_Item_Url_List',
    description: '카테고리별 상품 URL 리스트 추출',
    summaryLine: '사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장 (ABC마트/A-RT)',
    component: CategoryExtractorApp,
  },
  {
    id: 'sangpum-capture-price',
    name: '상품캡처 및 가격조회',
    description: '사진으로 상품 인식 · 가격 조회',
    summaryLine: '사진·키워드 입력 → 상품 인식·가격·시장 정보 조회',
    component: ProductCaptureApp,
  },
];

export const DEFAULT_PROGRAM_ID = PROGRAMS[0].id;
