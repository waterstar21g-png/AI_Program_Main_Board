# AI_Program_Main_Board

가볍고 단순한 **배치 자동화 도구 모음**입니다.  
GitHub: `waterstar21g-png/AI_Program_Main_Board`

> **v4.0.0** — Next.js 웹보드를 제거하고, 배치 프로젝트 3개만 남겼습니다.

## 로컬 경로 (고정)

```
D:\My_Project\AI_Program_Main_Board
```

## 프로젝트 3개

| 폴더 | 실행 | 설명 |
|------|------|------|
| **P1_Category_Url_Extract** | `P1_Category_Url_Extract\run.bat` | 카테고리 URL 엑셀 추출 (Node) |
| **P2_Product_Capture_App** | `P2_Product_Capture_App\run.bat` + 엑셀 드래그 | 더망고 대량수집 (Node+Playwright) |
| **P3_Python_Item_Collector** | `P3_Python_Item_Collector\run.bat` + 엑셀 드래그 | P2와 동일 작업 (Python) |

P1 / P2 / P3 는 **서로 독립**입니다. 골라서 하나씩 실행하세요.

## 빠른 시작

```bat
cd /d D:\My_Project\AI_Program_Main_Board

REM P1 — 카테고리 URL 추출
P1_Category_Url_Extract\run.bat

REM P2 — 더망고 수집 (Node)
P2_Product_Capture_App\run.bat 엑셀.xlsx

REM P3 — 더망고 수집 (Python, 가장 가벼움)
P3_Python_Item_Collector\run.bat 엑셀.xlsx
```

## 제거된 것 (보드 blow-up)

- Next.js 웹보드 UI (`app/`, `components/`)
- Vercel 배포 설정
- 보드 버튼/스모크/verify 묶음 (`p1.bat` smoke 등)
- 루트 `run.ps1` / `run.bat` (Next 런처)

상세 구성: [PROJECTS.md](./PROJECTS.md)  
정리 이력: [docs/BATCH_THREE_CLEANUP_PLAN.md](./docs/BATCH_THREE_CLEANUP_PLAN.md)
