@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   P2_Product_Capture_App
echo ========================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\playwright" (
  echo [1/2] npm install ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
) else (
  echo [1/2] dependencies OK
)

set "EXCEL=%~1"
if not "%EXCEL%"=="" goto haveexcel
echo.
echo Drag and drop the Excel file onto run.bat, or type the path below.
set /p EXCEL=Excel file path: 

:haveexcel
if exist "%EXCEL%" goto runcollect
echo [ERROR] File not found: %EXCEL%
pause
exit /b 1

:runcollect
echo [2/2] starting collection: %EXCEL%
echo (uses your own Chrome or Edge via CDP)
echo.
call npx --yes tsx cli.ts "%EXCEL%" %2
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo failed. press any key.
  pause >nul
  exit /b %ERR%
)
echo done. press any key to close.
pause >nul
