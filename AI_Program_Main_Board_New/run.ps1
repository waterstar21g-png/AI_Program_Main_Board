# AI_Program_Main_Board_New — 로컬 실행 (포트 3001)
# 기존 AI_Program_Main_Board(3000)와 별도
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$ExpectedVersion = "1.0.0"
$Port = if ($env:PORT) { [int]$env:PORT } else { 3001 }

Write-Host "=== AI_Program_Main_Board_New v$ExpectedVersion ===" -ForegroundColor Cyan
Write-Host "포트: $Port (기존 보드는 3000)" -ForegroundColor DarkGray

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js 없음 — https://nodejs.org" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "node_modules\next")) {
  Write-Host "[npm] install..." -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$env:PORT = "$Port"
$env:NEXT_TELEMETRY_DISABLED = "1"
Write-Host "[dev] http://localhost:$Port" -ForegroundColor Green
npm run dev
