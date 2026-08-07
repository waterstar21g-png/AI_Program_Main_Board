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

# Self-refresh once: avoid stale local updater. Re-exec after download.
if (-not $env:AI_BOARD_UPDATER_REFRESHED) {
  $env:AI_BOARD_UPDATER_REFRESHED = "1"
  $selfPath = Join-Path $Root "update-if-newer.ps1"
  try {
    $cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $url = "https://raw.githubusercontent.com/$Repo/main/update-if-newer.ps1?t=$cb"
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "AI_Program_Main_Board-updater-self")
    $wc.Headers.Add("Cache-Control", "no-cache")
    $wc.Encoding = [System.Text.Encoding]::UTF8
    $bytes = $wc.DownloadData($url)
    if ($bytes -and $bytes.Length -gt 200) {
      [System.IO.File]::WriteAllBytes($selfPath, $bytes)
      Write-Host "[OK] updater self-refreshed from GitHub - re-exec"
      & powershell -NoProfile -ExecutionPolicy Bypass -File $selfPath
      exit $LASTEXITCODE
    }
  } catch {
    Write-Host "[WARN] updater self-refresh skipped: $($_.Exception.Message)"
  }
}

# git progress goes to stderr; run via cmd so PS 5.1 does not show NativeCommandError.
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

function Compare-VersionStrings([string]$a, [string]$b) {
  # return: 1 if a>b, 0 if equal, -1 if a<b, 2 if unparsable
  if (-not $a -and -not $b) { return 0 }
  if (-not $a) { return -1 }
  if (-not $b) { return 1 }
  try {
    $va = [version]$a
    $vb = [version]$b
    if ($va -gt $vb) { return 1 }
    if ($va -lt $vb) { return -1 }
    return 0
  } catch {
    return 2
  }
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
    $code = cmd.exe /c "git fetch origin main --prune"
    if ($code -ne 0) {
      Write-Host "[WARN] git fetch origin main failed (exit=$code)"
    }
    $text = cmd.exe /c "git show origin/main:VERSION.txt 2>NUL"
    if ($text) { return Get-VersionFromText ($text -join "`n") }
  } catch {
    Write-Host "[WARN] git remote VERSION read failed: $($_.Exception.Message)"
  }
  return ""
}

function Get-RemoteVersionViaHttp {
  $cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $urls = @(
    "https://raw.githubusercontent.com/$Repo/main/VERSION.txt?t=$cb",
    "https://cdn.jsdelivr.net/gh/${Repo}@main/VERSION.txt?t=$cb"
  )
  foreach ($url in $urls) {
    try {
      $wc = New-Object System.Net.WebClient
      $wc.Headers.Add("User-Agent", "AI_Program_Main_Board-update-if-newer")
      $wc.Headers.Add("Cache-Control", "no-cache")
      $wc.Headers.Add("Pragma", "no-cache")
      $wc.Encoding = [System.Text.Encoding]::UTF8
      $text = $wc.DownloadString($url)
      $v = Get-VersionFromText $text
      if ($v) {
        Write-Host "[INFO] HTTP VERSION from $url => $v"
        return $v
      }
    } catch {
      Write-Host "[WARN] HTTP VERSION fail: $($_.Exception.Message)"
    }
  }
  return ""
}

Write-Host "[VERSION-CHECK] root=$Root"

$local = Get-LocalVersion

# Always check BOTH git and HTTP; use the newer one.
# (Stale origin/main after failed fetch used to keep remote stuck on old VERSION.)
$remoteGit = Get-RemoteVersionViaGit
$remoteHttp = Get-RemoteVersionViaHttp
$remote = ""
$remoteSrc = ""

if ($remoteGit -and $remoteHttp) {
  $cmp = Compare-VersionStrings $remoteHttp $remoteGit
  if ($cmp -ge 0) {
    # http newer or equal - prefer http when equal too (fresher path)
    if ($cmp -eq 1) {
      $remote = $remoteHttp
      $remoteSrc = "http(newer)"
    } else {
      $remote = $remoteHttp
      $remoteSrc = "http+git"
    }
  } else {
    $remote = $remoteGit
    $remoteSrc = "git(newer)"
  }
} elseif ($remoteHttp) {
  $remote = $remoteHttp
  $remoteSrc = "http"
} elseif ($remoteGit) {
  $remote = $remoteGit
  $remoteSrc = "git"
}

Write-Host "[VERSION] local=$local  remote=$remote  (git=$remoteGit http=$remoteHttp src=$remoteSrc)"

if (-not $remote) {
  Write-Host "[SKIP] Cannot read remote VERSION - start without update"
  exit 0
}

if ($local -and ($local -eq $remote)) {
  Write-Host "[SKIP] Same version ($local) - no git pull"
  exit 0
}

Write-Host "[UPDATE] Version changed ($local -> $remote). Applying source..."

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "[WARN] git not found - start with local source"
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $Root ".git"))) {
  Write-Host "[WARN] Not a git repo - start with local source"
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
  Write-Host "[WARN] git pull failed - try reset to origin/main"
  [void](Invoke-GitHost "git fetch origin main --prune")
  $resetCode = Invoke-GitHost "git reset --hard origin/main"
  if ($resetCode -ne 0) {
    Write-Host "[WARN] update failed - start with local source"
    exit 0
  }
}

$after = Get-LocalVersion
Write-Host "[OK] Source updated. VERSION=$after (was $local)"
if ($after -and $remote -and ($after -ne $remote)) {
  Write-Host "[WARN] After pull local=$after still != remote=$remote"
}
exit 0
