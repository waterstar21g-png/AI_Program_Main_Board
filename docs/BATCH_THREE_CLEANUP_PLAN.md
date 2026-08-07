# 배치 프로젝트 3개만 남기는 정리안 (미실행 · 결정 대기)

상태: **검토안** — 사용자 결정 전 **삭제·구조 변경 실행 안 함**

고정 로컬 경로: `D:\My_Project\AI_Program_Main_Board`

---

## 목표

가급적 **배치(독립 실행) 프로젝트 3개만** 남기고 나머지(보드 UI, Vercel, 스모크, 바로가기 등)는 정리.

| # | 남길 프로젝트 | 이상적인 형태 |
|---|---------------|---------------|
| 1 | **P1_Category_Url_Extract** | `P1\run.bat` — 입력 → URL 엑셀 (CLI/배치) |
| 2 | **P2_Product_Capture_App** | `P2\run.bat` — 엑셀 → 더망고 수집 (CLI/배치) |
| 3 | **P3_Python_Item_Collector** | `python-collector\run.bat` — **이미 배치** |

---

## 현재 현실 (중요)

| 프로젝트 | 진짜 실행 진입점 | 비고 |
|----------|------------------|------|
| P1 | 보드 UI (`run.bat` → localhost) + `/api/crawl` | `p1.bat`는 **점검(smoke)만** |
| P2 | 보드 UI + Playwright CDP | `p2.bat`는 **점검만** |
| P3 | **`python-collector\run.bat`** | 유일하게 진짜 배치 |

→ 지금 당장 Next 보드를 지우면 **P1·P2 실행 수단이 사라집니다.**  
배치 3개만 남기려면 **P1·P2를 CLI/bat로 뽑은 뒤** 보드를 제거해야 합니다.

---

## 선택지 (결정용)

### A. 최소 정리 (보드 유지, 군더더기만 삭제)
- 삭제 후보: 죽은 `/api/export`, 스모크·보드버튼(`board-actions`/`project-test`), `p1/p2/p3.bat`·verify, Vercel, 바로가기 묶음, 옛 SR 대량 문서(선택)
- P1/P2는 계속 보드에서 실행
- **위험 낮음**, “배치 3개만” 목표에는 **미달**

### B. 목표 형태 (권장안 · 결정 후 실행)
1. **P1 CLI** 추출: `lib/site-crawler` → `P1_Category_Url_Extract/run.bat` (+ node 또는 얇은 스크립트)
2. **P2 CLI** 추출: `lib/product-data-collect` → `P2_Product_Capture_App/run.bat`
3. **P3**는 폴더명만 정리하거나 `python-collector` 유지
4. 그다음 삭제: `app/`, `components/`, 보드 registry, Vercel, Sync용 Next 런처 대부분
5. 루트는 얇은 README + 3개 폴더만

예상 폴더:

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\     run.bat
  P2_Product_Capture_App\      run.bat
  P3_Python_Item_Collector\    run.bat   (= 현 python-collector)
  README.md
```

### C. 중간안
- P3만 배치로 공식화
- P1/P2는 당분간 보드 유지하되 UI를 3메뉴만 남기고 나머지 껍질 축소
- 나중에 B로 이행

---

## 바로 지워도 되는 것 (A/B 공통 · 실행 시)

- `app/api/export/` (미사용)
- `lib/board-actions/`, `lib/project-smoke/`, 관련 API·`BoardCommandPanel`
- `scripts/run-p*.mjs`, `verify-projects.mjs`, `smoke-projects.mjs`, `p1/p2/p3.bat`, `verify.*`
- `vercel.json`, `npm run vercel:*`
- `setup.bat`/`start.bat` 별칭, (선택) boot/recover/바로가기
- `docs/일별_사용자요건/` 중 옛 캡처·가격비교 SR 대량 (정책 결정 필요)

## B 실행 전에는 지우면 안 되는 것

- P1: `CategoryExtractorApp` + `lib/site-crawler/**` + `/api/crawl` (또는 대체 CLI)
- P2: `ProductDataCollectApp` + `lib/product-data-collect/**` + `/api/product-collect/**` + Playwright
- P3: `python-collector/**`
- 보드를 쓰는 동안: `run.bat` / `run.ps1` / Next 최소 껍질

---

## 결정이 필요한 항목

1. **A / B / C** 중 어느 쪽?
2. P1 배치 입력 방식: 인자? 설정 파일? 대화형?
3. P2는 Python(P3)과 중복인데 **웹(P2) 유지 vs P3만 남김**?
4. SR 문서(`docs/일별_사용자요건`) 보존 범위?
5. GitHub 저장소명·루트는 유지?

---

## 다음 단계

사용자 결정 후 이 문서의 선택지에 맞춰 브랜치에서 실제 정리 실행.
