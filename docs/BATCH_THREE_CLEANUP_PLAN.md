# 배치 프로젝트 3개만 남기는 정리안 — 실행 완료 (옵션 B)

상태: **완료** (v4.0.0)  
고정 로컬 경로: `D:\My_Project\AI_Program_Main_Board`

---

## 결정 사항 (사용자: "It's up to you. Good choice.")

| 항목 | 선택 |
|------|------|
| 방향 | **B** 목표 형태 (권장안) |
| P1 입력 | CLI 인자 + `--config` + 대화형 폴백 |
| P2 | Node 배치로 유지 (웹보드 제거). P3(Python)와 병행 |
| SR 문서 | `docs/일별_사용자요건/` **보존** |
| GitHub 저장소명 | `AI_Program_Main_Board` 유지 |

---

## 결과 구조

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\     run.bat
  P2_Product_Capture_App\      run.bat
  P3_Python_Item_Collector\    run.bat
  README.md
```

## 제거됨

- `app/`, `components/`, 루트 `lib/`, Next/Vercel, 보드 스모크·바로가기·`run.ps1` 등
- `python-collector/` → `P3_Python_Item_Collector/` 로 이전
