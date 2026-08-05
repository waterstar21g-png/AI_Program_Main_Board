@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "fix-board.bat" (
  call "%~dp0fix-board.bat"
) else (
  echo fix-board.bat 이 없습니다. GitHub 에서 최신 폴더를 받으세요.
  pause
)
