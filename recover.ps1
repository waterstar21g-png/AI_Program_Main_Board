#Requires -Version 5.1
# AI_Program_Main_Board — one-shot recovery (no GitHub API)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$Repo = "waterstar21g-png/sangpum-capture-price"
$Ref = "main"
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$base = "https://raw.githubusercontent.com/$Repo/$Ref"

$files = @(
  "boot.ps1",
  "run.bat",
  "run.ps1",
  "recover.ps1",
  "package.json",
  "next.config.ts",
  "lib/app-version.ts",
  "scripts/next-dev-safe.mjs",
  "scripts/clean-next.mjs"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RECOVER  AI_Program_Main_Board" -ForegroundColor Cyan
Write-Host "  raw CDN (no API rate limit)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($rel in $files) {
  $local = Join-Path $PSScriptRoot ($rel -replace '/', '\')
  $dir = Split-Path -Parent $local
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $url = "$base/$rel`?t=$cb"
  Write-Host "  GET $rel"
  Invoke-WebRequest -Uri $url -OutFile "$local.download" -UseBasicParsing -Headers @{
    "User-Agent"    = "recover.ps1"
    "Cache-Control" = "no-cache"
  }
  $bytes = [IO.File]::ReadAllBytes("$local.download")
  Remove-Item "$local.download" -Force -ErrorAction SilentlyContinue
  if ($bytes.Length -lt 5) { throw "download too small: $rel" }
  $head = [Text.Encoding]::UTF8.GetString($bytes, 0, [Math]::Min(40, $bytes.Length))
  if ($head -match '^\s*\{\s*"message"') { throw "API error for $rel" }
  if ($rel -match '\.(bat|cmd)$') {
    $text = [Text.Encoding]::UTF8.GetString($bytes) -replace "`r`n", "`n" -replace "`n", "`r`n"
    [IO.File]::WriteAllText($local, $text, (New-Object Text.UTF8Encoding $false))
  } else {
    [IO.File]::WriteAllBytes($local, $bytes)
  }
}

$ver = (Select-String -Path "lib\app-version.ts" -Pattern "APP_VERSION\s*=\s*'([^']+)'").Matches[0].Groups[1].Value
Write-Host "[OK] downloaded. APP_VERSION = $ver" -ForegroundColor Green

foreach ($junk in @(".next", ".next-dev", "app\elastic-beanstalk", "app\elastic_beanstalk")) {
  if (Test-Path $junk) {
    Write-Host "[CLEAN] $junk"
    Remove-Item -Recurse -Force $junk -ErrorAction SilentlyContinue
  }
}

Remove-Item Env:TURBO, Env:TURBOPACK, Env:IS_TURBOPACK_TEST -ErrorAction SilentlyContinue

Write-Host "[RUN] starting run.ps1 ..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1")
exit $LASTEXITCODE
