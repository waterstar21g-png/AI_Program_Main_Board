#Requires -Version 5.1
# Desktop + taskbar shortcuts (wrapper -> refresh-icons.ps1)
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
if (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $projectRoot = $PreferredRoot
} elseif ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $projectRoot = $PSScriptRoot
} else {
  Write-Host "[ERROR] run.bat not found." -ForegroundColor Red
  exit 1
}

$refresh = Join-Path $projectRoot "refresh-icons.ps1"
if (Test-Path -LiteralPath $refresh) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $refresh
  exit $LASTEXITCODE
}

Write-Host "[WARN] refresh-icons.ps1 missing — legacy single desktop shortcut" -ForegroundColor Yellow
# legacy fallback (desktop only)
$bootPs1 = Join-Path $projectRoot "boot-from-icon.ps1"
$startBat = Join-Path $projectRoot "start.bat"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
if (Test-Path -LiteralPath $startBat) {
  $sc.TargetPath = $startBat
} elseif (Test-Path -LiteralPath $bootPs1) {
  $sc.TargetPath = $psExe
  $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$bootPs1`""
} else {
  $sc.TargetPath = Join-Path $projectRoot "run.bat"
}
$sc.WorkingDirectory = $projectRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board"
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,16"
$sc.Save()
Write-Host "[OK] $lnkPath"
exit 0
