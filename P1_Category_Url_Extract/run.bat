@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   P1 Category URL Extract
echo ========================================

where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist node_modules (
  echo [1/2] npm install ...
  call npm install --no-fund --no-audit
  if errorlevel 1 goto fail
) else (
  echo [1/2] packages OK
)

echo [2/2] collecting categories ...
call npx --yes tsx cli.ts %*
if errorlevel 1 goto fail

echo.
echo done.
pause
exit /b 0

:nonode
echo [ERROR] Node.js not found. Install from https://nodejs.org/
pause
exit /b 1

:fail
echo.
echo failed.
pause
exit /b 1
