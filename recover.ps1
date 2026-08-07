#Requires -Version 5.1
# AI_Program_Main_Board — download latest + start (no GitHub API)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$Repo = "waterstar21g-png/AI_Program_Main_Board"
$Ref = "main"
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$base = "https://cdn.jsdelivr.net/gh/$Repo@$Ref"

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
Write-Host "  GitHub main에서 동기화 중 ..." -ForegroundColor Cyan
Write-Host ""

foreach ($rel in $files) {
  $local = Join-Path $PSScriptRoot ($rel -replace '/', '\')
  $dir = Split-Path -Parent $local
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $url = "$base/$rel`?t=$cb"
  Write-Host "  정상 $rel"
  Invoke-WebRequest -Uri $url -OutFile "$local.download" -UseBasicParsing -Headers @{ "User-Agent" = "recover" }
  $bytes = [IO.File]::ReadAllBytes("$local.download")
  Remove-Item "$local.download" -Force -ErrorAction SilentlyContinue
  if ($bytes.Length -lt 5) { throw "다운로드 실패: $rel" }
  if ($rel -match '\.(bat|cmd)$') {
    $text = [Text.Encoding]::UTF8.GetString($bytes) -replace "`r`n", "`n" -replace "`n", "`r`n"
    [IO.File]::WriteAllText($local, $text, (New-Object Text.UTF8Encoding $false))
  } else {
    [IO.File]::WriteAllBytes($local, $bytes)
  }
}

$ver = (Select-String -Path "lib\app-version.ts" -Pattern "APP_VERSION\s*=\s*'([^']+)'").Matches[0].Groups[1].Value
Write-Host ""
Write-Host "  버전 $ver" -ForegroundColor Green
Write-Host ""

foreach ($junk in @(".next", ".next-dev", "app\elastic-beanstalk")) {
  if (Test-Path $junk) { Remove-Item -Recurse -Force $junk -ErrorAction SilentlyContinue }
}
Remove-Item Env:TURBO, Env:TURBOPACK -ErrorAction SilentlyContinue

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1")
exit $LASTEXITCODE
