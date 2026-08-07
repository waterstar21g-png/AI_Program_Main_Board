#Requires -Version 5.1
# AI_Program_Main_Board — P1→P2→P3 실행·검증 (PowerShell 창 대체용)
# 사용:
#   .\verify.ps1           # 전체 순서 검증 (서버 필요)
#   .\verify.ps1 p1        # P1만
#   .\verify.ps1 p2
#   .\verify.ps1 p3
#   .\verify.ps1 -Local    # 서버 없이 파일 점검만
param(
  [Parameter(Position = 0)]
  [ValidateSet('all', 'p1', 'p2', 'p3')]
  [string]$Project = 'all',
  [switch]$Local
)

$ErrorActionPreference = "Stop"
chcp 65001 > $null
Set-Location -LiteralPath $PSScriptRoot

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  실행·검증"
Write-Host "  순서: P1 → P2 → P3  ($Project)"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js 없음 — https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

$argsList = @('scripts/verify-projects.mjs', $Project)
if ($Local) { $argsList += '--local' }

& node @argsList
$code = $LASTEXITCODE
if ($code -ne 0) {
  Write-Host ""
  Write-Host "[안내] 서버가 필요하면 보드에서 이미 실행 중이거나 .\\run.bat 후 다시 시도하세요."
  Write-Host "       보드 UI 버튼으로도 동일 작업 가능: ①P1 ②P2 ③P3 / ①동기화 ②캐시정리 ③전체순서검증"
}
exit $code
