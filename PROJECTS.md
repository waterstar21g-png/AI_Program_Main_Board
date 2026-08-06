# AI_Program_Main_Board — 프로젝트 구성

가볍고 단순한 배치 자동화 도구 3개로 구성됩니다.

## P1_Category_Url_Extract

- **위치:** 웹앱 보드 (`components/CategoryExtractorApp.tsx`, `lib/site-crawler/`)
- **하는 일:** 사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장 (ABC마트/A-RT)
- **동작 방식:** 서버에서 `fetch(HTML) → 파싱` — 브라우저 자동화 불필요, Vercel에서도 동작
- **실행:** 웹앱(`run.ps1`) 실행 후 보드 좌측 메뉴에서 선택

## P2_Product_Capture_App

- **위치:** 웹앱 보드 (`components/ProductDataCollectApp.tsx`, `lib/product-data-collect/`)
- **하는 일:** 더망고(tmg1898) URL 엑셀 기반 상품 대량수집 — 요건 0~4 자동 반복
- **동작 방식:** Playwright로 로컬 PC의 실제 Chrome/Edge에 CDP 연결 (별도 Chromium 다운로드 없음) — **로컬 PC 전용, Vercel 불가**
- **실행:** 웹앱(`run.ps1`) 실행 후 보드 좌측 메뉴에서 선택

## P3_Python_Item_Collector

- **위치:** [`python-collector/`](./python-collector) (독립 폴더, 웹앱과 무관)
- **하는 일:** **P2와 완전히 동일한 작업**(더망고 대량수집)을 하는 파이썬 단일 스크립트 버전
- **동작 방식:** Next.js/React/webpack 전혀 없음. `pip install` 두 패키지(`playwright`, `openpyxl`)만으로 실행
- **실행:** `python-collector/run.bat` 더블클릭 (또는 엑셀 파일을 그 위에 드래그)
- **P2와의 관계:** 같은 업무를 웹앱 없이 훨씬 가볍게 돌리고 싶을 때 사용. 웹앱 컴파일/캐시/인코딩 이슈에서 완전히 자유로움

> P2(웹앱)와 P3(파이썬)는 같은 일을 하는 두 가지 실행 방식입니다.
> 웹앱 UI(엑셀 업로드 화면·실행 로그 화면)가 필요하면 P2, 그냥 빠르고
> 가볍게 돌리고 싶으면 P3를 쓰면 됩니다.

## 제거된 기능

- **상품캡처·가격조사** (구 `ProductCaptureApp` 및 연관 컴포넌트/API/lib 전체) —
  별도로 독자 보관 중이라 이 저장소에서는 완전히 삭제했습니다
  (`components/ProductCaptureApp.tsx` 외 다수, `lib/itemscout/*`,
  `lib/naver-shopping*`, `lib/coupang-app.ts`, `lib/product-vision.ts`,
  `lib/image-db.ts`, `/api/analyze`, `/api/search-images`,
  `/api/itemscout-resolve`, `/api/naver-shopping-preview`, Kiwi Browser
  안내 페이지 등). `@vercel/blob` npm 의존성도 함께 제거.
