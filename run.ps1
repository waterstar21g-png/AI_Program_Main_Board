# AI_Program_Main_Board - run.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Raw = "https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main"
$TargetVersion = "1.9.5"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  v$TargetVersion"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[SYNC] GitHub 최신 파일 다운로드 (매 실행)..."
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
  @("app\api\product-collect\run\route.ts", "$Raw/app/api/product-collect/run/route.ts"),
  @("app\api\product-collect\open\route.ts", "$Raw/app/api/product-collect/open/route.ts"),
  @("run.ps1", "$Raw/run.ps1")
)

$failed = @()
foreach ($f in $files) {
  try {
    Invoke-WebRequest -Uri $f[1] -OutFile $f[0] -UseBasicParsing
    Write-Host "  OK $($f[0])"
  } catch {
    Write-Host "  FAIL $($f[0]) - $($_.Exception.Message)"
    $failed += $f[0]
  }
}

$required = @(
  "lib\product-data-collect\browser-session.ts",
  "lib\product-data-collect\runner.ts",
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

"버전 $TargetVersion (좌측 상단 작게 표시)" | Out-File -FilePath "VERSION.txt" -Encoding utf8

if (Test-Path "lib\app-version.ts") {
  $verLine = Select-String -Path "lib\app-version.ts" -Pattern "APP_VERSION" | Select-Object -First 1
  Write-Host "[CHECK] $($verLine.Line.Trim())"
}

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

Write-Host ""
Write-Host "  버전: $TargetVersion (좌측 상단)"
Write-Host "  http://localhost:3000"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

Start-Process "http://localhost:3000"
npm run dev:fast
