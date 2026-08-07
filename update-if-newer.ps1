#Requires -Version 5.1
# Pull from GitHub main ONLY when VERSION differs from origin/main.
# ASCII-only (PS 5.1 safe). Called by run.bat / boot-from-icon.ps1.
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

# git writes progress ("From https://...") to stderr. In PS 5.1,
# "git ... 2>&1 | Out-Host" wraps those lines as NativeCommandError (red)
# even when git succeeds. Run via cmd.exe so stderr is plain text.
function Invoke-GitHost {
  param(
    [Parameter(Mandatory = $true)]
    [string]$GitCommandLine
  )
  cmd.exe /c $GitCommandLine
  return $LASTEXITCODE
}

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

function Get-RemoteVersionViaGit {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return "" }
  if (-not (Test-Path -LiteralPath (Join-Path $Root ".git"))) { return "" }
  try {
    cmd.exe /c "git fetch origin main >NUL 2>&1" | Out-Null
    $text = cmd.exe /c "git show origin/main:VERSION.txt 2>NUL"
    if ($text) { return Get-VersionFromText ($text -join "`n") }
  } catch {}
  return ""
}

function Get-RemoteVersionViaHttp {
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
$remote = Get-RemoteVersionViaGit
if (-not $remote) {
  Write-Host "[INFO] git remote VERSION unavailable — try HTTP"
  $remote = Get-RemoteVersionViaHttp
}

Write-Host "[VERSION] local=$local  remote=$remote"

if (-not $remote) {
  Write-Host "[SKIP] Cannot read remote VERSION — start without update"
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

# Prefer main branch so pull applies published VERSION
$branch = ""
try {
  $branch = (cmd.exe /c "git rev-parse --abbrev-ref HEAD 2>NUL").Trim()
} catch {}
if ($branch -and ($branch -ne "main")) {
  Write-Host "[INFO] checkout main (was: $branch)"
  [void](Invoke-GitHost "git checkout main")
}

$pullCode = Invoke-GitHost "git pull origin main"
if ($pullCode -ne 0) {
  Write-Host "[WARN] git pull failed — try reset to origin/main"
  [void](Invoke-GitHost "git fetch origin main")
  $resetCode = Invoke-GitHost "git reset --hard origin/main"
  if ($resetCode -ne 0) {
    Write-Host "[WARN] update failed — start with local source"
    exit 0
  }
}

$after = Get-LocalVersion
Write-Host "[OK] Source updated. VERSION=$after (was $local)"
if ($after -and $remote -and ($after -ne $remote)) {
  Write-Host "[WARN] After pull local=$after still != remote=$remote"
}
exit 0
