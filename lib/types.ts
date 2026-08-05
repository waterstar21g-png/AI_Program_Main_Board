export interface CategoryInput {
  id: string;
  name: string;
  /** 네이버 쇼핑 catId (선택) */
  catId?: string;
  /** 카테고리 목록 URL 직접 입력 (선택, catId 없을 때) */
  listUrl?: string;
  /** 카테고리당 추출할 상품 수 (1~100) */
  count: number;
}

export interface ProductUrlRow {
  category: string;
  categoryUrl: string;
  rank: number;
  title: string;
  productUrl: string;
  price: number;
  mallName: string;
}

export interface ExtractResult {
  rows: ProductUrlRow[];
  errors: { category: string; message: string }[];
  usedNaverApi: boolean;
}
