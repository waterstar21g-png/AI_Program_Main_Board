# AI_Program_Main_Board - run.ps1
# GitHub main 최신 커밋 SHA로 동기화 (raw CDN 캐시 우회)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Repo = "waterstar21g-png/sangpum-capture-price"
$ExpectedVersion = "2.0.9.2"
$TargetVersion = $ExpectedVersion
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Get-MainCommitSha {
  try {
    $headers = @{
      "User-Agent"    = "AI_Program_Main_Board-run.ps1"
      "Cache-Control" = "no-cache"
      "Pragma"        = "no-cache"
    }
    $meta = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/main?t=$cb" -Headers $headers
    if ($meta.sha) { return $meta.sha }
  } catch {
    Write-Host "[WARN] commits API 실패 — main raw 사용: $($_.Exception.Message)"
  }
  return "main"
}

function Download-File([string]$RelPath, [string]$Url) {
  $headers = @{
    "User-Agent"    = "AI_Program_Main_Board-run.ps1"
    "Cache-Control" = "no-cache"
    "Pragma"        = "no-cache"
  }
  $tmp = "$RelPath.download"
  Invoke-WebRequest -Uri "$Url`?t=$cb" -OutFile $tmp -UseBasicParsing -Headers $headers
  Move-Item -Force $tmp $RelPath
}

$Sha = Get-MainCommitSha
$Raw = "https://raw.githubusercontent.com/$Repo/$Sha"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  v$ExpectedVersion"
Write-Host "  sync: $Sha"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[SYNC] GitHub 최신 파일 다운로드 (캐시 우회)..."
New-Item -ItemType Directory -Force -Path "lib\programs" | Out-Null
New-Item -ItemType Directory -Force -Path "lib\product-data-collect" | Out-Null
New-Item -ItemType Directory -Force -Path "components" | Out-Null
New-Item -ItemType Directory -Force -Path "app\api\product-collect\run" | Out-Null
New-Item -ItemType Directory -Force -Path "app\api\product-collect\open" | Out-Null

$files = @(
  @("lib\product-data-collect\browser-session.ts", "$Raw/lib/product-data-collect/browser-session.ts"),
  @("lib\product-data-collect\runner.ts", "$Raw/lib/product-data-collect/runner.ts"),
  @("lib\product-data-collect\steps.ts", "$Raw/lib/product-data-collect/steps.ts"),
  @("lib\product-data-collect\types.ts", "$Raw/lib/product-data-collect/types.ts"),
  @("lib\product-data-collect\excel-import.ts", "$Raw/lib/product-data-collect/excel-import.ts"),
  @("components\ProgramBoardApp.tsx", "$Raw/components/ProgramBoardApp.tsx"),
  @("components\ProductDataCollectApp.tsx", "$Raw/components/ProductDataCollectApp.tsx"),
  @("app\layout.tsx", "$Raw/app/layout.tsx"),
  @("app\globals.css", "$Raw/app/globals.css"),
  @("lib\programs\registry.tsx", "$Raw/lib/programs/registry.tsx"),
  @("lib\app-version.ts", "$Raw/lib/app-version.ts"),
  @("package.json", "$Raw/package.json"),
  @("app\api\product-collect\run\route.ts", "$Raw/app/api/product-collect/run/route.ts"),
  @("app\api\product-collect\open\route.ts", "$Raw/app/api/product-collect/open/route.ts"),
  @("run.ps1", "$Raw/run.ps1")
)

$failed = @()
foreach ($f in $files) {
  try {
    Download-File $f[0] $f[1]
    Write-Host "  OK $($f[0])"
  } catch {
    Write-Host "  FAIL $($f[0]) - $($_.Exception.Message)"
    $failed += $f[0]
  }
}

$required = @(
  "lib\product-data-collect\browser-session.ts",
  "lib\product-data-collect\runner.ts",
  "lib\app-version.ts",
  "app\api\product-collect\open\route.ts"
)
foreach ($r in $required) {
  if (-not (Test-Path $r)) {
    Write-Host "[FATAL] 필수 파일 없음: $r"
    Write-Host "        수동 다운로드: $Raw/$($r -replace '\\','/')"
    Read-Host "Press Enter"
    exit 1
  }
}

if ($failed.Count -gt 0) {
  Write-Host "[WARN] 일부 파일 동기화 실패. 인터넷 확인 후 다시 run.ps1 실행"
}

# 동기화 후 실제 APP_VERSION 강제 확인
if (Test-Path "lib\app-version.ts") {
  $rawVer = Get-Content "lib\app-version.ts" -Raw
  if ($rawVer -match "APP_VERSION\s*=\s*'([^']+)'") {
    $TargetVersion = $Matches[1]
  }
  Write-Host "[CHECK] APP_VERSION = $TargetVersion  (sha=$Sha)"
}

if ($TargetVersion -ne $ExpectedVersion) {
  Write-Host "[FATAL] 버전 불일치: 파일=$TargetVersion / 기대=$ExpectedVersion"
  Write-Host "        GitHub main 반영·캐시 문제. 30초 후 다시 run.ps1 실행하세요."
  Write-Host "        직접 확인: https://raw.githubusercontent.com/$Repo/$Sha/lib/app-version.ts"
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

# Next 캐시에 옛 버전이 남으면 배너가 안 바뀜 → .next 삭제
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
