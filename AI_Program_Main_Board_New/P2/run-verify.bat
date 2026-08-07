@echo off
setlocal
cd /d "%~dp0"
REM 1행×3상품 검증 모드 — 단계 스크린샷 + 같은 행 재시도
if "%~1"=="" (
  echo Usage: run-verify.bat excel.xlsx
  echo Or drag excel onto this bat.
  pause
  exit /b 1
)
call "%~dp0run.bat" "%~1" --verify
