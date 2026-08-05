@echo off
chcp 65001 >nul
title AI_Program_Main_Board

cd /d "%~dp0"

echo ========================================
echo   AI_Program_Main_Board - 로컬 실행
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js가 없습니다.
  echo https://nodejs.org 에서 LTS 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

echo [환경] Node.js
node -v
npm -v
echo.

if not exist "node_modules\" (
  echo [설치] npm 패키지 설치 중...
  call npm install
  if errorlevel 1 (
    echo [오류] npm install 실패
    pause
    exit /b 1
  )
  echo.
)

if not exist ".local\playwright-chromium.ok" (
  echo [설치] Playwright Chromium ^(상품데이터수집^)...
  if not exist ".local\" mkdir ".local"
  call npx playwright install chromium
  if errorlevel 1 (
    echo [경고] Chromium 설치 실패. 상품데이터수집 전에 수동 실행:
    echo   npx playwright install chromium
  ) else (
    echo ok> ".local\playwright-chromium.ok"
  )
  echo.
)

echo ========================================
echo   http://localhost:3000
echo   종료: 이 창에서 Ctrl+C
echo ========================================
echo.

start "" "http://localhost:3000"
call npm run dev:fast

pause
