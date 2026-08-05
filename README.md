# AI_Program_Main_Board

AI 단위 프로그램 실행 보드 — 카테고리 URL 추출, 상품캡처·가격조회 등

**배포 URL:** https://sangpum-capture-price.vercel.app  
(실행 프로그램명: `AI_Program_Main_Board`)

## 주요 기능

| 기능 | 설명 |
|------|------|
| 상품 캡처 | 카메라 촬영 / 갤러리 이미지 선택 |
| 상품 인식 | OpenAI Vision API로 상품명·키워드 자동 추출 |
| 시중 최저가 | 쇼핑몰별 최저가격 목록 |
| 경쟁 강도 | 키워드 분석 기반 0~100 지표 |
| 1주 조회수 | 최근 1주간 검색·조회 수 |
| 경쟁 상품수 | 등록된 경쟁 상품 수 |
| 1주 판매량 | 최근 1주 판매량 추정 |
| 조회 추세 | 최근 7일 조회 추세 그래프 |

## 데이터 출처

- [아이템스카우트](https://itemscout.io) — B2B API ([신청](https://itemscout.io/api))

## 시작하기

```bash
cd sangpum-capture-price
cp .env.example .env.local
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 환경 변수

```bash
# 상품 이미지 인식 (사진 분석 시)
OPENAI_API_KEY=sk-...

# 아이템스카우트 B2B API (미설정 시 데모 데이터)
ITEMSCOUT_API_KEY=발급받은_키

# 선택: API 엔드포인트 커스터마이즈
# ITEMSCOUT_API_BASE_URL=https://api.itemscout.io
# ITEMSCOUT_KEYWORD_PATH=/api/open/v1/keyword
```

## 기술 스택

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

## 프로젝트 구조

```
sangpum-capture-price/
├── app/
│   ├── api/analyze/route.ts   # 분석 API
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ProductCaptureApp.tsx  # 메인 UI
│   └── ViewTrendChart.tsx     # 조회 추세 차트
└── lib/
    ├── product-vision.ts      # OpenAI 상품 인식
    └── itemscout/             # 아이템스카우트 클라이언트
```

## 라이선스

Private
