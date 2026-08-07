# AI_Program_Main_Board — 공식 프로젝트 구성

로컬 작업 경로(고정): `D:\My_Project\AI_Program_Main_Board`

공식 프로젝트는 아래 **배치 3개**입니다.

| # | 폴더 | 역할 | 실행 |
|---|------|------|------|
| 1 | **P1_Category_Url_Extract** | 카테고리별 URL 추출 (ABC마트/A-RT) | `P1_Category_Url_Extract\run.bat` |
| 2 | **P2_Product_Capture_App** | 더망고 URL 엑셀 → 상품 대량수집 (Node/Playwright) | `P2_Product_Capture_App\run.bat 엑셀.xlsx` |
| 3 | **P3_Python_Item_Collector** | P2와 동일 작업의 Python 버전 | `P3_Python_Item_Collector\run.bat 엑셀.xlsx` |

---

## P1_Category_Url_Extract

- **위치:** `P1_Category_Url_Extract/`
- **하는 일:** 사이트·상위 카테고리 지정 → 계층 URL 엑셀 저장
- **방식:** Node `fetch(HTML) → cheerio 파싱` (브라우저 자동화 없음)
- **입력:** CLI 인자 (`--site`, `--url`, `--tops`) — 기본값 ABC마트 MEN/WOMEN/KIDS
- **출력:** `{사이트}_카테고리URL_LIST_{YYYYMMDD}.xlsx`

## P2_Product_Capture_App

- **위치:** `P2_Product_Capture_App/`
- **하는 일:** 더망고(tmg1898) URL 엑셀 기반 상품 대량수집
- **방식:** Playwright CDP → 로컬 Chrome/Edge
- **입력:** P1 양식 엑셀 (상위 최종 카테고리명 / 최종 카테고리 URL주소)
- **로컬 PC 전용**

## P3_Python_Item_Collector

- **위치:** `P3_Python_Item_Collector/` (구 `python-collector/`)
- **하는 일:** P2와 완전히 동일한 더망고 대량수집
- **방식:** `pip install playwright openpyxl` + `collect.py`
- **실행:** 엑셀을 `run.bat`에 드래그 앤 드롭

> P2(Node)와 P3(Python)는 같은 일을 하는 두 가지 실행 방식입니다.

## 제거된 것

- Next.js 보드 UI, Vercel, Sync/바로가기, 스모크·verify 보드 버튼
- 구 상품캡처·가격조사 기능 (이전부터 별도 보관)
