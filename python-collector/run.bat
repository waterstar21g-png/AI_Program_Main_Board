@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Tmg Product Collector (Python)
echo ========================================

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py -3"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "PY=python"
  ) else (
    echo [ERROR] Python not found. Install from https://www.python.org/downloads/
    echo         (setup screen: check "Add python.exe to PATH")
    pause
    exit /b 1
  )
)

echo [1/3] checking packages ...
%PY% -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed
  pause
  exit /b 1
)

if not exist ".browser.ok" (
  echo [2/3] installing Chromium for Playwright (first time only, may take a few minutes) ...
  %PY% -m playwright install chromium
  if errorlevel 1 (
    echo [ERROR] playwright install failed
    pause
    exit /b 1
  )
  echo ok > ".browser.ok"
) else (
  echo [2/3] Chromium already installed, skip
)

set "EXCEL=%~1"
if "%EXCEL%"=="" (
  echo.
  echo Drag and drop the Excel file onto run.bat, or type the path below.
  set /p EXCEL="Excel file path: "
)

if not exist "%EXCEL%" (
  echo [ERROR] File not found: %EXCEL%
  pause
  exit /b 1
)

echo [3/3] starting collection: %EXCEL%
echo.
%PY% collect.py "%EXCEL%"

echo.
echo done. press any key to close this window.
pause >nul
