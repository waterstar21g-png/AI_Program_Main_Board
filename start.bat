@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   AI_Program_Main_Board  start
echo   (icon chain: stop -^> update -^> board)
echo ========================================

if exist "%~dp0boot-from-icon.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0boot-from-icon.ps1"
  exit /b %ERRORLEVEL%
)

if exist "%~dp0stop-board.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-board.ps1"
)

if exist "%~dp0update-if-newer.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-if-newer.ps1"
) else (
  echo [WARN] updater missing — skip version check
)

call "%~dp0run.bat" --noupdate
