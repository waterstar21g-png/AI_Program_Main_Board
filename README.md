# AI_Program_Main_Board

AI 단위 프로그램 실행 보드 — 카테고리 URL 추출, 상품캡처·가격조회 등

**배포 URL:** https://ai-program-main-board.vercel.app

## 시작하기

```bash
cd AI_Program_Main_Board
cp .env.example .env.local   # 필요 시
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 프로그램 추가

`lib/programs/registry.tsx` 의 `PROGRAMS` 배열에 항목을 추가합니다.

## 환경 변수

```bash
OPENAI_API_KEY=sk-...          # 상품 이미지 인식
ITEMSCOUT_API_KEY=...          # 아이템스카우트 API
BLOB_READ_WRITE_TOKEN=...      # Vercel Blob (이미지 저장)
```

## 배포

```bash
npm run vercel:deploy
```

Vercel 프로젝트명: `AI_Program_Main_Board`
