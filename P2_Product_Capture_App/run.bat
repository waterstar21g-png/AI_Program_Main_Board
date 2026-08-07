@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   P2 Product Capture (Node/Playwright)
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

set "EXCEL=%~1"
if not "%EXCEL%"=="" goto run
if "%~2"=="--open-only" goto run
if "%~1"=="--open-only" goto run
if "%~1"=="--open" goto run

echo.
echo Drag Excel onto run.bat, or type path below.
echo   --open-only  = open browser for login only
set /p EXCEL=Excel path (or --open-only): 

:run
echo [2/2] starting ...
if "%EXCEL%"=="" (
  call npx --yes tsx cli.ts %*
) else (
  call npx --yes tsx cli.ts "%EXCEL%" %*
)
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
