#Requires -Version 5.1
# Pin AI_Program_Main_Board to taskbar (wrapper -> refresh-icons.ps1)
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
if (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $projectRoot = $PreferredRoot
} elseif ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $projectRoot = $PSScriptRoot
} else {
  Write-Host "[ERROR] Not found: $PreferredRoot\run.bat" -ForegroundColor Red
  exit 1
}

$refresh = Join-Path $projectRoot "refresh-icons.ps1"
if (Test-Path -LiteralPath $refresh) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $refresh
  exit $LASTEXITCODE
}

Write-Host "[ERROR] refresh-icons.ps1 missing — run git pull origin main" -ForegroundColor Red
exit 1
