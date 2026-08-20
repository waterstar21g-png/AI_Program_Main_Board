# Mango_Recreate_Board **v1.0.0** (Python UI 셸)

**최종 UI:** Python Tkinter 보드 (npm / Next.js **없음**)  
**기반:** AI_Program_Main_Board 메인 UI만 복사 · 프로그램은 추후 추가

| 프로그램 | 역할 |
|----------|------|
| *(없음)* | 좌측 사이드에 신규 프로그램 버튼으로 추가 예정 |

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
.\run.bat
```

## 실행

- `run.bat` — pip(필요 시) + 보드 시작
- `update-version.bat` / `버전갱신.bat` — GitHub main 강제 반영 후 재시작
- 보드 좌측 하단 **「머지반영 업데이트」** — 동일하게 종료 후 강제갱신·재시작

## 기존 보드와의 관계

- **AI_Program_Main_Board** — P1 / P2 / P3 등 기존 프로그램 유지
- **Mango_Recreate_Board** — 앞으로 당분간 신규 요구 작업을 이 보드에서 개발
