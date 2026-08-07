# AI_Program_Main_Board — 공식 프로젝트 구성 (v4)

로컬 작업 경로(고정): `D:\My_Project\AI_Program_Main_Board`

| # | 폴더 | 역할 | 실행 |
|---|------|------|------|
| 1 | **P1_Category_Url_Extract** | 카테고리별 URL 추출 | `run.bat` |
| 2 | **P2_Product_Capture_App** | 더망고 대량수집 (Node) | `run.bat` + 엑셀 |
| 3 | **P3_Python_Item_Collector** | 더망고 대량수집 (Python) | `run.bat` + 엑셀 |

## P1_Category_Url_Extract

- HTML fetch + cheerio 파싱 (브라우저 자동화 없음)
- 결과: `*_카테고리URL_LIST_YYYYMMDD.xlsx`

## P2_Product_Capture_App

- Playwright CDP → 로컬 Chrome/Edge
- P1 엑셀(또는 동일 양식)을 입력으로 사용
- **로컬 PC 전용**

## P3_Python_Item_Collector

- P2와 동일 업무의 Python 단일 스크립트
- `pip install` 두 패키지만으로 실행 — 컴파일/캐시 이슈 없음

## 보드(Next.js) 상태

**제거됨 (v4.0.0).** 웹 UI·Vercel·보드 스모크는 더 이상 이 저장소에 없습니다.
