#Requires -Version 5.1
# Create desktop start icon -> D:\My_Project\AI_Program_Main_Board\start.bat
# start.bat updates source only when VERSION changes, then runs the board.
# ASCII-only (PS 5.1 download encoding safe)
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-desktop-icon.ps1
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$Repo = "https://github.com/waterstar21g-png/AI_Program_Main_Board.git"
$RepoRaw = "https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main"

Write-Host "========================================"
Write-Host "  Desktop icon: AI_Program_Main_Board"
Write-Host "  $PreferredRoot"
Write-Host "========================================"

function Save-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Get-RawText([string]$Url) {
  $wc = New-Object System.Net.WebClient
  $wc.Encoding = [System.Text.Encoding]::UTF8
  return $wc.DownloadString($Url)
}

if (-not (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat"))) {
  Write-Host "[INFO] Source missing. Cloning into $PreferredRoot ..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path "D:\My_Project" | Out-Null
  if (Get-Command git -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $PreferredRoot ".git")) {
      Set-Location $PreferredRoot
      git pull origin main
    } else {
      if (Test-Path $PreferredRoot) { Remove-Item -Recurse -Force $PreferredRoot }
      git clone $Repo $PreferredRoot
    }
  } else {
    $zip = Join-Path $env:TEMP "AI_Program_Main_Board-main.zip"
    $tmp = Join-Path $env:TEMP "AI_Program_Main_Board-unz"
    Invoke-WebRequest -Uri "https://github.com/waterstar21g-png/AI_Program_Main_Board/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    New-Item -ItemType Directory -Force -Path $PreferredRoot | Out-Null
    Copy-Item -Path (Join-Path $tmp "AI_Program_Main_Board-main\*") -Destination $PreferredRoot -Recurse -Force
    Remove-Item -Recurse -Force $tmp, $zip -ErrorAction SilentlyContinue
  }
}

$startBat = Join-Path $PreferredRoot "start.bat"
$runBat = Join-Path $PreferredRoot "run.bat"
$targetBat = if (Test-Path -LiteralPath $startBat) { $startBat } else { $runBat }
if (-not (Test-Path -LiteralPath $targetBat)) {
  Write-Host "[ERROR] Not found: $targetBat" -ForegroundColor Red
  exit 1
}

# Refresh create-shortcut.ps1 (UTF-8 no BOM)
try {
  $createPs1 = Join-Path $PreferredRoot "create-shortcut.ps1"
  Save-Utf8NoBom $createPs1 (Get-RawText "$RepoRaw/create-shortcut.ps1")
} catch {
  Write-Host "[WARN] Could not refresh create-shortcut.ps1 - using local if present" -ForegroundColor Yellow
}

# Create shortcut here (no nested script parse issues)
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = $targetBat
$sc.WorkingDirectory = $PreferredRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board start (update if VERSION changed)"
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$sc.Save()

Write-Host ""
Write-Host "[OK] Project : $PreferredRoot" -ForegroundColor Green
Write-Host "[OK] Shortcut: $lnkPath" -ForegroundColor Green
Write-Host "     Target  : $targetBat"
Write-Host "[DONE] Double-click desktop icon: AI_Program_Main_Board" -ForegroundColor Green
Write-Host ""
