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

if not exist "node_modules\tsx" (
  echo [1/2] npm install ...
  call npm install
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
if not "%EXCEL%"=="" goto run
echo.
echo Drag and drop the Excel file onto run.bat, or type the path below.

:run
echo [2/2] starting collection ...
echo (uses your own Chrome or Edge - CDP port 9222)
echo.
if "%EXCEL%"=="" (
  call npx --yes tsx cli.ts
) else if "%SAVECOUNT%"=="" (
  call npx --yes tsx cli.ts "%EXCEL%"
) else (
  call npx --yes tsx cli.ts "%EXCEL%" "%SAVECOUNT%"
)
set "EC=%ERRORLEVEL%"

echo.
if not "%EC%"=="0" (
  echo failed. exit=%EC%
  pause
  exit /b %EC%
)
echo done. press any key to close.
pause >nul
