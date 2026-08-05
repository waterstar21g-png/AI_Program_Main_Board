@echo off
chcp 65001 >nul
title AI_Program_Main_Board (로컬 프로덕션)

cd /d "%~dp0"

if not exist ".next\BUILD_ID" (
  echo [빌드 없음] build.bat 을 먼저 실행하세요.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   AI_Program_Main_Board (로컬 프로덕션)
echo   http://localhost:3000
echo   종료: Ctrl+C
echo ========================================
echo.

start "" "http://localhost:3000"
call npm run local:start
