#Requires -Version 5.1
# Pull from GitHub main ONLY when VERSION.txt differs from remote.
# ASCII-only (PS 5.1 safe). Called by start.bat before run.bat.
$ErrorActionPreference = "Continue"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "VERSION.txt"))) {
  $Root = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $PreferredRoot "VERSION.txt")) {
  $Root = $PreferredRoot
} else {
  $Root = if ($PSScriptRoot) { $PSScriptRoot } else { $PreferredRoot }
}

Set-Location -LiteralPath $Root
$Repo = "waterstar21g-png/AI_Program_Main_Board"

function Get-VersionFromText([string]$text) {
  if (-not $text) { return "" }
  if ($text -match '(?m)(?:버전|version)\s*([0-9]+(?:\.[0-9]+)+)') {
    return $Matches[1]
  }
  if ($text -match '([0-9]+\.[0-9]+\.[0-9]+)') {
    return $Matches[1]
  }
  return ""
}

function Get-LocalVersion {
  $p = Join-Path $Root "VERSION.txt"
  if (-not (Test-Path -LiteralPath $p)) { return "" }
  try {
    return Get-VersionFromText (Get-Content -LiteralPath $p -Raw -ErrorAction Stop)
  } catch {
    return ""
  }
}

function Get-RemoteVersion {
  $cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $urls = @(
    "https://raw.githubusercontent.com/$Repo/main/VERSION.txt?t=$cb",
    "https://cdn.jsdelivr.net/gh/${Repo}@main/VERSION.txt"
  )
  foreach ($url in $urls) {
    try {
      $wc = New-Object System.Net.WebClient
      $wc.Headers.Add("User-Agent", "AI_Program_Main_Board-update-if-newer")
      $wc.Headers.Add("Cache-Control", "no-cache")
      $wc.Encoding = [System.Text.Encoding]::UTF8
      $text = $wc.DownloadString($url)
      $v = Get-VersionFromText $text
      if ($v) { return $v }
    } catch {}
  }
  return ""
}

Write-Host "[VERSION-CHECK] root=$Root"

$local = Get-LocalVersion
$remote = Get-RemoteVersion

Write-Host "[VERSION] local=$local  remote=$remote"

if (-not $remote) {
  Write-Host "[SKIP] Cannot read remote VERSION.txt — start without update"
  exit 0
}

if ($local -and ($local -eq $remote)) {
  Write-Host "[SKIP] Same version ($local) — no git pull"
  exit 0
}

Write-Host "[UPDATE] Version changed ($local -> $remote). Applying source..."

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "[WARN] git not found — start with local source"
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $Root ".git"))) {
  Write-Host "[WARN] Not a git repo — start with local source"
  exit 0
}

git fetch origin main 2>&1 | Out-Host
git pull origin main 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "[WARN] git pull failed — start with local source"
  exit 0
}

$after = Get-LocalVersion
Write-Host "[OK] Source updated. VERSION=$after"
exit 0
