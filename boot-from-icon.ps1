#Requires -Version 5.1
# Desktop / taskbar icon entry (single chain) - NO manual pull needed:
#   1) Stop previous board (if running)
#   2) update-if-newer.ps1 when VERSION on GitHub main differs:
#        - git pull origin main (reset --hard on failure)
#        - if git still incomplete -> ZIP overwrite (codeload)
#      Do NOT re-add per-file raw.githubusercontent.com downloads
#      (that caused the 404 warning wall; removed in v2.0.58).
#   3) run.bat --noupdate    -> pip + board restart
# ASCII-only (PS 5.1 safe)
$ErrorActionPreference = "Continue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}

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

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  icon boot"
Write-Host "  $Root"
Write-Host "========================================"

function Get-VersionLabel {
  $p = Join-Path $Root "VERSION.txt"
  if (-not (Test-Path -LiteralPath $p)) { return "?" }
  try {
    $raw = Get-Content -LiteralPath $p -Raw -ErrorAction Stop
    if ($raw -match '(?m)(?:버전|version)\s*([0-9]+(?:\.[0-9]+)+)') {
      return $Matches[1]
    }
    if ($raw -match '([0-9]+\.[0-9]+\.[0-9]+)') {
      return $Matches[1]
    }
  } catch {}
  return "?"
}

# 1) Stop previous board so restart always loads updated source (step 1)
$stopScript = Join-Path $Root "stop-board.ps1"
if (Test-Path -LiteralPath $stopScript) {
  Write-Host "[BOOT] Stopping previous board (if any)..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $stopScript
} else {
  Write-Host "[WARN] stop-board.ps1 missing — skip stop" -ForegroundColor Yellow
}

$beforeVer = Get-VersionLabel
Write-Host "[BOOT] Local VERSION (before update) = $beforeVer"

# 2) Version check + git pull origin main when remote VERSION is newer
$updater = Join-Path $Root "update-if-newer.ps1"
$updateExit = 0
if (Test-Path -LiteralPath $updater) {
  Write-Host "[BOOT] Running update-if-newer.ps1 ..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $updater
  $updateExit = $LASTEXITCODE
  if ($null -eq $updateExit) { $updateExit = 0 }
} else {
  Write-Host "[WARN] update-if-newer.ps1 missing — skip update" -ForegroundColor Yellow
}

$afterVer = Get-VersionLabel
Write-Host "[BOOT] Local VERSION (after update)  = $afterVer"

if ($updateExit -eq 2) {
  Write-Host "[BOOT] Auto-updated ($beforeVer -> $afterVer) — no manual pull needed" -ForegroundColor Green
} elseif ($beforeVer -eq $afterVer) {
  Write-Host "[BOOT] Already up to date (VERSION $afterVer)" -ForegroundColor Cyan
} else {
  Write-Host "[BOOT] Update attempted (exit=$updateExit) local=$afterVer" -ForegroundColor Yellow
}

# 3) Start board (pip + python board\app.py) — no duplicate update pass
$runBat = Join-Path $Root "run.bat"
if (-not (Test-Path -LiteralPath $runBat)) {
  Write-Host "[ERROR] run.bat not found: $runBat" -ForegroundColor Red
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[BOOT] Starting board (run.bat --noupdate)..."
& cmd.exe /c "`"$runBat`" --noupdate"
exit $LASTEXITCODE
