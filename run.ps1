# AI_Program_Main_Board - run.ps1
# GitHub Contents API로 동기화 (raw.githubusercontent.com CDN 캐시 우회)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Repo = "waterstar21g-png/sangpum-capture-price"
$ExpectedVersion = "2.0.9.3"
$TargetVersion = $ExpectedVersion
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Get-MainCommitSha {
  try {
    $meta = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/main?t=$cb" -Headers @{
      "User-Agent"    = "AI_Program_Main_Board-run.ps1"
      "Cache-Control" = "no-cache"
      "Pragma"        = "no-cache"
    }
    if ($meta.sha) { return $meta.sha }
  } catch {
    Write-Host "[WARN] commits API 실패: $($_.Exception.Message)"
  }
  return "main"
}

function Download-RepoFile([string]$LocalPath, [string]$RepoPath) {
  $dir = Split-Path -Parent $LocalPath
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $tmp = "$LocalPath.download"
  $headers = @{
    "User-Agent"    = "AI_Program_Main_Board-run.ps1"
    "Cache-Control" = "no-cache"
    "Pragma"        = "no-cache"
    "Accept"        = "application/vnd.github.raw"
  }
  $apiUrl = "https://api.github.com/repos/$Repo/contents/$($RepoPath -replace '\\','/')?ref=$Sha&t=$cb"
  try {
    Invoke-WebRequest -Uri $apiUrl -OutFile $tmp -UseBasicParsing -Headers $headers
  } catch {
    # fallback: commit SHA raw (branch명 main raw 는 캐시됨 — 사용 금지)
    $rawUrl = "https://raw.githubusercontent.com/$Repo/$Sha/$($RepoPath -replace '\\','/')?t=$cb"
    Invoke-WebRequest -Uri $rawUrl -OutFile $tmp -UseBasicParsing -Headers @{
      "User-Agent"    = "AI_Program_Main_Board-run.ps1"
      "Cache-Control" = "no-cache"
      "Pragma"        = "no-cache"
    }
  }
  Move-Item -Force $tmp $LocalPath
}

$Sha = Get-MainCommitSha

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  v$ExpectedVersion"
Write-Host "  sync: $Sha"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[SYNC] GitHub API로 최신 파일 다운로드 (CDN 우회)..."

$files = @(
  @("lib\product-data-collect\browser-session.ts", "lib/product-data-collect/browser-session.ts"),
  @("lib\product-data-collect\runner.ts", "lib/product-data-collect/runner.ts"),
  @("lib\product-data-collect\steps.ts", "lib/product-data-collect/steps.ts"),
  @("lib\product-data-collect\types.ts", "lib/product-data-collect/types.ts"),
  @("lib\product-data-collect\excel-import.ts", "lib/product-data-collect/excel-import.ts"),
  @("components\ProgramBoardApp.tsx", "components/ProgramBoardApp.tsx"),
  @("components\ProductDataCollectApp.tsx", "components/ProductDataCollectApp.tsx"),
  @("app\layout.tsx", "app/layout.tsx"),
  @("app\globals.css", "app/globals.css"),
  @("lib\programs\registry.tsx", "lib/programs/registry.tsx"),
  @("lib\app-version.ts", "lib/app-version.ts"),
  @("package.json", "package.json"),
  @("app\api\product-collect\run\route.ts", "app/api/product-collect/run/route.ts"),
  @("app\api\product-collect\open\route.ts", "app/api/product-collect/open/route.ts"),
  @("run.ps1", "run.ps1"),
  @("run.bat", "run.bat")
)

$failed = @()
foreach ($f in $files) {
  try {
    Download-RepoFile $f[0] $f[1]
    Write-Host "  OK $($f[0])"
  } catch {
    Write-Host "  FAIL $($f[0]) - $($_.Exception.Message)"
    $failed += $f[0]
  }
}

foreach ($r in @(
  "lib\product-data-collect\browser-session.ts",
  "lib\product-data-collect\runner.ts",
  "lib\app-version.ts",
  "app\api\product-collect\open\route.ts"
)) {
  if (-not (Test-Path $r)) {
    Write-Host "[FATAL] 필수 파일 없음: $r"
    Read-Host "Press Enter"
    exit 1
  }
}

if ($failed.Count -gt 0) {
  Write-Host "[WARN] 일부 파일 동기화 실패 ($($failed.Count))"
}

$rawVer = Get-Content "lib\app-version.ts" -Raw
if ($rawVer -match "APP_VERSION\s*=\s*'([^']+)'") {
  $TargetVersion = $Matches[1]
}
Write-Host "[CHECK] APP_VERSION = $TargetVersion  (sha=$Sha)"

if ($TargetVersion -ne $ExpectedVersion) {
  Write-Host "[FATAL] 버전 불일치: 파일=$TargetVersion / 기대=$ExpectedVersion"
  Write-Host "        아래 한 줄을 PowerShell에 붙여 넣고 다시 실행하세요:"
  Write-Host "        irm https://api.github.com/repos/$Repo/contents/run.ps1?ref=main -Headers @{Accept='application/vnd.github.raw';'User-Agent'='x'} -OutFile run.ps1; .\run.ps1"
  Read-Host "Press Enter"
  exit 1
}

"버전 $TargetVersion" | Out-File -FilePath "VERSION.txt" -Encoding utf8

Write-Host "[STOP] 기존 서버(포트 3000) 종료..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

if (-not (Test-Path "node_modules")) {
  Write-Host "[INSTALL] npm install..."
  npm install
}

if (-not (Test-Path ".local\playwright-chromium.ok")) {
  Write-Host "[INSTALL] Playwright Chromium..."
  New-Item -ItemType Directory -Force -Path ".local" | Out-Null
  npx playwright install chromium
  if ($LASTEXITCODE -eq 0) { "ok" | Out-File ".local\playwright-chromium.ok" -Encoding ascii }
}

if (Test-Path ".next") {
  Write-Host "[CLEAN] .next 캐시 삭제 (버전 배지 갱신)"
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "  버전: $TargetVersion (좌측 상단)"
Write-Host "  http://localhost:3000"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

Start-Process "http://localhost:3000"
npm run dev:fast
