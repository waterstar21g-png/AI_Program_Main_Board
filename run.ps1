# AI_Program_Main_Board - run.ps1
# One command: run.bat
# Sync prefers raw.githubusercontent.com (avoids GitHub API rate limit)
$ErrorActionPreference = "Stop"
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

$Repo = "waterstar21g-png/sangpum-capture-price"
$ExpectedVersion = "2.2.12"
$TargetVersion = $ExpectedVersion
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Prefer feature branch until v2.2.12 lands on main
$SyncBranch = "cursor/fix-runbat-encoding-dcbc"

function Get-SyncRef {
  # Never require GitHub API — raw CDN works with branch name
  if ($env:BOARD_SYNC_REF) { return $env:BOARD_SYNC_REF }
  return $SyncBranch
}

function Write-Utf8NoBomFile([string]$Path, [byte[]]$Bytes) {
  if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
    $text = [System.Text.Encoding]::Unicode.GetString($Bytes, 2, $Bytes.Length - 2)
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding $false))
    return
  }
  if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
    $text = [System.Text.Encoding]::BigEndianUnicode.GetString($Bytes, 2, $Bytes.Length - 2)
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding $false))
    return
  }
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    $rest = New-Object byte[] ($Bytes.Length - 3)
    [Array]::Copy($Bytes, 3, $rest, 0, $rest.Length)
    $Bytes = $rest
  }
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($ext -eq ".bat" -or $ext -eq ".cmd") {
    $text = [System.Text.Encoding]::UTF8.GetString($Bytes) -replace "`r`n", "`n" -replace "`n", "`r`n"
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding $false))
    return
  }
  [System.IO.File]::WriteAllBytes($Path, $Bytes)
}

function Download-RepoFile([string]$LocalPath, [string]$RepoPath) {
  $dir = Split-Path -Parent $LocalPath
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $tmp = "$LocalPath.download"
  $rel = $RepoPath -replace '\\', '/'
  $urls = @(
    "https://raw.githubusercontent.com/$Repo/$Sha/$rel`?t=$cb",
    "https://cdn.jsdelivr.net/gh/${Repo}@$Sha/$rel"
  )
  # API last — rate limit hits hard on unauthenticated Contents API
  if ($Sha -match '^[0-9a-f]{40}$') {
    $urls += "https://api.github.com/repos/$Repo/contents/${rel}?ref=$Sha&t=$cb"
  }

  $lastErr = $null
  foreach ($url in $urls) {
    try {
      $headers = @{
        "User-Agent"    = "AI_Program_Main_Board-run.ps1"
        "Cache-Control" = "no-cache"
        "Pragma"        = "no-cache"
      }
      if ($url -match 'api\.github\.com') {
        $headers["Accept"] = "application/vnd.github.raw"
      }
      Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -Headers $headers
      $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $tmp))
      Remove-Item -Force $tmp -ErrorAction SilentlyContinue
      if ($bytes.Length -lt 10) { throw "empty download" }
      $head = [System.Text.Encoding]::UTF8.GetString($bytes, 0, [Math]::Min(60, $bytes.Length))
      if ($head -match '^\s*\{\s*"message"') { throw "API error JSON: $head" }
      Write-Utf8NoBomFile $LocalPath $bytes
      return
    } catch {
      $lastErr = $_
    }
  }
  throw $lastErr
}

function Show-RecoverHint {
  Write-Host "Paste this in PowerShell (raw CDN, no GitHub API):" -ForegroundColor Yellow
  Write-Host @"
`$cb=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); `$b='https://raw.githubusercontent.com/$Repo/$SyncBranch'; foreach(`$f in @('boot.ps1','run.bat','run.ps1')){ Invoke-WebRequest -Uri "`$b/`$f`?t=`$cb" -OutFile "`$PWD\`$f" -UseBasicParsing -Headers @{'User-Agent'='x';'Cache-Control'='no-cache'} }; cmd /c run.bat
"@ -ForegroundColor Gray
}

$Sha = Get-SyncRef

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  v$ExpectedVersion"
Write-Host "  sync ref: $Sha"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[SYNC] raw.githubusercontent.com download..."

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
  @("boot.ps1", "boot.ps1"),
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
  Show-RecoverHint
  Read-Host "Press Enter"
  exit 1
}

$rawVer = Get-Content "lib\app-version.ts" -Raw
if ($rawVer -match "APP_VERSION\s*=\s*'([^']+)'") {
  $TargetVersion = $Matches[1]
}
Write-Host "[CHECK] APP_VERSION = $TargetVersion  (ref=$Sha)"

if ($TargetVersion -ne $ExpectedVersion) {
  Write-Host "[FATAL] version mismatch: file=$TargetVersion / expected=$ExpectedVersion"
  Write-Host "Branch main may not have v$ExpectedVersion yet. Retry after merge, or use:"
  Show-RecoverHint
  Read-Host "Press Enter"
  exit 1
}

$prevVer = ""
if (Test-Path "VERSION.txt") {
  $prevRaw = Get-Content "VERSION.txt" -Raw
  if ($prevRaw -match '([\d.]+)') { $prevVer = $Matches[1] }
}
"version $TargetVersion" | Out-File -FilePath "VERSION.txt" -Encoding ascii

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

if ($prevVer -ne $TargetVersion) {
  Write-Host "[CLEAN] version changed ($prevVer -> $TargetVersion) — clear .next/.next-dev"
  Remove-Item -Recurse -Force ".next", ".next-dev" -ErrorAction SilentlyContinue
} else {
  Write-Host "[CACHE] keep .next-dev (same version $TargetVersion) — fast start"
}

Write-Host ""
# 잔여 잘못된 라우트 (TurbopackInternalError /elastic-beanstalk 원인)
foreach ($junk in @("app\elastic-beanstalk", "app\elastic_beanstalk", "app\aws-deploy")) {
  if (Test-Path $junk) {
    Write-Host "[CLEAN] remove stray $junk"
    Remove-Item -Recurse -Force $junk -ErrorAction SilentlyContinue
  }
}

Write-Host "  VERSION: $TargetVersion  (webpack dev — stable on Windows)"
Write-Host "  FLOW: [0]->[1]->[2]->[3]->[4]"
Write-Host "  http://localhost:3000"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

Start-Process "http://localhost:3000"
$env:DEV_FRESH = "1"
npm run dev
