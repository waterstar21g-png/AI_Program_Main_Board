@echo off
setlocal
cd /d "%~dp0"

echo [BOOT] GitHub API로 run.ps1 강제 갱신 (CDN 우회)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$h=@{ Accept='application/vnd.github.raw'; 'User-Agent'='run.bat'; 'Cache-Control'='no-cache' };" ^
  "$cb=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();" ^
  "Invoke-WebRequest -Uri \"https://api.github.com/repos/waterstar21g-png/sangpum-capture-price/contents/run.ps1?ref=main&t=$cb\" -Headers $h -OutFile 'run.ps1' -UseBasicParsing;" ^
  "Write-Host '[BOOT] run.ps1 OK (GitHub API)'"

if errorlevel 1 (
  echo [WARN] API 동기화 실패 — 기존 run.ps1으로 실행
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
pause
