#Requires -Version 5.1
# Force sync local project to GitHub main (ALWAYS).
# Verifies VERSION against HTTP remote; if git fetch/reset leaves old VERSION -> ZIP.
# Writes update-last.log for diagnosis. ASCII-only (PS 5.1 safe).
$ErrorActionPreference = "Continue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}

$PreferredRoot = "D:\My_Project\Mango_Recreate_Board"
$Repo = "waterstar21g-png/Mango_Recreate_Board"

if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "VERSION.txt"))) {
  $Root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
} elseif (Test-Path -LiteralPath (Join-Path $PreferredRoot "VERSION.txt")) {
  $Root = $PreferredRoot
} else {
  $Root = if ($PSScriptRoot) { $PSScriptRoot } else { $PreferredRoot }
}

Set-Location -LiteralPath $Root
$LogPath = Join-Path $Root "update-last.log"

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Host $line
  try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch {}
}

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

function Get-RemoteVersionHttp {
  $cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $urls = @(
    "https://raw.githubusercontent.com/$Repo/main/VERSION.txt?t=$cb",
    "https://cdn.jsdelivr.net/gh/${Repo}@main/VERSION.txt?t=$cb"
  )
  foreach ($url in $urls) {
    try {
      $wc = New-Object System.Net.WebClient
      $wc.Headers.Add("User-Agent", "Mango_Recreate_Board-force-update")
      $wc.Headers.Add("Cache-Control", "no-cache")
      $wc.Encoding = [System.Text.Encoding]::UTF8
      $text = $wc.DownloadString($url)
      $v = Get-VersionFromText $text
      if ($v) {
        Write-Log "HTTP remote VERSION=$v from $url"
        return $v
      }
    } catch {
      Write-Log ("HTTP VERSION fail: " + $_.Exception.Message)
    }
  }
  return ""
}

function Invoke-GitHost([string]$GitCommandLine) {
  # Ensure ERRORLEVEL from git propagates out of cmd
  cmd.exe /c "$GitCommandLine & exit /b %ERRORLEVEL%"
  return $LASTEXITCODE
}

function Update-FromZip {
  Write-Log "ZIP overwrite from GitHub main ..."
  $zipUrl = "https://codeload.github.com/$Repo/zip/refs/heads/main"
  $zipFile = Join-Path $env:TEMP "Mango_Recreate_Board_main_force.zip"
  $extractDir = Join-Path $env:TEMP ("Mango_Recreate_Board_force_" + [Guid]::NewGuid().ToString("N"))
  try {
    if (Test-Path -LiteralPath $zipFile) { Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue }
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "Mango_Recreate_Board-force-update")
    $wc.Headers.Add("Cache-Control", "no-cache")
    $wc.DownloadFile($zipUrl, $zipFile)
    if (-not (Test-Path -LiteralPath $zipFile)) {
      Write-Log "ZIP download missing file"
      return $false
    }
    if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
    $src = Join-Path $extractDir "Mango_Recreate_Board-main"
    if (-not (Test-Path -LiteralPath $src)) {
      Write-Log "ZIP extract layout unexpected"
      return $false
    }
    # Overwrite files (keep .git if present)
    Get-ChildItem -LiteralPath $src -Force | ForEach-Object {
      $dest = Join-Path $Root $_.Name
      if ($_.PSIsContainer) {
        Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
      } else {
        Copy-Item -Path $_.FullName -Destination $dest -Force
      }
    }
    Write-Log "ZIP overwrite complete"
    return $true
  } catch {
    Write-Log ("ZIP failed: " + $_.Exception.Message)
    return $false
  } finally {
    try { if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue } } catch {}
    try { if (Test-Path -LiteralPath $zipFile) { Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue } } catch {}
  }
}

try { if (Test-Path -LiteralPath $LogPath) { Remove-Item -LiteralPath $LogPath -Force -ErrorAction SilentlyContinue } } catch {}

Write-Host "========================================"
Write-Host "  FORCE UPDATE -> GitHub main"
Write-Host "  $Root"
Write-Host "========================================"
Write-Log "root=$Root"

