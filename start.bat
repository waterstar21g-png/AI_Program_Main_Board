@echo off
chcp 65001 >nul
title AI_Program_Main_Board

cd /d "%~dp0"

if not exist "node_modules\" (
  echo [설치] 최초 1회 패키지 설치 중...
  call npm install
  if errorlevel 1 (
    echo [오류] npm install 실패. Node.js LTS 설치 후 다시 실행하세요.
    pause
    exit /b 1
  )
)

echo.
echo ========================================
echo   AI_Program_Main_Board
echo   http://localhost:3000
echo   종료: 이 창에서 Ctrl+C
echo ========================================
echo.

start "" "http://localhost:3000"
call npm run dev:fast
