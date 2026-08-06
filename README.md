# AI_Program_Main_Board

가볍고 단순한 배치 자동화 도구 모음입니다. 프로젝트 구성은 [PROJECTS.md](./PROJECTS.md) 참고.

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

## 포함 프로그램 (웹앱 보드)

| 프로그램 | 설명 |
|----------|------|
| **P1_Category_Url_Extract** | 카테고리별 상품 URL 리스트 추출 (ABC마트/A-RT) |
| **P2_Product_Capture_App** | 더망고 URL 엑셀 기반 상품 대량수집 (Next.js + Playwright) |

**P3_Python_Item_Collector**는 P2와 같은 작업을 하는 파이썬 독립 버전입니다.
웹앱 없이 [`python-collector/`](./python-collector) 폴더만으로 실행됩니다 — 자세한 건 그 폴더의 README 참고.

## run.ps1 없을 때 (최초 1회만)

```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main/run.ps1' -OutFile run.ps1 -UseBasicParsing
.\run.ps1 -Sync
```
