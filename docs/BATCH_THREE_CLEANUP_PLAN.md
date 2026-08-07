# 배치 프로젝트 3개만 남기는 정리안

상태: **실행 완료** (v4.0.0, 2026-08-07) — 선택지 **B** 적용

고정 로컬 경로: `D:\My_Project\AI_Program_Main_Board`

---

## 결과 구조

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\     run.bat
  P2_Product_Capture_App\      run.bat
  P3_Python_Item_Collector\    run.bat   (구 python-collector)
  README.md
```

## 적용 내용 (B안)

1. P1 CLI 추출 — `P1_Category_Url_Extract/` (`lib/site-crawler` + `cli.ts`)
2. P2 CLI 추출 — `P2_Product_Capture_App/` (`lib/product-data-collect` + `cli.ts`)
3. P3 — `python-collector` → `P3_Python_Item_Collector` 로 폴더명 정리
4. 삭제 — `app/`, `components/`, 루트 `lib/`, Vercel, `run.ps1`, 스모크·바로가기·`p1/p2/p3.bat` 등

## 미결정·유지 사항

- SR 문서(`docs/일별_사용자요건/`) — 기존 보존
- GitHub 저장소명·루트 — 유지
- P2와 P3 둘 다 유지 (동일 업무, 실행 방식만 다름)
