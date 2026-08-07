# AI_Program_Main_Board

배치 프로젝트 **3개만** 남긴 모노레포입니다.  
Next.js 프로그램 보드 UI · Vercel · 스모크/보드 버튼은 **제거(blow-up)** 했습니다.

로컬 경로(고정): `D:\My_Project\AI_Program_Main_Board`

| # | 폴더 | 역할 | 실행 |
|---|------|------|------|
| 1 | **P1_Category_Url_Extract** | ABC마트/A-RT 카테고리 URL 엑셀 추출 | `P1_Category_Url_Extract\run.bat` |
| 2 | **P2_Product_Capture_App** | 더망고 URL 엑셀 대량수집 (Node + Playwright) | `P2_Product_Capture_App\run.bat` + 엑셀 드래그 |
| 3 | **P3_Python_Item_Collector** | P2와 같은 작업 (Python) | `P3_Python_Item_Collector\run.bat` + 엑셀 드래그 |

P1 / P2 / P3 는 **서로 독립**입니다. 필요한 것만 골라 실행하세요.

## 빠른 시작

```bat
cd /d D:\My_Project\AI_Program_Main_Board

REM P1 — 카테고리 URL 추출
P1_Category_Url_Extract\run.bat

REM P2 — 더망고 수집 (Node)
P2_Product_Capture_App\run.bat 카테고리URL.xlsx

REM P3 — 더망고 수집 (Python, 가장 가벼움)
P3_Python_Item_Collector\run.bat 카테고리URL.xlsx
```

## 요구 사항

| 프로젝트 | 필요 |
|----------|------|
| P1 | Node.js |
| P2 | Node.js + Chrome/Edge |
| P3 | Python 3 + Chrome/Edge |

각 폴더의 `README.md` 참고.

## 버전

`VERSION.txt` — 현재 **4.0.0** (보드 UI 제거 · 배치 3폴더 구조)
