# AI_Program_Main_Board - run.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Raw = "https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main"

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

$TargetVersion = "1.6.7"
$needDownload = $false
if (-not (Test-Path "components\ProductDataCollectApp.tsx")) { $needDownload = $true }
if (-not (Test-Path "lib\product-data-collect\runner.ts")) { $needDownload = $true }
if (Test-Path "lib\programs\registry.tsx") {
  if (Select-String -Path "lib\programs\registry.tsx" -Pattern "ProductCapture" -Quiet) { $needDownload = $true }
} else { $needDownload = $true }
if (Test-Path "lib\app-version.ts") {
  if (-not (Select-String -Path "lib\app-version.ts" -Pattern $TargetVersion -Quiet)) { $needDownload = $true }
} else { $needDownload = $true }

if ($needDownload) {
  Write-Host "[DOWNLOAD] Updating files..."
  New-Item -ItemType Directory -Force -Path "lib\programs" | Out-Null
  New-Item -ItemType Directory -Force -Path "lib\product-data-collect" | Out-Null
  New-Item -ItemType Directory -Force -Path "components" | Out-Null
  New-Item -ItemType Directory -Force -Path "app\api\product-collect\run" | Out-Null

  $files = @(
    @("lib\programs\registry.tsx", "$Raw/lib/programs/registry.tsx"),
    @("lib\app-version.ts", "$Raw/lib/app-version.ts"),
    @("components\ProductDataCollectApp.tsx", "$Raw/components/ProductDataCollectApp.tsx"),
    @("lib\product-data-collect\types.ts", "$Raw/lib/product-data-collect/types.ts"),
    @("lib\product-data-collect\steps.ts", "$Raw/lib/product-data-collect/steps.ts"),
    @("lib\product-data-collect\runner.ts", "$Raw/lib/product-data-collect/runner.ts"),
    @("lib\product-data-collect\excel-import.ts", "$Raw/lib/product-data-collect/excel-import.ts"),
    @("app\api\product-collect\run\route.ts", "$Raw/app/api/product-collect/run/route.ts"),
    @("app\globals.css", "$Raw/app/globals.css")
  )
  foreach ($f in $files) {
    Invoke-WebRequest -Uri $f[1] -OutFile $f[0] -UseBasicParsing
    Write-Host "  OK $($f[0])"
  }
}

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
Write-Host "  http://localhost:3000"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

Start-Process "http://localhost:3000"
npm run dev:fast
