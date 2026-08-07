# AI_Program_Main_Board

배치 자동화 3개만 남긴 모노레포입니다.  
GitHub: `waterstar21g-png/AI_Program_Main_Board`  
구성: [PROJECTS.md](./PROJECTS.md)

## 로컬 경로 (고정)

```
D:\My_Project\AI_Program_Main_Board
```

## 프로젝트

| 폴더 | 실행 | 설명 |
|------|------|------|
| **P1_Category_Url_Extract** | `P1_Category_Url_Extract\run.bat` | A-RT/ABC마트 카테고리 URL → 엑셀 |
| **P2_Product_Capture_App** | `P2_Product_Capture_App\run.bat` 엑셀.xlsx | 더망고 대량수집 (Node + Playwright CDP) |
| **P3_Python_Item_Collector** | `P3_Python_Item_Collector\run.bat` 엑셀.xlsx | P2와 동일 작업 (Python) |

웹보드(Next.js) · Vercel · 스모크/바로가기 런처는 **제거**했습니다. 각 폴더의 `run.bat`만 사용하세요.

## 빠른 시작 (Windows)

```bat
cd /d D:\My_Project\AI_Program_Main_Board

REM 1) 카테고리 URL 추출
P1_Category_Url_Extract\run.bat

REM 2) 더망고 수집 — Node
P2_Product_Capture_App\run.bat 결과엑셀.xlsx

REM 또는 3) 더망고 수집 — Python
P3_Python_Item_Collector\run.bat 결과엑셀.xlsx
```

P2와 P3는 같은 업무의 두 가지 실행 방식입니다. UI/컴파일이 필요 없으면 P3가 더 가볍습니다.

## 버전

`VERSION.txt` → **4.0.0**
