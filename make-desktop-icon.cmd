@echo off
REM Desktop + taskbar icons -> start.bat (stop+update+restart chain)
cd /d "%~dp0"

if not exist "%~dp0run.bat" (
  echo [ERROR] run.bat not found in %~dp0
  pause
  exit /b 1
)

if exist "%~dp0refresh-icons.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-icons.ps1"
) else if exist "%~dp0create-shortcut.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
  if exist "%~dp0pin-taskbar.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pin-taskbar.ps1"
  )
) else (
  echo [ERROR] refresh-icons.ps1 missing — git pull origin main
  pause
  exit /b 1
)

if errorlevel 1 (
  echo [FAIL]
  pause
  exit /b 1
)

echo [OK] Icons refreshed.
pause
