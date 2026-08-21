# 망고보드 → 독립 GitHub 저장소(Mango_Helper_AI_Board) publish (PowerShell)
# 저장소가 GitHub에 없으면 먼저 https://github.com/new 에서 생성하세요.
#
# 사용: .\scripts\publish-standalone.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoUrl = "https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git"
$TempDir = Join-Path $env:TEMP "Mango_Helper_AI_Board_publish"

Write-Host "망고보드 독립 저장소 publish" -ForegroundColor Cyan
Write-Host "대상: $RepoUrl"

if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
New-Item -ItemType Directory -Path $TempDir | Out-Null

# 현재 폴더 내용 복사 (.git 제외)
robocopy $Root $TempDir /E /XD .git __pycache__ .chrome-profile output run-logs /XF *.pyc /NFL /NDL /NJH /NJS | Out-Null

Set-Location $TempDir
if (-not (Test-Path ".git")) {
    git init -b main
    git add -A
    git commit -m "feat: Mango_Helper_AI_Board 망고보드 독립 저장소 publish"
}

$remotes = git remote 2>$null
if ($remotes -notcontains "origin") {
    git remote add origin $RepoUrl
}

Write-Host "push 시도..."
git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] publish 완료: $RepoUrl" -ForegroundColor Green
} else {
    Write-Host "[안내] push 실패 — GitHub에서 저장소를 먼저 생성했는지 확인하세요." -ForegroundColor Yellow
    Write-Host "  1) https://github.com/new → Repository name: Mango_Helper_AI_Board"
    Write-Host "  2) 다시: .\scripts\publish-standalone.ps1"
}
