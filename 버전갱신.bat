@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   머지·버전갱신 (GitHub main 강제 반영)
echo   보드 종료 → 강제 업데이트 → 보드 재시작
echo ========================================

if exist "%~dp0stop-board.ps1" (
  echo [1/3] 보드 종료...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-board.ps1"
) else (
  echo [1/3] stop-board.ps1 없음 — 건너뜀
)

echo [2/3] GitHub main 강제 반영...
if exist "%~dp0force-update-main.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0force-update-main.ps1"
  if errorlevel 1 (
    echo [FAIL] 버전 갱신 실패
    pause
    exit /b 1
  )
) else (
  echo [ERROR] force-update-main.ps1 없음
  pause
  exit /b 1
)

echo [3/3] 보드 시작...
if exist "%~dp0run.bat" (
  call "%~dp0run.bat" --noupdate
) else (
  echo [ERROR] run.bat 없음
  pause
  exit /b 1
)

endlocal
