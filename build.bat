@echo off
chcp 65001 >nul
title AI_Program_Main_Board - 빌드

cd /d "%~dp0"

if not exist "node_modules\" call npm install

echo [빌드] 프로덕션 빌드 중... (1~2분)
call npm run build
if errorlevel 1 (
  echo [오류] 빌드 실패
  pause
  exit /b 1
)

echo.
echo 빌드 완료. start-prod.bat 으로 실행하세요.
pause
