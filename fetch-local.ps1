# 모든 프로그램 → D:\My_Project\AI_Program_Main_Board 만
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File .\fetch-local.ps1
$ErrorActionPreference = "Stop"
$Root = "D:\My_Project"
$Dest = Join-Path $Root "AI_Program_Main_Board"
$Repo = "https://github.com/waterstar21g-png/AI_Program_Main_Board.git"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  →  $Dest"
Write-Host "========================================"

New-Item -ItemType Directory -Force -Path $Root | Out-Null

# AI_Program_Main_Board_New 잔여물 삭제
foreach ($p in @(
  (Join-Path $Root "AI_Program_Main_Board_New"),
  (Join-Path $Dest "AI_Program_Main_Board_New")
)) {
  if (Test-Path $p) {
    Write-Host "[삭제] $p" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $p
  }
}

if (Get-Command git -ErrorAction SilentlyContinue) {
  if (Test-Path (Join-Path $Dest ".git")) {
    Write-Host "[GIT] pull origin main ..."
    Set-Location $Dest
    git pull origin main
  } else {
    if (Test-Path $Dest) {
      Write-Host "[GIT] 기존 폴더를 비우고 clone ..."
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
  # ZIP 안에 New가 남아 있어도 삭제
  $nested = Join-Path $Dest "AI_Program_Main_Board_New"
  if (Test-Path $nested) { Remove-Item -Recurse -Force $nested }
}

Write-Host ""
Write-Host "[OK] 위치: $Dest" -ForegroundColor Green
Write-Host "  실행: Set-Location '$Dest'; .\run.bat"
Write-Host ""
$ans = Read-Host "지금 run.bat 실행할까요? (Y/N)"
if ($ans -match '^[Yy]') {
  Set-Location $Dest
  & .\run.bat
}
