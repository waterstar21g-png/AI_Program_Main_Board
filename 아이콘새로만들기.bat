@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   AI_Program_Main_Board
echo   바탕화면 + 작업표시줄 아이콘 새로 만들기
echo ========================================
echo.

if exist "%~dp0refresh-icons.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-icons.ps1"
) else (
  echo [ERROR] refresh-icons.ps1 not found
  echo git pull origin main 후 다시 실행하세요.
  pause
  exit /b 1
)

if errorlevel 1 (
  echo.
  echo [실패]
  pause
  exit /b 1
)

echo.
echo 바탕화면 아이콘을 더블클릭해 보세요.
echo 작업표시줄에 예전 아이콘이 남아 있으면 우클릭 - 작업 표시줄에서 제거 후
echo 새 바탕화면 아이콘을 작업 표시줄에 고정하세요.
echo.
pause
