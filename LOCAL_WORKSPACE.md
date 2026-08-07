# 로컬 작업 경로 (고정 · 유일)

```
D:\My_Project\AI_Program_Main_Board
```

**현재 메인:** Python B안 보드 — P1 + P2(구P3), npm 없음.

- **아이콘:** `boot-from-icon.ps1` (VERSION 변경 시에만 `git pull` 후 보드)
- **직접 실행:** `run.bat` (동일하게 VERSION 변경 시에만 pull)

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
.\make-desktop-icon.cmd
.\start.bat
```

## 실행 · 아이콘

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\make-desktop-icon.cmd
.\pin-taskbar.cmd
.\start.bat
```

예전 Next UI는 `legacy-next\` (사용 안 함).
