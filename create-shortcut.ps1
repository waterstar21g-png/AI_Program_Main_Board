#Requires -Version 5.1
# Desktop shortcut -> boot-from-icon.ps1 (version-aware update + board)
# ASCII-only, PS 5.1 safe
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"

if (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $projectRoot = $PreferredRoot
} elseif ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $projectRoot = $PSScriptRoot
} else {
  Write-Host "[ERROR] run.bat not found." -ForegroundColor Red
  Write-Host "  Expected: $PreferredRoot"
  exit 1
}

$bootPs1 = Join-Path $projectRoot "boot-from-icon.ps1"
$startBat = Join-Path $projectRoot "start.bat"
$runBat = Join-Path $projectRoot "run.bat"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"

$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)

if (Test-Path -LiteralPath $bootPs1) {
  $sc.TargetPath = $psExe
  $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$bootPs1`""
  $descTarget = $bootPs1
} elseif (Test-Path -LiteralPath $startBat) {
  $sc.TargetPath = $startBat
  $sc.Arguments = ""
  $descTarget = $startBat
} else {
  $sc.TargetPath = $runBat
  $sc.Arguments = ""
  $descTarget = $runBat
}

$sc.WorkingDirectory = $projectRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board (stop+update+restart on click)"
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$sc.Save()

Write-Host ""
Write-Host "[OK] Project : $projectRoot" -ForegroundColor Green
Write-Host "[OK] Shortcut: $lnkPath" -ForegroundColor Green
Write-Host "     Target  : $descTarget"
Write-Host "[DONE] Double-click desktop icon: AI_Program_Main_Board" -ForegroundColor Green
Write-Host ""
