# AI_Program_Main_Board - run.ps1
# One command: run.bat
$ErrorActionPreference = "Stop"
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

$Repo = "waterstar21g-png/sangpum-capture-price"
$ExpectedVersion = "2.2.5"
$TargetVersion = $ExpectedVersion
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Get-MainCommitSha {
  for ($i = 1; $i -le 4; $i++) {
    try {
      $meta = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/main?t=$cb$i" -Headers @{
        "User-Agent"    = "AI_Program_Main_Board-run.ps1"
        "Cache-Control" = "no-cache"
        "Pragma"        = "no-cache"
      }
      if ($meta.sha -and $meta.sha -match '^[0-9a-f]{7,40}$') { return $meta.sha }
    } catch {
      Write-Host "[WARN] commits API retry $i : $($_.Exception.Message)"
      Start-Sleep -Seconds ([Math]::Pow(2, $i))
    }
  }
  throw "GitHub commits API failed. Cannot sync. Check network / rate limit."
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
Write-Host "  sync sha: $Sha"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[SYNC] GitHub API download..."

$files = @(
  @("lib\product-data-collect\browser-session.ts", "lib/product-data-collect/browser-session.ts"),
  @("lib\product-data-collect\screen-state.ts", "lib/product-data-collect/screen-state.ts"),
  @("lib\product-data-collect\runner.ts", "lib/product-data-collect/runner.ts"),
  @("lib\product-data-collect\steps.ts", "lib/product-data-collect/steps.ts"),
  @("lib\product-data-collect\types.ts", "lib/product-data-collect/types.ts"),
  @("lib\product-data-collect\excel-import.ts", "lib/product-data-collect/excel-import.ts"),
  @("lib\excel-export.ts", "lib/excel-export.ts"),
  @("lib\top-final-label.ts", "lib/top-final-label.ts"),
  @("components\ProgramBoardApp.tsx", "components/ProgramBoardApp.tsx"),
  @("components\ProductDataCollectApp.tsx", "components/ProductDataCollectApp.tsx"),
  @("app\layout.tsx", "app/layout.tsx"),
  @("app\globals.css", "app/globals.css"),
  @("lib\programs\registry.tsx", "lib/programs/registry.tsx"),
  @("lib\app-version.ts", "lib/app-version.ts"),
  @("package.json", "package.json"),
  @("scripts\next-dev-safe.mjs", "scripts/next-dev-safe.mjs"),
  @("scripts\clean-next.mjs", "scripts/clean-next.mjs"),
  @("next.config.ts", "next.config.ts"),
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

if ($failed.Count -gt 0) {
  Write-Host "[FATAL] sync failed: $($failed -join ', ')"
  Read-Host "Press Enter"
  exit 1
}

$rawVer = Get-Content "lib\app-version.ts" -Raw
if ($rawVer -match "APP_VERSION\s*=\s*'([^']+)'") {
  $TargetVersion = $Matches[1]
}
Write-Host "[CHECK] APP_VERSION = $TargetVersion  (sha=$Sha)"

if ($TargetVersion -ne $ExpectedVersion) {
  Write-Host "[FATAL] version mismatch: file=$TargetVersion / expected=$ExpectedVersion"
  Write-Host "Paste this ONE line in PowerShell:"
  Write-Host "irm https://api.github.com/repos/$Repo/contents/run.ps1?ref=main -Headers @{Accept='application/vnd.github.raw';'User-Agent'='x'} -OutFile run.ps1; .\run.bat"
  Read-Host "Press Enter"
  exit 1
}

"version $TargetVersion" | Out-File -FilePath "VERSION.txt" -Encoding utf8

Write-Host "[STOP] kill port 3000..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-Process -Name node -ErrorAction SilentlyContinue |
  ForEach-Object {
    try {
      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
      if ($cmd -match 'next') { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    } catch {}
  }
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

Write-Host "[CLEAN] .next + .next-dev"
Remove-Item -Recurse -Force ".next", ".next-dev" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  VERSION: $TargetVersion"
Write-Host "  FLOW: [0]init -> [1]URL search+wait popup -> [2]save all+filter+save -> [3]wait popup -> [4]->[0]"
Write-Host "  http://localhost:3000"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

Start-Process "http://localhost:3000"
npm run dev
