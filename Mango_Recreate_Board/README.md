# Mango_Recreate_Board **v1.0.0** (Python B안)

**최종 UI:** Python 심플 보드 (npm / Next.js **없음**)  
**출처:** `AI_Program_Main_Board` 메인 UI만 복사 · 프로그램은 추후 추가

| 프로그램 | 역할 |
|----------|------|
| _(없음)_ | 신규 프로그램 추가 예정 |

로컬 경로(고정):

```
D:\My_Project\Mango_Recreate_Board
```

## 로컬에 받기 (최초 1회)

```powershell
Set-Location D:\My_Project
if (Test-Path .\Mango_Recreate_Board\.git) {
  Set-Location .\Mango_Recreate_Board
  git pull origin main
} else {
  if (Test-Path .\Mango_Recreate_Board) { Remove-Item -Recurse -Force .\Mango_Recreate_Board }
  git clone https://github.com/waterstar21g-png/Mango_Recreate_Board.git Mango_Recreate_Board
  Set-Location .\Mango_Recreate_Board
}
.\start.bat
```

## 실행

- `start.bat` 또는 `run.bat` — 보드 시작
- 보드 좌측 하단 **「머지반영 업데이트」** — GitHub `main` 강제 반영 후 재시작

## GitHub

- 저장소: https://github.com/waterstar21g-png/Mango_Recreate_Board
- 기존 메인보드(`AI_Program_Main_Board`)와 **별도** 저장소입니다.
