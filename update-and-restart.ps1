#Requires -Version 5.1
# Called FROM the running board "머지반영 업데이트" button:
#   1) wait for board PID to exit (files unlocked)
#   2) force-update-main.ps1
#   3) start board (run.bat --noupdate)
# ASCII-only (PS 5.1 safe)
param(
  [int]$WaitPid = 0,
  [switch]$NoStart
)

$ErrorActionPreference = "Continue"
$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $Root = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $Root = $PreferredRoot
} else {
  $Root = if ($PSScriptRoot) { $PSScriptRoot } else { $PreferredRoot }
}
Set-Location -LiteralPath $Root

Write-Host "========================================"
Write-Host "  UPDATE + RESTART board"
Write-Host "  WaitPid=$WaitPid  Root=$Root"
Write-Host "========================================"

if ($WaitPid -gt 0) {
  Write-Host "[WAIT] board pid=$WaitPid exit..."
  try {
    $p = Get-Process -Id $WaitPid -ErrorAction SilentlyContinue
    if ($p) {
      Wait-Process -Id $WaitPid -Timeout 60 -ErrorAction SilentlyContinue
    }
  } catch {}
  # extra settle for Windows file locks
  Start-Sleep -Seconds 2
}

# Also stop any leftover board processes
$stop = Join-Path $Root "stop-board.ps1"
if (Test-Path -LiteralPath $stop) {
  Write-Host "[STOP] leftover board"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $stop
  Start-Sleep -Milliseconds 800
}

$force = Join-Path $Root "force-update-main.ps1"
if (-not (Test-Path -LiteralPath $force)) {
  Write-Host "[ERROR] force-update-main.ps1 missing"
  if (-not $NoStart) { Read-Host "Press Enter" }
  exit 1
}

Write-Host "[UPDATE] force-update-main.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $force
$code = $LASTEXITCODE
Write-Host "[UPDATE] exit=$code"

if ($NoStart) {
  exit $code
}

$runBat = Join-Path $Root "run.bat"
Write-Host "[START] run.bat --noupdate"
if (Test-Path -LiteralPath $runBat) {
  Start-Process -FilePath $runBat -ArgumentList "--noupdate" -WorkingDirectory $Root
} else {
  Write-Host "[ERROR] run.bat missing"
  exit 1
}
exit $code
