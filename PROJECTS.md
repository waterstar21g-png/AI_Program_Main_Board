# AI_Program_Main_Board — 공식 프로젝트 구성

GitHub 저장소 루트: **`AI_Program_Main_Board`**

**로컬 작업 경로(고정):** `D:\My_Project\AI_Program_Main_Board` — [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md)

| # | 폴더 | 역할 |
|---|------|------|
| 1 | **P1_Category_Url_Extract** | 카테고리별 URL 추출 → 엑셀 |
| 2 | **P2_Product_Capture_App** | 더망고 대량수집 (Node/Playwright CLI) |
| 3 | **P3_Python_Item_Collector** | 더망고 대량수집 (Python, P2와 동일 업무) |

---

## P1_Category_Url_Extract

- **위치:** [`P1_Category_Url_Extract/`](./P1_Category_Url_Extract/)
- **하는 일:** 사이트·상위 카테고리 지정 → 계층 URL 엑셀 (ABC마트/A-RT)
- **실행:** `run.bat` (최초 1회 `npm install` 자동)
- **옵션 예:** `run.bat --tops MEN,WOMEN,KIDS --out 결과.xlsx`

## P2_Product_Capture_App

- **위치:** [`P2_Product_Capture_App/`](./P2_Product_Capture_App/)
- **하는 일:** 더망고 URL 엑셀 기반 상품 대량수집 (0~4 단계 자동)
- **실행:** 엑셀을 `run.bat`에 드래그, 또는 `run.bat 엑셀.xlsx`
- **로그인:** `run.bat --open-only` 로 브라우저만 연 뒤 로그인 → 수집

## P3_Python_Item_Collector

- **위치:** [`P3_Python_Item_Collector/`](./P3_Python_Item_Collector/)
- **하는 일:** P2와 동일한 더망고 대량수집 (Python 단일 스크립트)
- **실행:** `run.bat` + 엑셀 드래그 — Next.js/npm 불필요

## 엑셀 양식 (P1 → P2/P3)

시트 `카테고리표`, 6열. P2/P3가 읽는 열:

| 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|---|---|
| 예: MEN 운동화 | https://... |

## P2 vs P3

| | P2 | P3 |
|---|----|----|
| 런타임 | Node + Playwright | Python + Playwright(CDP) |
| 설치 | `npm install` (폴더 내) | `pip install` (run.bat 자동) |
| 권장 | Node 환경이 이미 있을 때 | 가볍게, 컴파일 없이 |
