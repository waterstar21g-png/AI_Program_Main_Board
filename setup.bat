@echo off
chcp 65001 >nul
title AI_Program_Main_Board - 설치

echo ========================================
echo   AI_Program_Main_Board - Windows 설치
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js가 없습니다.
  echo https://nodejs.org 에서 LTS 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

echo [1/4] Node.js OK
node -v
npm -v
echo.

echo [2/4] 패키지 설치...
call npm install
if errorlevel 1 (
  echo [오류] npm install 실패
  pause
  exit /b 1
)

echo.
echo [3/4] Playwright Chromium (상품데이터수집용)...
call npx playwright install chromium
if errorlevel 1 (
  echo [경고] Playwright Chromium 설치 실패 — 상품데이터수집 실행 전 수동 설치:
  echo   npx playwright install chromium
)

echo.
echo [4/4] 환경파일 (선택)
if not exist ".env.local" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env.local" >nul
    echo .env.local 생성됨. 상품캡처 기능만 API 키 필요.
    echo 카테고리 URL 추출은 키 없이 동작합니다.
  )
) else (
  echo .env.local 이미 있음.
)

echo.
echo 설치 완료. start.bat 더블클릭으로 실행하세요.
echo.
pause
