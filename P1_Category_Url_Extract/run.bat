@echo off
chcp 65001 >nul
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

if not exist "node_modules\cheerio" (
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

echo [2/2] running crawl ...
echo.
call node cli.mjs %*
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo failed. press any key.
  pause >nul
  exit /b %ERR%
)
echo done. press any key to close.
pause >nul
