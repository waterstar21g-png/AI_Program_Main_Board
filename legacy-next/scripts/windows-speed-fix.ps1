#Requires -Version 5.1
# AI_Program_Main_Board — Windows 컴파일 속도 응급 조치
# 1) OneDrive 밖인지 확인
# 2) Windows Defender 제외 폴더 등록 (관리자 권한 필요할 수 있음)
$ErrorActionPreference = "Stop"
chcp 65001 > $null
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "package.json"))) { $root = $PSScriptRoot }

Write-Host ""
Write-Host "========================================"
Write-Host "  컴파일 속도 — 로컬 환경 점검"
Write-Host "========================================"
Write-Host "  폴더: $root"
Write-Host ""

$PreferredLocalRoot = "D:\My_Project\AI_Program_Main_Board"

if ($root -match 'OneDrive') {
  Write-Host "[치명] OneDrive 안에 있습니다." -ForegroundColor Red
  Write-Host "  기능 삭제와 무관하게 node_modules(수만 파일)를 OneDrive가 감시하면" -ForegroundColor Yellow
  Write-Host "  컴파일이 수십 분 걸릴 수 있습니다." -ForegroundColor Yellow
  Write-Host "  → $PreferredLocalRoot 로 폴더 이동! (node_modules/.next 제외 후 npm install)" -ForegroundColor Cyan
  Write-Host ""
} else {
  Write-Host "[OK] OneDrive 경로 아님" -ForegroundColor Green
}

if ($root -eq $PreferredLocalRoot) {
  Write-Host "[OK] 권장 로컬 경로: $PreferredLocalRoot" -ForegroundColor Green
} else {
  Write-Host "[안내] 권장 로컬 경로: $PreferredLocalRoot" -ForegroundColor Yellow
  Write-Host "  현재: $root" -ForegroundColor Gray
}

try {
  Add-MpPreference -ExclusionPath $root -ErrorAction Stop
  Write-Host "[OK] Windows Defender 제외 등록: $root" -ForegroundColor Green
} catch {
  Write-Host "[안내] Defender 제외 등록 실패 (관리자 PowerShell에서 다시 실행):" -ForegroundColor Yellow
  Write-Host "  Add-MpPreference -ExclusionPath '$root'"
  Write-Host "  $($_.Exception.Message)"
}

Write-Host ""
Write-Host "보드 UI가 필요 없으면 컴파일 없이:" -ForegroundColor Cyan
Write-Host "  python-collector\run.bat   (P3)"
Write-Host "  p1.bat / p2.bat / p3.bat   (점검만)"
Write-Host ""
Write-Host "보드를 쓸 때는:"
Write-Host "  .\run.ps1          (Turbopack 기본)"
Write-Host "  느리면: `$env:NEXT_USE_WEBPACK=1; .\run.ps1"
Write-Host ""
