@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   P2_Product_Capture_App
echo   더망고 대량수집 (Playwright 배치)
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
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
) else (
  echo [1/2] dependencies ok
)

set "EXCEL=%~1"
set "SAVECOUNT=%~2"
if "%EXCEL%"=="" goto prompt
goto run

:prompt
echo.
echo Drag and drop the Excel file onto run.bat, or type the path below.
set /p EXCEL=Excel file path: 

:run
if not exist "%EXCEL%" (
  echo [ERROR] File not found: %EXCEL%
  pause
  exit /b 1
)

echo [2/2] starting: %EXCEL%
echo (uses your Chrome/Edge via CDP — no separate Chromium download)
echo.
if "%SAVECOUNT%"=="" (
  call npx --yes tsx cli.ts "%EXCEL%"
) else (
  call npx --yes tsx cli.ts "%EXCEL%" %SAVECOUNT%
)

echo.
echo done. press any key to close.
pause >nul
