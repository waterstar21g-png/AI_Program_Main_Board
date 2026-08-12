@echo off
chcp 65001 >nul
cd /d "%~dp0"
title AI Board Force Update
echo.
echo ========================================
echo   AI Board - Force Update from GitHub
echo ========================================
echo.
echo Project: %CD%
if exist "VERSION.txt" (
  set /p CURVER=<VERSION.txt
  echo Current VERSION.txt: %CURVER%
) else (
  echo Current VERSION.txt: (none)
)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0force-update-main.ps1"
set ERR=%ERRORLEVEL%
echo.
if exist "VERSION.txt" (
  set /p NEWVER=<VERSION.txt
  echo VERSION.txt after update: %NEWVER%
)
if exist "update-last.log" (
  echo.
  echo --- update-last.log ---
  type "update-last.log"
  echo -----------------------
)
echo.
if %ERR% NEQ 0 (
  echo UPDATE FAILED. See update-last.log in project folder.
  pause
  exit /b %ERR%
)
echo UPDATE OK. Starting board...
timeout /t 2 /nobreak >nul
call "%~dp0run.bat"
