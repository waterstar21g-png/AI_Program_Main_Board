@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Tmg Product Collector (Python)
echo ========================================

where py >nul 2>nul
if errorlevel 1 goto trypython
set "PY=py -3"
goto havepy

:trypython
where python >nul 2>nul
if errorlevel 1 goto nopython
set "PY=python"
goto havepy

:nopython
echo [ERROR] Python not found.
echo Install from https://www.python.org/downloads/
echo During setup, check the box: Add python.exe to PATH
pause
exit /b 1

:havepy
echo [1/3] checking packages ...
call %PY% -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto pipfail
goto pipok

:pipfail
echo [ERROR] pip install failed
pause
exit /b 1

:pipok
if exist ".browser.ok" goto skipbrowser
echo [2/3] installing Chromium for Playwright, first time only, may take a few minutes ...
call %PY% -m playwright install chromium
if errorlevel 1 goto browserfail
echo ok > ".browser.ok"
goto afterbrowser

:browserfail
echo [ERROR] playwright install failed
pause
exit /b 1

:skipbrowser
echo [2/3] Chromium already installed, skip

:afterbrowser
set "EXCEL=%~1"
if not "%EXCEL%"=="" goto haveexcel
echo.
echo Drag and drop the Excel file onto run.bat, or type the path below.
set /p EXCEL=Excel file path: 

:haveexcel
if exist "%EXCEL%" goto runcollect
echo [ERROR] File not found: %EXCEL%
pause
exit /b 1

:runcollect
echo [3/3] starting collection: %EXCEL%
echo.
call %PY% collect.py "%EXCEL%"

echo.
echo done. press any key to close this window.
pause >nul
