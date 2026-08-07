# AI_Program_Main_Board_New

기존 **AI_Program_Main_Board** 는 그대로 두고,  
정제된 **P1 + P3** 만 담은 컴팩트 보드입니다.

| 프로그램 | 설명 |
|----------|------|
| **P1_Category_Url_Extract** | 카테고리별 상품 URL 리스트 추출 |
| **P3_Python_Item_Collector** | 파이썬 독립 더망고 대량수집 (`python-collector/`) |

- P2(웹 Playwright 수집)는 **포함하지 않음** (기존 보드에 유지)
- 기본 포트: **3001** (기존 보드 3000과 분리)

## 로컬 경로 (권장)

```
D:\My_Project\AI_Program_Main_Board\AI_Program_Main_Board_New
```

또는 이 폴더만 따로 복사해도 됩니다.

## 실행

### Windows

```bat
run.bat
```

또는:

```powershell
.\run.ps1
```

브라우저: http://localhost:3001

### Mac / Linux

```bash
cd AI_Program_Main_Board_New
npm install
npm run dev
```

## P3만 (웹 없이)

```
python-collector\run.bat
```

엑셀을 `run.bat`에 드래그 앤 드롭.

## 구성 (최소)

```
AI_Program_Main_Board_New/
  app/                 # Next 보드 UI + /api/crawl, /api/project-test
  components/          # ProgramBoard · P1 · P3
  lib/                 # site-crawler · smoke(p1/p3)
  python-collector/    # P3 배치
  run.bat / run.ps1
```
