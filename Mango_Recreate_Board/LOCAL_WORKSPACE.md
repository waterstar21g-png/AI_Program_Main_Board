# 로컬 작업 경로 (고정 · 유일)

```
D:\My_Project\Mango_Recreate_Board
```

**현재 메인:** Python Tkinter UI 셸 — 프로그램 추가 예정.

- **직접 실행:** `run.bat`
- **강제 갱신:** `update-version.bat` / `버전갱신.bat`

## 최종 소스 받기 / 갱신 (PowerShell)

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
