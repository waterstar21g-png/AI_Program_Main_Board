#Requires -Version 5.1
# D:\My_Project\AI_Program_Main_Board 시작 아이콘을 바탕화면에 만듭니다.
# 사용 (어디서든):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-desktop-icon.ps1
$ErrorActionPreference = "Stop"
chcp 65001 > $null

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$RepoRaw = "https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main"

Write-Host "========================================"
Write-Host "  바탕화면 시작 아이콘 만들기"
Write-Host "  $PreferredRoot"
Write-Host "========================================"

if (-not (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat"))) {
  Write-Host "[안내] 소스가 없습니다. fetch-local 로 먼저 받습니다..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path "D:\My_Project" | Out-Null
  $fetch = Join-Path $env:TEMP "fetch-local-ai-board.ps1"
  Invoke-WebRequest -Uri "$RepoRaw/fetch-local.ps1" -OutFile $fetch -UseBasicParsing
  # fetch-local 의 대화형 실행 질문은 스킵되도록 비대화형 복제 로직은 여기서 clone
  if (Get-Command git -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $PreferredRoot ".git")) {
      Set-Location $PreferredRoot
      git pull origin main
    } else {
      if (Test-Path $PreferredRoot) { Remove-Item -Recurse -Force $PreferredRoot }
      git clone "https://github.com/waterstar21g-png/AI_Program_Main_Board.git" $PreferredRoot
    }
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $fetch
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat"))) {
  Write-Host "[ERROR] $PreferredRoot\run.bat 없음. 소스 받기를 확인하세요." -ForegroundColor Red
  exit 1
}

# 최신 create-shortcut.ps1 받기
$createPs1 = Join-Path $PreferredRoot "create-shortcut.ps1"
try {
  Invoke-WebRequest -Uri "$RepoRaw/create-shortcut.ps1" -OutFile $createPs1 -UseBasicParsing
} catch {
  Write-Host "[WARN] GitHub에서 create-shortcut.ps1 다운로드 실패 — 로컬 파일 사용" -ForegroundColor Yellow
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $createPs1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[DONE] 바탕화면의 AI_Program_Main_Board 아이콘을 더블클릭하세요." -ForegroundColor Green
