#Requires -Version 5.1
# Desktop shortcut -> run.bat (ASCII-only, PS 5.1 safe)
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

$target = Join-Path $projectRoot "run.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"

$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = $target
$sc.WorkingDirectory = $projectRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board start"
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$sc.Save()

Write-Host ""
Write-Host "[OK] Project : $projectRoot" -ForegroundColor Green
Write-Host "[OK] Shortcut: $lnkPath" -ForegroundColor Green
Write-Host "     Target  : $target"
Write-Host "[DONE] Double-click desktop icon: AI_Program_Main_Board" -ForegroundColor Green
Write-Host ""
