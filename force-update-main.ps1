#Requires -Version 5.1
# Force sync local project to GitHub origin/main (ALWAYS).
# Does NOT skip when VERSION looks the same — used for "버전갱신" icon / board button.
# ASCII-only (PS 5.1 safe)
$ErrorActionPreference = "Continue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$Repo = "waterstar21g-png/AI_Program_Main_Board"

if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "VERSION.txt"))) {
  $Root = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $PreferredRoot "VERSION.txt")) {
  $Root = $PreferredRoot
} else {
  $Root = if ($PSScriptRoot) { $PSScriptRoot } else { $PreferredRoot }
}

Set-Location -LiteralPath $Root

function Get-VersionFromText([string]$text) {
  if (-not $text) { return "" }
  if ($text -match '(?m)(?:버전|version)\s*([0-9]+(?:\.[0-9]+)+)') { return $Matches[1] }
  if ($text -match '([0-9]+\.[0-9]+\.[0-9]+)') { return $Matches[1] }
  return ""
}

function Get-LocalVersion {
  $p = Join-Path $Root "VERSION.txt"
  if (-not (Test-Path -LiteralPath $p)) { return "" }
  try { return Get-VersionFromText (Get-Content -LiteralPath $p -Raw -ErrorAction Stop) } catch { return "" }
}

function Invoke-GitHost([string]$GitCommandLine) {
  cmd.exe /c $GitCommandLine
  return $LASTEXITCODE
}

function Update-FromZip {
  Write-Host "[ZIP] Forcing ZIP overwrite from GitHub main ..."
  $zipUrl = "https://codeload.github.com/$Repo/zip/refs/heads/main"
  $zipFile = Join-Path $env:TEMP "AI_Program_Main_Board_main_force.zip"
  $extractDir = Join-Path $env:TEMP ("AI_Program_Main_Board_force_" + [Guid]::NewGuid().ToString("N"))
  try {
    if (Test-Path -LiteralPath $zipFile) { Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue }
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "AI_Program_Main_Board-force-update")
    $wc.Headers.Add("Cache-Control", "no-cache")
    $wc.DownloadFile($zipUrl, $zipFile)
    if (-not (Test-Path -LiteralPath $zipFile)) { return $false }
    if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
    $src = Join-Path $extractDir "AI_Program_Main_Board-main"
    if (-not (Test-Path -LiteralPath $src)) { return $false }
    Copy-Item -Path (Join-Path $src "*") -Destination $Root -Recurse -Force
    Write-Host "[OK] ZIP overwrite complete"
    return $true
  } catch {
    Write-Host "[WARN] ZIP failed: $($_.Exception.Message)"
    return $false
  } finally {
    try { if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue } } catch {}
    try { if (Test-Path -LiteralPath $zipFile) { Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue } } catch {}
  }
}

Write-Host "========================================"
Write-Host "  FORCE UPDATE -> origin/main"
Write-Host "  $Root"
Write-Host "========================================"

$before = Get-LocalVersion
Write-Host "[VERSION] before=$before"

$ok = $false
$hasGit = [bool](Get-Command git -ErrorAction SilentlyContinue)
$isRepo = Test-Path -LiteralPath (Join-Path $Root ".git")

if ($hasGit -and $isRepo) {
  Write-Host "[GIT] fetch origin main"
  [void](Invoke-GitHost "git fetch origin main --prune")
  $branch = ""
  try { $branch = (cmd.exe /c "git rev-parse --abbrev-ref HEAD 2>NUL").Trim() } catch {}
  if ($branch -and ($branch -ne "main")) {
    Write-Host "[GIT] checkout -f main (was: $branch)"
    [void](Invoke-GitHost "git checkout -f main")
  }
  Write-Host "[GIT] reset --hard origin/main"
  $resetCode = Invoke-GitHost "git reset --hard origin/main"
  if ($resetCode -eq 0) {
    $ok = $true
  } else {
    Write-Host "[WARN] git reset failed (exit=$resetCode) — try pull"
    $pullCode = Invoke-GitHost "git pull origin main"
    if ($pullCode -eq 0) { $ok = $true }
  }
}

$afterGit = Get-LocalVersion
if ($ok -and $afterGit) {
  Write-Host "[OK] git sync done. VERSION $before -> $afterGit"
} else {
  Write-Host "[WARN] git incomplete — ZIP fallback"
  if (Update-FromZip) {
    $ok = $true
  }
}

$after = Get-LocalVersion
Write-Host "[VERSION] after=$after (was $before)"
if ($ok -and $after) {
  Write-Host "[DONE] Force update OK: v$after" -ForegroundColor Green
  exit 0
}

Write-Host "[FAIL] Force update failed" -ForegroundColor Red
exit 1
