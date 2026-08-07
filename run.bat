@echo off
setlocal
cd /d "%~dp0"

REM Icon / direct start: update only when VERSION changed, then re-exec board.
if /i "%~1"=="--noupdate" goto board

echo ========================================
echo   AI_Program_Main_Board  update+run
echo   (git pull ONLY if VERSION changed)
echo ========================================

REM Always refresh updater from GitHub main first (avoid stale local script
REM that still had: git pull ... 2^>^&1 ^| Out-Host  -^> red NativeCommandError)
echo [INFO] Refreshing update-if-newer.ps1 from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $cb=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/update-if-newer.ps1?t='+$cb) -OutFile '%~dp0update-if-newer.ps1' -UseBasicParsing -Headers @{'Cache-Control'='no-cache';'User-Agent'='AI_Program_Main_Board-runbat'}; Write-Host '[OK] updater refreshed' } catch { Write-Host ('[WARN] updater refresh failed: ' + $_.Exception.Message) }"

if exist "%~dp0update-if-newer.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-if-newer.ps1"
) else (
  echo [WARN] update-if-newer.ps1 missing — start without update
)

REM Re-exec this file after possible pull so new run.bat is used
call "%~f0" --noupdate
exit /b %ERRORLEVEL%

:board
echo ========================================
echo   AI_Program_Main_Board  (Python B)
echo   P1 카테고리URL  /  P2 더망고수집(구P3)
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
