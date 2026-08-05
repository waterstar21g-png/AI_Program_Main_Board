# AI_Program_Main_Board (로컬 실행)

## Windows — 가장 쉬운 방법

1. **Node.js LTS** 설치: https://nodejs.org  
2. 이 폴더에서 **`setup.bat`** 더블클릭 (최초 1회)  
3. **`start.bat`** 더블클릭 → 브라우저가 `http://localhost:3000` 으로 열립니다.

## Mac / Linux

```bash
npm install
npm run dev:fast
```

브라우저: http://localhost:3000

## 포함 프로그램

| 좌측 목록 | 설명 |
|-----------|------|
| Category_Item_Url_List | 카테고리 URL 엑셀 추출 (API 키 불필요) |
| 상품캡처 및 가격조회 | 사진·키워드 가격 조회 (`.env.local` API 키 필요) |

## 프로그램 추가

`lib/programs/registry.tsx` → `PROGRAMS` 배열에 항목 추가

## 환경 변수 (상품캡처만 해당)

`.env.example` → `.env.local` 복사 후 입력:

```
OPENAI_API_KEY=...
ITEMSCOUT_API_KEY=...
```
