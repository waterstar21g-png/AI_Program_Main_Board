@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   AI_Program_Main_Board_New  (Python)
echo   P1 카테고리URL  /  P2 더망고수집
echo ========================================

where py >nul 2>nul
if errorlevel 1 goto trypython
set "PY=py -3"
goto havepy

:trypython
where python >nul 2>nul
if errorlevel 1 goto trypython3
set "PY=python"
goto havepy

:trypython3
where python3 >nul 2>nul
if errorlevel 1 goto nopython
set "PY=python3"
goto havepy

:nopython
echo [ERROR] Python not found.
echo https://www.python.org/downloads/
echo Install with: Add python.exe to PATH
pause
exit /b 1

:havepy
echo [1/2] pip install ...
call %PY% -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed
  pause
  exit /b 1
)

echo [2/2] board start
call %PY% board\app.py
if errorlevel 1 pause
