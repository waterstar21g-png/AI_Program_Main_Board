@echo off
REM Pin D:\My_Project\AI_Program_Main_Board to the taskbar
cd /d "D:\My_Project\AI_Program_Main_Board"
if not exist "%~dp0pin-taskbar.ps1" (
  echo [ERROR] pin-taskbar.ps1 missing in this folder
  echo Run: git pull origin main
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pin-taskbar.ps1"
if errorlevel 1 (
  echo [FAIL]
  pause
  exit /b 1
)
pause
