# Clone/pull into D:\My_Project\AI_Program_Main_Board then start Python B board
$ErrorActionPreference = "Stop"
$Root = "D:\My_Project"
$Dest = Join-Path $Root "AI_Program_Main_Board"
$Repo = "https://github.com/waterstar21g-png/AI_Program_Main_Board.git"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board (Python B) -> $Dest"
Write-Host "========================================"

New-Item -ItemType Directory -Force -Path $Root | Out-Null
Remove-Item -Recurse -Force (Join-Path $Root "AI_Program_Main_Board_New") -ErrorAction SilentlyContinue

if (Get-Command git -ErrorAction SilentlyContinue) {
  if (Test-Path (Join-Path $Dest ".git")) {
    Set-Location $Dest
    git pull origin main
  } else {
    if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
    git clone $Repo $Dest
    Set-Location $Dest
  }
} else {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Set-Location $Dest
  $zip = Join-Path $Dest "main.zip"
  $tmp = Join-Path $Dest "_tmp"
  Invoke-WebRequest -Uri "https://github.com/waterstar21g-png/AI_Program_Main_Board/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Copy-Item -Path (Join-Path $tmp "AI_Program_Main_Board-main\*") -Destination $Dest -Recurse -Force
  Remove-Item -Recurse -Force $tmp, $zip -ErrorAction SilentlyContinue
}

Write-Host "[OK] $Dest" -ForegroundColor Green
Write-Host "Start: .\run.bat  (Python B board P1/P2)"
$ans = Read-Host "Run board now? (Y/N)"
if ($ans -match '^[Yy]') { & .\run.bat }
