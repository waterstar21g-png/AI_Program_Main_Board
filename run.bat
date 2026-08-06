@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo [BOOT] Force download latest run.ps1 from GitHub main...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$h=@{ Accept='application/vnd.github.raw'; 'User-Agent'='run.bat'; 'Cache-Control'='no-cache' };" ^
  "$cb=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();" ^
  "Invoke-WebRequest -Uri \"https://api.github.com/repos/waterstar21g-png/sangpum-capture-price/contents/run.ps1?ref=main&t=$cb\" -Headers $h -OutFile 'run.ps1' -UseBasicParsing;" ^
  "$t=Get-Content run.ps1 -Raw;" ^
  "if ($t -notmatch 'ExpectedVersion\s*=\s*\"2\.2\.6\"') { throw 'run.ps1 is not v2.2.6 — sync failed' };" ^
  "Write-Host '[BOOT] run.ps1 OK v2.2.6'"

if errorlevel 1 (
  echo [FATAL] Could not download run.ps1 v2.2.6
  echo Paste this in PowerShell:
  echo irm https://api.github.com/repos/waterstar21g-png/sangpum-capture-price/contents/run.ps1?ref=main -Headers @{Accept='application/vnd.github.raw';'User-Agent'='x'} -OutFile run.ps1; .\run.bat
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
pause
