@echo off
REM Desktop + taskbar icons (ASCII entrypoint)
cd /d "%~dp0"

if not exist "%~dp0run.bat" (
  echo [ERROR] run.bat not found in %~dp0
  pause
  exit /b 1
)

call "%~dp0아이콘새로만들기.bat"
exit /b %ERRORLEVEL%
