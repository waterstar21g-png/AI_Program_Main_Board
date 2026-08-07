#Requires -Version 5.1
# AI_Program_Main_Board — 프로젝트 독립 실행·검증
# 사용:
#   .\verify.ps1 p1        # P1만 (독립)
#   .\verify.ps1 p2
#   .\verify.ps1 p3
#   .\verify.ps1 all       # 세 개를 각각 독립 실행 후 결과만 모음 (연쇄 아님)
#   .\verify.ps1 p1 -Local
param(
  [Parameter(Position = 0)]
  [ValidateSet('p1', 'p2', 'p3', 'all')]
  [string]$Project = 'p1',
  [switch]$Local
)

$ErrorActionPreference = "Stop"
chcp 65001 > $null
Set-Location -LiteralPath $PSScriptRoot

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  독립 실행·검증"
Write-Host "  대상: $Project  (P1/P2/P3 서로 독립)"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js 없음 — https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

$runner = switch ($Project) {
  'p1' { 'scripts/run-p1.mjs' }
  'p2' { 'scripts/run-p2.mjs' }
  'p3' { 'scripts/run-p3.mjs' }
  default { 'scripts/verify-projects.mjs' }
}

$argsList = if ($Project -eq 'all') {
  @('scripts/verify-projects.mjs', 'all')
} else {
  @($runner)
}
if ($Local) { $argsList += '--local' }

& node @argsList
$code = $LASTEXITCODE
if ($code -ne 0) {
  Write-Host ""
  Write-Host "[안내] 서버가 필요하면 .\\run.bat 후 다시 시도하세요."
  Write-Host "       보드: ①P1 ②P2 ③P3 독립 실행 / ①동기화 ②캐시정리 ③개별점검묶음"
  Write-Host "       명령표: scripts\\COMMANDS.txt"
}
exit $code
