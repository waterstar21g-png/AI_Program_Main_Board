# 로컬 작업 경로 (고정 · 유일)

```
D:\My_Project\AI_Program_Main_Board
```

**현재 메인:** Python B안 보드 (`run.bat`) — P1 + P2(구P3), npm 없음.

## 최종 소스 받기 / 갱신 (PowerShell)

```powershell
Set-Location D:\My_Project
if (Test-Path .\AI_Program_Main_Board\.git) {
  Set-Location .\AI_Program_Main_Board
  git pull origin main
} else {
  if (Test-Path .\AI_Program_Main_Board) { Remove-Item -Recurse -Force .\AI_Program_Main_Board }
  git clone https://github.com/waterstar21g-png/AI_Program_Main_Board.git AI_Program_Main_Board
  Set-Location .\AI_Program_Main_Board
}
.\run.bat
```

## 실행 · 아이콘

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\run.bat
.\make-desktop-icon.cmd
.\pin-taskbar.cmd
```

예전 Next UI는 `legacy-next\` (사용 안 함).
