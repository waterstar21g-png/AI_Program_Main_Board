@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   P1_Category_Url_Extract
echo   카테고리 URL 엑셀 추출 (배치)
echo ========================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\cheerio" (
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

echo [2/2] running ...
echo.
if "%~1"=="" (
  call node cli.mjs
) else (
  call node cli.mjs %*
)

echo.
echo done. press any key to close.
pause >nul
