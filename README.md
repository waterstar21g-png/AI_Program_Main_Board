# AI_Program_Main_Board

가볍고 단순한 배치 자동화 도구 모음입니다.  
GitHub 저장소: `waterstar21g-png/AI_Program_Main_Board`  
프로젝트 구성은 [PROJECTS.md](./PROJECTS.md) 참고.

## 공식 프로젝트명

| 프로그램 | 설명 |
|----------|------|
| **P1_Category_Url_Extract** | 카테고리별 상품 URL 리스트 추출 (ABC마트/A-RT) |
| **P2_Product_Capture_App** | 더망고 URL 엑셀 기반 상품 대량수집 (Next.js + Playwright) |
| **P3_Python_Item_Collector** | P2와 같은 작업의 파이썬 독립 버전 (`python-collector/`) |

모노레포 + 논리 분리를 유지합니다. (폴더 4개로 물리 분리하지 않음)

**정리 검토(미실행):** 배치 3개만 남기는 안 → [docs/BATCH_THREE_CLEANUP_PLAN.md](./docs/BATCH_THREE_CLEANUP_PLAN.md)

## 신규 컴팩트 보드 (별도 · Python)

기존 보드(**이 루트**, Next.js)는 유지합니다.  
정제본: [`AI_Program_Main_Board_New/`](./AI_Program_Main_Board_New/) — **Python만**, **P1 + P2**, **npm 없음**.

```bat
cd AI_Program_Main_Board_New
run.bat
```

## 로컬 작업 경로 (고정)

```
D:\My_Project\AI_Program_Main_Board
```

자세한 내용: [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md)  
폴더를 옮길 때 복사 항목이 수만 개면 → 거의 전부 `node_modules`입니다. **제외하고** 옮긴 뒤 `npm install`.

## 컴파일이 느리면 (중요)

기능 삭제만으로는 안 줄어듭니다. **OneDrive / 백신**이 `node_modules`를 스캔하면 26분+ 납니다.

1. 프로젝트를 **`D:\My_Project\AI_Program_Main_Board`** 에서 실행 (OneDrive 밖)
2. 관리자 PowerShell: `scripts\windows-speed-fix.ps1`
3. 보드 UI가 필요 없으면 **컴파일 0초**: `python-collector\run.bat` (P3)
4. v3.4.0부터 dev 기본은 **Turbopack** (느리면 `NEXT_USE_WEBPACK=1`)

## Windows — 웹앱 (P1, P2)

**경로:** `D:\My_Project\AI_Program_Main_Board`  
**바탕화면 바로가기:** `make-shortcut.bat` / `바로가기만들기.bat`  
**실행:** **`run.bat`** 또는 `run.ps1` 더블클릭 — 이 파일 하나로 전부 처리됩니다.

```powershell
.\run.ps1          # 평소: 동기화 생략, 바로 실행
.\run.ps1 -Sync    # 업데이트: GitHub에서 최신 코드 받기
.\run.ps1 -Clean   # 캐시가 깨진 것 같을 때만
```

1. 구버전이면 GitHub에서 필요 파일 자동 다운로드
2. `npm install` (최초 1회 또는 Next.js 버전이 바뀐 경우만)
3. http://localhost:3000 실행 (서버가 실제로 뜬 뒤 브라우저 자동 오픈)

## Mac / Linux

```bash
npm install
npm run dev
```

## P3 — 파이썬 독립 실행

웹앱 없이 [`python-collector/`](./python-collector) 폴더만으로 실행됩니다 — 자세한 건 그 폴더의 README 참고.
보드 좌측 목록에도 **P3_Python_Item_Collector** 가 표시되며, 환경 점검을 할 수 있습니다.

## 프로젝트별 독립 실행

P1 / P2 / P3 는 **서로 독립**입니다. 골라서 하나씩 실행합니다.  
각 프로젝트 안의 **명령 순서**는 [`scripts/COMMANDS.txt`](./scripts/COMMANDS.txt) 참고.

| 구분 | 보드 버튼 |
|------|-----------|
| 독립 실행 | ① P1 · ② P2 · ③ P3 |
| PowerShell 대체 | ① 동기화 · ② 캐시정리 · ③ 개별점검 묶음 |

```bat
p1.bat                 REM P1만 (독립)
p2.bat
p3.bat
verify.bat p1
```

```bash
npm run p1                 # P1 독립 — 명령 순서 안내 포함
npm run p2
npm run p3
npm run verify:all         # 세 개를 각각 독립 실행 후 결과만 모음 (연쇄 아님)
```

## run.ps1 없을 때 (최초 1회만)

```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/run.ps1' -OutFile run.ps1 -UseBasicParsing
.\run.ps1 -Sync
```
