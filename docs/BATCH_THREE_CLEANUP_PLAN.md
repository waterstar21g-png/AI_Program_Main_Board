# 배치 프로젝트 3개만 — 실행 완료 (Option B)

상태: **실행됨** (v4.0.0) — Next 보드 UI / Vercel / 스모크·보드버튼 제거

고정 로컬 경로: `D:\My_Project\AI_Program_Main_Board`

---

## 결과 구조

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\     run.bat   (Node + cheerio)
  P2_Product_Capture_App\      run.bat   (Node + Playwright CDP)
  P3_Python_Item_Collector\    run.bat   (Python)
  README.md
  VERSION.txt
  docs/
```

## 선택지 기록

사용자 원문: *"Therefore, AI program main board will blow up."*  
→ 검토안의 **B (목표 형태)** 로 실행: 보드 UI를 날리고 배치 3폴더만 유지.

| 이전 | 이후 |
|------|------|
| Next.js Program Board + P1/P2 UI | 삭제 |
| `python-collector/` | `P3_Python_Item_Collector/` |
| Vercel / board-actions / smoke | 삭제 |
| `p1.bat` 등 스모크 래퍼 | 각 폴더 `run.bat`이 실제 실행 |

## P2 vs P3

둘 다 더망고 대량수집. P2=Node, P3=Python. 필요에 따라 선택.
