# 배치 프로젝트 3개만 남기는 정리안 — **실행 완료 (선택지 B)**

상태: **완료** (v4.0.0)

고정 로컬 경로: `D:\My_Project\AI_Program_Main_Board`

---

## 결정 사항 (사용자: "It's up to you. Good choice.")

| 항목 | 결정 |
|------|------|
| 선택지 | **B** (권장안) |
| P1 입력 | CLI 인자 (`--site`/`--url`/`--tops`) + ABC마트 기본값 |
| P2 | Node CLI로 유지 (P3와 병행, 3프로젝트 유지) |
| SR 문서 | `docs/일별_사용자요건/` **보존** |
| GitHub 저장소명 | `AI_Program_Main_Board` 유지 |

---

## 결과 폴더

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\     run.bat
  P2_Product_Capture_App\      run.bat
  P3_Python_Item_Collector\    run.bat   (구 python-collector)
  README.md
  PROJECTS.md
  docs/
```

## 제거된 것

- `app/`, `components/`, 루트 `lib/`, Next/Vercel/보드 Sync·바로가기·스모크
