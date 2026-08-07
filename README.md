# AI_Program_Main_Board

배치(독립 실행) 프로젝트 **3개**만 남긴 모노레포입니다.

GitHub: `waterstar21g-png/AI_Program_Main_Board`  
로컬 고정 경로: `D:\My_Project\AI_Program_Main_Board`

| # | 폴더 | 실행 |
|---|------|------|
| 1 | [`P1_Category_Url_Extract`](./P1_Category_Url_Extract) | `run.bat` — 카테고리 URL 엑셀 추출 |
| 2 | [`P2_Product_Capture_App`](./P2_Product_Capture_App) | `run.bat 엑셀.xlsx` — 더망고 대량수집 (Node) |
| 3 | [`P3_Python_Item_Collector`](./P3_Python_Item_Collector) | `run.bat 엑셀.xlsx` — 더망고 대량수집 (Python) |

구성 상세: [PROJECTS.md](./PROJECTS.md)

## 빠른 시작

```bat
cd D:\My_Project\AI_Program_Main_Board

REM P1 — ABC마트 카테고리 URL
P1_Category_Url_Extract\run.bat

REM P2 — 더망고 수집 (Node + Playwright)
P2_Product_Capture_App\run.bat 카테고리엑셀.xlsx

REM P3 — 더망고 수집 (Python)
P3_Python_Item_Collector\run.bat 카테고리엑셀.xlsx
```

P2와 P3는 **같은 업무**의 두 실행 방식입니다. UI/컴파일 없이 가볍게 쓰려면 P3, Node 환경을 쓰면 P2.

## 제거된 것 (v4.0.0)

- Next.js 보드 UI / Vercel 배포
- Sync·바로가기·스모크/verify 런처
- 루트 `npm run dev` 웹앱

각 프로젝트 폴더에서 각자 `npm install` 또는 `pip install` 합니다.
