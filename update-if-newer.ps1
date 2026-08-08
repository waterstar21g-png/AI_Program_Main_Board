#Requires -Version 5.1
# Icon / run.bat updater:
#   - Compare local VERSION vs GitHub main
#   - If different: git pull origin main (reset hard on failure)
#   - If git still fails: ZIP overwrite from codeload (same as update-by-zip.bat)
# ASCII-only (PS 5.1 safe). Called by run.bat / boot-from-icon.ps1.
$ErrorActionPreference = "Continue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}

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
  $cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $selfUrls = @(
    "https://raw.githubusercontent.com/$Repo/main/update-if-newer.ps1?t=$cb",
    "https://cdn.jsdelivr.net/gh/$Repo@main/update-if-newer.ps1?t=$cb"
  )
  $lastErr = $null
  foreach ($url in $selfUrls) {
    try {
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
      $lastErr = $_.Exception.Message
      Start-Sleep -Milliseconds 300
    }
  }
  if ($lastErr) {
    Write-Host "[WARN] updater self-refresh skipped (local copy used): $lastErr"
  }
}

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

function Update-FromZip {
  # Same effect as update-by-zip.bat, but do NOT start the board (caller starts it).
  Write-Host "[ZIP] git failed or incomplete - forcing ZIP overwrite from GitHub main ..."
  $zipUrl = "https://codeload.github.com/$Repo/zip/refs/heads/main"
  $zipFile = Join-Path $env:TEMP "AI_Program_Main_Board_main_auto.zip"
  $extractDir = Join-Path $env:TEMP ("AI_Program_Main_Board_extract_" + [Guid]::NewGuid().ToString("N"))
  try {
    if (Test-Path -LiteralPath $zipFile) { Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue }
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "AI_Program_Main_Board-zip-fallback")
    $wc.Headers.Add("Cache-Control", "no-cache")
    $wc.DownloadFile($zipUrl, $zipFile)
    if (-not (Test-Path -LiteralPath $zipFile)) {
      Write-Host "[WARN] ZIP download failed"
      return $false
    }
    if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
    $src = Join-Path $extractDir "AI_Program_Main_Board-main"
    if (-not (Test-Path -LiteralPath $src)) {
      Write-Host "[WARN] ZIP extract layout unexpected"
      return $false
    }
    # Overwrite project files; local-only paths (.gitignore) usually absent from ZIP
    Copy-Item -Path (Join-Path $src "*") -Destination $Root -Recurse -Force
    Write-Host "[OK] ZIP overwrite complete"
    return $true
  } catch {
    Write-Host "[WARN] ZIP update failed: $($_.Exception.Message)"
    return $false
  } finally {
    try { if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue } } catch {}
    try { if (Test-Path -LiteralPath $zipFile) { Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue } } catch {}
  }
}

Write-Host "[VERSION-CHECK] root=$Root"

$local = Get-LocalVersion

# Always check BOTH git and HTTP; use the newer one.
$remoteGit = Get-RemoteVersionViaGit
$remoteHttp = Get-RemoteVersionViaHttp
$remote = ""
$remoteSrc = ""

if ($remoteGit -and $remoteHttp) {
  $cmp = Compare-VersionStrings $remoteHttp $remoteGit
  if ($cmp -ge 0) {
    $remote = $remoteHttp
    $remoteSrc = if ($cmp -eq 1) { "http(newer)" } else { "http+git" }
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
  Write-Host "[SKIP] Same version ($local) - no update needed"
  exit 0
}

Write-Host "[UPDATE] Version changed ($local -> $remote). Applying source..."

$updated = $false

# 1) Prefer git pull / hard reset to origin/main
$hasGit = [bool](Get-Command git -ErrorAction SilentlyContinue)
$isRepo = Test-Path -LiteralPath (Join-Path $Root ".git")
if ($hasGit -and $isRepo) {
  $branch = ""
  try {
    $branch = (cmd.exe /c "git rev-parse --abbrev-ref HEAD 2>NUL").Trim()
  } catch {}
  if ($branch -and ($branch -ne "main")) {
    Write-Host "[INFO] checkout main (was: $branch)"
    [void](Invoke-GitHost "git checkout -f main")
  }

  $pullCode = Invoke-GitHost "git pull origin main"
  if ($pullCode -ne 0) {
    Write-Host "[WARN] git pull failed - try reset to origin/main"
    [void](Invoke-GitHost "git fetch origin main --prune")
    $resetCode = Invoke-GitHost "git reset --hard origin/main"
    if ($resetCode -eq 0) {
      $updated = $true
    }
  } else {
    $updated = $true
  }
} else {
  Write-Host "[WARN] git/repo unavailable - will try ZIP"
}

# 2) Verify VERSION after git; if still behind remote -> ZIP force
$afterGit = Get-LocalVersion
if ($updated -and $afterGit -and $remote -and ($afterGit -eq $remote)) {
  Write-Host "[OK] Source updated via git. VERSION=$afterGit (was $local)"
  exit 2
}

Write-Host "[WARN] git path incomplete (local=$afterGit remote=$remote) - ZIP fallback"

# 3) ZIP fallback (git blocked / incomplete)
if (Update-FromZip) {
  $afterZip = Get-LocalVersion
  Write-Host "[OK] Source updated via ZIP. VERSION=$afterZip (was $local)"
  if ($afterZip -and $remote -and ($afterZip -ne $remote)) {
    Write-Host "[WARN] After ZIP local=$afterZip still != remote=$remote"
  }
  exit 2
}

Write-Host "[WARN] update failed - start with local source"
exit 0
