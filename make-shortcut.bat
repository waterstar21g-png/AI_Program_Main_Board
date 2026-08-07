@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [AI_Program_Main_Board] 바탕화면 시작 아이콘 생성...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
if errorlevel 1 (
  echo [실패] create-shortcut.ps1
  pause
  exit /b 1
)
echo.
echo 바탕화면: AI_Program_Main_Board.lnk
pause
