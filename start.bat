@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   AI_Program_Main_Board  start
echo   (auto-update ONLY if VERSION changed)
echo ========================================

if exist "%~dp0boot-from-icon.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0boot-from-icon.ps1"
  exit /b %ERRORLEVEL%
)

if exist "%~dp0update-if-newer.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-if-newer.ps1"
) else (
  echo [WARN] updater missing — skip version check
)

call "%~dp0run.bat" --noupdate
