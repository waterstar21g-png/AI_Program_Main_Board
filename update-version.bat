@echo off
REM ASCII alias -> 버전갱신.bat
cd /d "%~dp0"
if exist "%~dp0버전갱신.bat" (
  call "%~dp0버전갱신.bat" %*
  exit /b %ERRORLEVEL%
)
REM fallback if Korean filename missing
if exist "%~dp0stop-board.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-board.ps1"
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0force-update-main.ps1"
if errorlevel 1 ( pause & exit /b 1 )
call "%~dp0run.bat" --noupdate
