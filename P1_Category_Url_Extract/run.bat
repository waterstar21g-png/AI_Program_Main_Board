@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   P1_Category_Url_Extract
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
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
) else (
  echo [1/2] dependencies OK
)

echo [2/2] crawling ...
echo.
call npx --no-install tsx cli.ts %*
set "EC=%ERRORLEVEL%"

echo.
if not "%EC%"=="0" (
  echo failed. press any key to close.
  pause >nul
  exit /b %EC%
)
echo done. press any key to close this window.
pause >nul
