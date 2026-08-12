@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   AI_Program_Main_Board
echo   Create desktop + taskbar icons
echo ========================================
echo.
echo Project: %CD%
echo.

set ERR=1

if exist "%~dp0refresh-icons.ps1" (
  echo [1/2] refresh-icons.ps1 ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-icons.ps1"
  set ERR=%ERRORLEVEL%
) else (
  echo [WARN] refresh-icons.ps1 missing
  set ERR=1
)

if %ERR% NEQ 0 (
  echo.
  echo [2/2] fallback create-icons.vbs ...
  if exist "%~dp0create-icons.vbs" (
    cscript //nologo "%~dp0create-icons.vbs"
    set ERR=%ERRORLEVEL%
  ) else (
    echo [ERROR] create-icons.vbs missing
    set ERR=1
  )
)

echo.
if exist "%~dp0icon-last.log" (
  echo --- icon-last.log ---
  type "%~dp0icon-last.log"
  echo --------------------
  echo.
)

if %ERR% NEQ 0 (
  echo [FAIL] Icon creation failed.
  echo If Desktop is blocked, use .lnk files inside this project folder
  echo and drag them to Desktop.
  pause
  exit /b 1
)

echo [OK] Icons ready.
echo   Desktop: AI_Program_Main_Board
echo   Desktop: AI_Board_Update  (or Korean update name)
echo   Tip: if not visible, open this folder and drag the .lnk to Desktop.
echo.
pause
