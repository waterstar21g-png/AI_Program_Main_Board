#Requires -Version 5.1
# Desktop / taskbar icon entry (single chain):
#   1) Stop previous board (if running)
#   2) Refresh helper scripts from GitHub main
#   3) update-if-newer.ps1  -> git pull origin main when VERSION changed
#   4) run.bat --noupdate    -> pip + board restart
# ASCII-only (PS 5.1 safe)
$ErrorActionPreference = "Continue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $Root = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $Root = $PreferredRoot
} else {
  $Root = $PreferredRoot
}

if (-not (Test-Path -LiteralPath $Root)) {
  Write-Host "[ERROR] Project folder not found: $Root" -ForegroundColor Red
  Read-Host "Press Enter"
  exit 1
}

Set-Location -LiteralPath $Root
$Repo = "waterstar21g-png/AI_Program_Main_Board"
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  icon boot"
Write-Host "  $Root"
Write-Host "========================================"

function Get-VersionLabel {
  $p = Join-Path $Root "VERSION.txt"
  if (-not (Test-Path -LiteralPath $p)) { return "?" }
  try {
    $raw = Get-Content -LiteralPath $p -Raw -ErrorAction Stop
    if ($raw -match '(?m)(?:버전|version)\s*([0-9]+(?:\.[0-9]+)+)') {
      return $Matches[1]
    }
    if ($raw -match '([0-9]+\.[0-9]+\.[0-9]+)') {
      return $Matches[1]
    }
  } catch {}
  return "?"
}

# 1) Stop previous board so restart always loads updated source
$stopScript = Join-Path $Root "stop-board.ps1"
if (Test-Path -LiteralPath $stopScript) {
  Write-Host "[BOOT] Stopping previous board (if any)..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $stopScript
} else {
  Write-Host "[WARN] stop-board.ps1 missing — skip stop" -ForegroundColor Yellow
}

# 2) Refresh boot helpers from GitHub main (no cache)
# - raw.githubusercontent.com 이 일부 PC(사내망/백신 SSL검사 등)에서 간헐적으로
#   막히는 사례가 있어, 재시도 + jsdelivr 미러 백업을 둔다.
# - 실패해도 로컬 캐시 파일로 계속 진행되므로(치명적 아님) 경고는 한 줄로 요약한다.
function Get-RemoteFile($Name, $DestPath, $CacheBust) {
  $rawUrl = "https://raw.githubusercontent.com/$Repo/main/$Name`?t=$CacheBust"
  $mirrorUrl = "https://cdn.jsdelivr.net/gh/$Repo@main/$Name`?t=$CacheBust"
  # raw.githubusercontent.com 1차 시도(2회, 일시적 네트워크 오류 대비) 후
  # jsdelivr 미러(다른 CDN)로 최종 폴백.
  $candidates = @($rawUrl, $rawUrl, $mirrorUrl)
  $lastErr = $null
  foreach ($url in $candidates) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $DestPath -UseBasicParsing -TimeoutSec 15 -Headers @{
        "User-Agent"    = "AI_Program_Main_Board-boot-from-icon"
        "Cache-Control" = "no-cache"
      }
      return $true
    } catch {
      $lastErr = $_.Exception.Message
      Start-Sleep -Milliseconds 300
    }
  }
  Write-Host "    (detail) $Name : $lastErr" -ForegroundColor DarkYellow
  return $false
}

$refreshNames = @(
  "update-if-newer.ps1",
  "boot-from-icon.ps1",
  "stop-board.ps1",
  "refresh-icons.ps1",
  "start.bat",
  "run.bat"
)
Write-Host "[BOOT] Refresh scripts from GitHub main..."
$refreshOk = 0
$refreshFailed = @()
foreach ($name in $refreshNames) {
  $dest = Join-Path $Root $name
  if (Get-RemoteFile -Name $name -DestPath $dest -CacheBust $cb) {
    $refreshOk++
  } else {
    $refreshFailed += $name
  }
}
if ($refreshFailed.Count -eq 0) {
  Write-Host "  [OK] 스크립트 전체 갱신 완료 ($refreshOk/$($refreshNames.Count))"
} else {
  Write-Host "  [WARN] 일부 스크립트 갱신 실패($($refreshFailed.Count)/$($refreshNames.Count)) - 기존 로컬 파일로 계속 진행 (동작에는 영향 없음): $($refreshFailed -join ', ')" -ForegroundColor Yellow
}

$beforeVer = Get-VersionLabel
Write-Host "[BOOT] Local VERSION (before update) = $beforeVer"

# 3) Version check + git pull origin main when remote VERSION is newer
$updater = Join-Path $Root "update-if-newer.ps1"
$updateExit = 0
if (Test-Path -LiteralPath $updater) {
  Write-Host "[BOOT] Running update-if-newer.ps1 ..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $updater
  $updateExit = $LASTEXITCODE
  if ($null -eq $updateExit) { $updateExit = 0 }
} else {
  Write-Host "[WARN] update-if-newer.ps1 missing — skip update" -ForegroundColor Yellow
}

$afterVer = Get-VersionLabel
Write-Host "[BOOT] Local VERSION (after update)  = $afterVer"

if ($updateExit -eq 2) {
  Write-Host "[BOOT] Source updated ($beforeVer -> $afterVer)" -ForegroundColor Green
} elseif ($beforeVer -eq $afterVer) {
  Write-Host "[BOOT] Already up to date (VERSION $afterVer)" -ForegroundColor Cyan
}

# 4) Start board (pip + python board\app.py) — no duplicate update pass
$runBat = Join-Path $Root "run.bat"
if (-not (Test-Path -LiteralPath $runBat)) {
  Write-Host "[ERROR] run.bat not found: $runBat" -ForegroundColor Red
  Read-Host "Press Enter"
  exit 1
}

Write-Host "[BOOT] Starting board (run.bat --noupdate)..."
& cmd.exe /c "`"$runBat`" --noupdate"
exit $LASTEXITCODE
