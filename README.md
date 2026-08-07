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

## Windows — 웹앱 (P1, P2)

**`run.bat`** 또는 `run.ps1` 더블클릭/실행 — 이 파일 하나로 전부 처리됩니다.

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

## 실행·검증 (P1 → P2 → P3)

보드 좌측 하단 버튼으로 PowerShell 없이 실행합니다.

| 구분 | 버튼 |
|------|------|
| 실행·검증 순서 | ① P1 실행·검증 · ② P2 실행·검증 · ③ P3 실행·검증 |
| PowerShell 대체 | ① 동기화 · ② 캐시정리 · ③ 전체순서검증 |

명령어(보드와 동일):

```bat
verify.bat              REM 전체 순서 검증 (서버 필요)
verify.bat p1
verify.bat p2
verify.bat p3
```

```bash
npm run verify:all            # P1→P2→P3 순서 실행·데이터검증
npm run verify:p1
npm run verify:p2
npm run verify:p3
npm run test:projects:local   # 서버 없이 파일 점검만
```

## run.ps1 없을 때 (최초 1회만)

```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/run.ps1' -OutFile run.ps1 -UseBasicParsing
.\run.ps1 -Sync
```
