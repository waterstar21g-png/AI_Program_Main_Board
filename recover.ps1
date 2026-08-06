#Requires -Version 5.1
# AI_Program_Main_Board — download latest + start (no GitHub API)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$Repo = "waterstar21g-png/AI_Program_Main_Board"
$RepoFallback = "waterstar21g-png/sangpum-capture-price"
$Ref = "main"
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Repos = @($Repo, $RepoFallback) | Select-Object -Unique

$files = @(
  "run.bat",
  "run.ps1",
  "recover.ps1",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "lib/app-version.ts",
  "scripts/next-dev-safe.mjs",
  "scripts/clean-next.mjs"
)

Write-Host ""
Write-Host "  AI_Program_Main_Board" -ForegroundColor Cyan
Write-Host "  syncing from GitHub main ..." -ForegroundColor Cyan
Write-Host ""

foreach ($rel in $files) {
  $local = Join-Path $PSScriptRoot ($rel -replace '/', '\')
  $dir = Split-Path -Parent $local
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $ok = $false
  $last = $null
  foreach ($r in $Repos) {
    $url = "https://cdn.jsdelivr.net/gh/$r@$Ref/$rel`?t=$cb"
    try {
      Invoke-WebRequest -Uri $url -OutFile "$local.download" -UseBasicParsing -Headers @{ "User-Agent" = "recover" }
      $bytes = [IO.File]::ReadAllBytes("$local.download")
      Remove-Item "$local.download" -Force -ErrorAction SilentlyContinue
      if ($bytes.Length -lt 5) { throw "download failed: $rel" }
      if ($rel -match '\.(bat|cmd)$') {
        $text = [Text.Encoding]::UTF8.GetString($bytes) -replace "`r`n", "`n" -replace "`n", "`r`n"
        [IO.File]::WriteAllText($local, $text, (New-Object Text.UTF8Encoding $false))
      } else {
        [IO.File]::WriteAllBytes($local, $bytes)
      }
      Write-Host "  OK $rel"
      $ok = $true
      break
    } catch {
      $last = $_
      Remove-Item "$local.download" -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not $ok) { throw $last }
}

$ver = (Select-String -Path "lib\app-version.ts" -Pattern "APP_VERSION\s*=\s*'([^']+)'").Matches[0].Groups[1].Value
Write-Host ""
Write-Host "  VERSION $ver" -ForegroundColor Green
Write-Host ""

foreach ($junk in @(".next", ".next-dev", "app\elastic-beanstalk")) {
  if (Test-Path $junk) { Remove-Item -Recurse -Force $junk -ErrorAction SilentlyContinue }
}
Remove-Item Env:TURBO, Env:TURBOPACK -ErrorAction SilentlyContinue

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1")
exit $LASTEXITCODE
