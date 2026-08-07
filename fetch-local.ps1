# 모든 프로그램을 D:\My_Project\AI_Program_Main_Board 에 받습니다. (PowerShell)
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File .\fetch-local.ps1
$ErrorActionPreference = "Stop"
$Root = "D:\My_Project"
$Dest = Join-Path $Root "AI_Program_Main_Board"
$Repo = "https://github.com/waterstar21g-png/AI_Program_Main_Board.git"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  →  $Dest"
Write-Host "========================================"

New-Item -ItemType Directory -Force -Path $Root | Out-Null

# 잘못된 위치(루트 바로 아래 New) 안내
$WrongNew = Join-Path $Root "AI_Program_Main_Board_New"
if (Test-Path $WrongNew) {
  Write-Host "[안내] 잘못된 위치 발견: $WrongNew" -ForegroundColor Yellow
  Write-Host "  올바른 위치는 $Dest\AI_Program_Main_Board_New 입니다." -ForegroundColor Yellow
}

if (Get-Command git -ErrorAction SilentlyContinue) {
  if (Test-Path (Join-Path $Dest ".git")) {
    Write-Host "[GIT] pull origin main ..."
    Set-Location $Dest
    git pull origin main
  } else {
    if (Test-Path $Dest) {
      Write-Host "[GIT] 기존 폴더를 비우고 clone 합니다..."
      Remove-Item -Recurse -Force $Dest
    }
    Write-Host "[GIT] clone → $Dest"
    git clone $Repo $Dest
    Set-Location $Dest
  }
} else {
  Write-Host "[ZIP] Git 없음 — ZIP으로 받습니다..."
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Set-Location $Dest
  $zip = Join-Path $Dest "main.zip"
  $tmp = Join-Path $Dest "_tmp"
  Invoke-WebRequest -Uri "https://github.com/waterstar21g-png/AI_Program_Main_Board/archive/refs/heads/main.zip" -OutFile $zip
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Copy-Item -Path (Join-Path $tmp "AI_Program_Main_Board-main\*") -Destination $Dest -Recurse -Force
  Remove-Item -Recurse -Force $tmp, $zip
}

Write-Host ""
Write-Host "[OK] 받은 위치: $Dest" -ForegroundColor Green
Write-Host "  New 보드: $Dest\AI_Program_Main_Board_New"
Write-Host "  실행: Set-Location '$Dest\AI_Program_Main_Board_New'; .\run.bat"
Write-Host ""
$newBat = Join-Path $Dest "AI_Program_Main_Board_New\run.bat"
if (Test-Path $newBat) {
  $ans = Read-Host "New 보드를 지금 실행할까요? (Y/N)"
  if ($ans -match '^[Yy]') {
    Set-Location (Join-Path $Dest "AI_Program_Main_Board_New")
    & .\run.bat
  }
}
