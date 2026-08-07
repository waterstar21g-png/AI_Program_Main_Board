# AI_Program_Main_Board — 공식 프로젝트 구성

GitHub 저장소 루트: **`AI_Program_Main_Board`**  
**로컬 작업 경로(고정):** `D:\My_Project\AI_Program_Main_Board` — [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md)

공식 프로젝트는 아래 **배치 3개**입니다.

| # | 폴더 | 역할 |
|---|------|------|
| 1 | **P1_Category_Url_Extract** | 카테고리별 URL 추출 → 엑셀 |
| 2 | **P2_Product_Capture_App** | 더망고 상품 대량수집 (Node + Playwright) |
| 3 | **P3_Python_Item_Collector** | P2와 동일 작업 (Python) |

---

## P1_Category_Url_Extract

- **위치:** `P1_Category_Url_Extract/`
- **하는 일:** 사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장 (ABC마트/A-RT)
- **동작:** `fetch(HTML) → 파싱` (브라우저 자동화 없음)
- **실행:** `P1_Category_Url_Extract\run.bat`  
  인자: `--site-name` `--site-url` `--tops` `--out` 또는 `--config`  
  없으면 대화형(Enter = ABC마트 기본값)

## P2_Product_Capture_App

- **위치:** `P2_Product_Capture_App/`
- **하는 일:** 더망고 URL 엑셀 기반 상품 대량수집 (요건 0~4)
- **동작:** Playwright로 로컬 Chrome/Edge에 CDP 연결 — **로컬 PC 전용**
- **실행:** `P2_Product_Capture_App\run.bat 엑셀.xlsx` (드래그 앤 드롭 가능)

## P3_Python_Item_Collector

- **위치:** `P3_Python_Item_Collector/`
- **하는 일:** P2와 완전히 동일한 더망고 대량수집 (파이썬)
- **동작:** `pip install playwright openpyxl` 후 Chrome/Edge CDP
- **실행:** `P3_Python_Item_Collector\run.bat 엑셀.xlsx`

## 독립 실행

P1 / P2 / P3 는 서로 묶이지 않습니다. 각각 따로 실행합니다.

## 제거된 것 (v4.0.0)

- Next.js 웹보드 (`app/`, `components/`, `run.ps1` 등)
- Vercel 배포 설정
- 보드 스모크·검증 버튼 (`p1.bat`/`verify` 등)
- 바탕화면 바로가기 생성 스크립트
- 구 상품캡처·가격조사 기능 (이전부터 삭제됨)
