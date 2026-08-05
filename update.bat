@echo off
chcp 65001 >nul
title AI_Program_Main_Board - 업데이트

cd /d "%~dp0"

echo ========================================
echo   AI_Program_Main_Board - 파일 업데이트
echo ========================================
echo.
echo [폴더] %CD%
echo.

where git >nul 2>&1
if not errorlevel 1 (
  if exist ".git\" (
    echo [Git] 최신 소스 받는 중...
    git pull origin main
    if not errorlevel 1 (
      if exist ".next\" rmdir /s /q ".next"
      echo.
      echo [완료] git pull 성공. 캐시 삭제 후 run.bat 실행:
      echo   .\run.bat
      echo.
      pause
      exit /b 0
    )
    echo [경고] git pull 실패 — run.bat 직접 다운로드 시도...
    echo.
  )
)

where curl >nul 2>&1
if errorlevel 1 (
  echo [오류] git pull 불가, curl 도 없습니다.
  echo.
  echo 수동 조치:
  echo   1. GitHub에서 최신 ZIP 받아 이 폴더에 덮어쓰기
  echo   2. 또는 start.bat / npm run dev:fast 로 실행
  echo.
  pause
  exit /b 1
)

echo [다운로드] run.bat, start.bat ...
curl -fsSL -o "run.bat" "https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main/run.bat"
curl -fsSL -o "start.bat" "https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main/start.bat"

if exist "run.bat" (
  echo [완료] run.bat 저장됨
  echo   .\run.bat
) else (
  echo [오류] run.bat 다운로드 실패
)

echo.
pause
