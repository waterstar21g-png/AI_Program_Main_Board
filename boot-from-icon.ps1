#Requires -Version 5.1
# Desktop / taskbar icon entry:
# 1) Always refresh update-if-newer.ps1 from GitHub main (no cache)
# 2) Pull only when VERSION changed
# 3) Start board via run.bat --noupdate
# ASCII-only (PS 5.1 safe)
$ErrorActionPreference = "Continue"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $Root = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $Root = $PreferredRoot
} else {
  $Root = $PreferredRoot
}

if (-not (Test-Path -LiteralPath $Root)) {
  Write-Host "[ERROR] Project folder not found: $Root" -ForegroundColor Red
  Read-Host "Press Enter"
  exit 1
}

Set-Location -LiteralPath $Root
$Repo = "waterstar21g-png/AI_Program_Main_Board"
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$updater = Join-Path $Root "update-if-newer.ps1"
$url = "https://raw.githubusercontent.com/$Repo/main/update-if-newer.ps1?t=$cb"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  icon boot"
Write-Host "  $Root"
Write-Host "========================================"
Write-Host "[BOOT] Refresh updater from GitHub main..."

try {
  Invoke-WebRequest -Uri $url -OutFile $updater -UseBasicParsing -Headers @{
    "User-Agent"    = "AI_Program_Main_Board-boot-from-icon"
    "Cache-Control" = "no-cache"
  }
  Write-Host "[OK] updater refreshed"
} catch {
  Write-Host "[WARN] Could not refresh updater: $($_.Exception.Message)" -ForegroundColor Yellow
}

if (Test-Path -LiteralPath $updater) {
  & $updater
} else {
  Write-Host "[WARN] update-if-newer.ps1 missing — start without update" -ForegroundColor Yellow
}

$runBat = Join-Path $Root "run.bat"
if (-not (Test-Path -LiteralPath $runBat)) {
  Write-Host "[ERROR] run.bat not found: $runBat" -ForegroundColor Red
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[BOOT] Starting board..."
$p = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "`"$runBat`" --noupdate") -WorkingDirectory $Root -Wait -PassThru
exit $p.ExitCode
