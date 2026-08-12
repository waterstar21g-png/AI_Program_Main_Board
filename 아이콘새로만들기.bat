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

echo [OK] Icons ready (Desktop + Taskbar).
echo   1) AI_Program_Main_Board   = main board
echo   2) AI_Board_Update / Korean update name = version update shortcut
echo   Both are copied to the Taskbar pin folder.
echo   Tip: if taskbar icon missing, right-click desktop icon -^> Pin to taskbar.
echo.
pause
