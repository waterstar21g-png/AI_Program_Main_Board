@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Mango_Recreate_Board  start
echo ========================================

if exist "%~dp0stop-board.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-board.ps1"
)

if exist "%~dp0update-if-newer.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-if-newer.ps1"
) else (
  echo [WARN] updater missing — skip version check
)

call "%~dp0run.bat" --noupdate
