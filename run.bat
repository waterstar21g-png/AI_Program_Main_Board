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
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls } catch {}; $cb=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $done=$false; foreach ($u in @('https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/update-if-newer.ps1?t='+$cb, 'https://cdn.jsdelivr.net/gh/waterstar21g-png/AI_Program_Main_Board@main/update-if-newer.ps1?t='+$cb)) { try { Invoke-WebRequest -Uri $u -OutFile '%~dp0update-if-newer.ps1' -UseBasicParsing -TimeoutSec 15 -Headers @{'Cache-Control'='no-cache';'User-Agent'='AI_Program_Main_Board-runbat'}; Write-Host '[OK] updater refreshed'; $done=$true; break } catch { $lastErr = $_.Exception.Message } }; if (-not $done) { Write-Host ('[WARN] updater refresh failed (local copy used): ' + $lastErr) }"

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

if exist "%~dp0stop-board.ps1" (
  echo [INFO] Ensuring no duplicate board process...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-board.ps1"
)

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