$before = Get-LocalVersion
$remote = Get-RemoteVersionHttp
Write-Log "before=$before remote(http)=$remote"

$gitOk = $false
$fetchCode = -1
$hasGit = [bool](Get-Command git -ErrorAction SilentlyContinue)
$isRepo = Test-Path -LiteralPath (Join-Path $Root ".git")

if ($hasGit -and $isRepo) {
  Write-Log "GIT fetch origin main"
  $fetchCode = Invoke-GitHost "git fetch origin main --prune"
  Write-Log "git fetch exit=$fetchCode"
  if ($fetchCode -ne 0) {
    Write-Log "WARN fetch failed — will force ZIP fallback"
  }

  $branch = ""
  try { $branch = (cmd.exe /c "git rev-parse --abbrev-ref HEAD 2>NUL").Trim() } catch {}
  Write-Log "branch=$branch"
  if ($branch -and ($branch -ne "main")) {
    Write-Log "checkout -f main"
    [void](Invoke-GitHost "git checkout -f main")
  }

  Write-Log "reset --hard origin/main"
  $resetCode = Invoke-GitHost "git reset --hard origin/main"
  Write-Log "git reset exit=$resetCode"
  if ($resetCode -eq 0) {
    $gitOk = $true
  } else {
    Write-Log "pull origin main (reset failed)"
    $pullCode = Invoke-GitHost "git pull origin main"
    Write-Log "git pull exit=$pullCode"
    if ($pullCode -eq 0) { $gitOk = $true }
  }
} else {
  Write-Log "git/repo unavailable — ZIP path"
}

$afterGit = Get-LocalVersion
Write-Log "after git local=$afterGit gitOk=$gitOk"

# Prefer ZIP when git did not truly refresh to remote VERSION
$needZip = $false
$fetchFailed = ($hasGit -and $isRepo -and ($fetchCode -ne 0))

if (-not $gitOk) {
  Write-Log "need ZIP: git path failed"
  $needZip = $true
} elseif ($remote -and $afterGit -and ($afterGit -ne $remote)) {
  Write-Log "need ZIP: VERSION still behind remote after git ($afterGit vs $remote)"
  $needZip = $true
} elseif ($remote -and (-not $afterGit)) {
  Write-Log "need ZIP: local VERSION missing after git"
  $needZip = $true
} elseif ($fetchFailed) {
  # fetch failed + reset on stale origin/main looks "OK" but VERSION unchanged
  Write-Log "need ZIP: git fetch failed (stale origin risk)"
  $needZip = $true
} elseif (-not $remote) {
  # cannot verify via HTTP — force ZIP overwrite as source of truth
  Write-Log "need ZIP: remote HTTP VERSION unknown — overwrite from ZIP"
  $needZip = $true
}

if ($needZip) {
  if (Update-FromZip) {
    $gitOk = $true
  } else {
    $gitOk = $false
  }
}

$after = Get-LocalVersion
Write-Log "FINAL before=$before after=$after remote=$remote"

Write-Host ""
Write-Host "----------------------------------------"
Write-Host ("  BEFORE : v{0}" -f $(if ($before) { $before } else { "?" }))
Write-Host ("  AFTER  : v{0}" -f $(if ($after) { $after } else { "?" }))
Write-Host ("  REMOTE : v{0}" -f $(if ($remote) { $remote } else { "?" }))
Write-Host ("  LOG    : {0}" -f $LogPath)
Write-Host "----------------------------------------"

if ($after -and ((-not $remote) -or ($after -eq $remote))) {
  Write-Host ("[DONE] Force update OK: v{0}" -f $after) -ForegroundColor Green
  Write-Log "DONE OK v$after"
  exit 0
}

if ($after -and $before -and ($after -ne $before)) {
  Write-Host ("[DONE] Updated locally v{0} -> v{1} (remote check skipped/mismatch)" -f $before, $after) -ForegroundColor Yellow
  Write-Log "DONE partial v$before -> v$after"
  exit 0
}

Write-Host "[FAIL] Force update failed — see update-last.log" -ForegroundColor Red
Write-Log "FAIL"
exit 1
