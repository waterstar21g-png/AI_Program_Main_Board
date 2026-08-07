# AI_Program_Main_Board - run.ps1
# 평소: .\run.ps1          (동기화 생략, 바로 실행)
# 업데이트: .\run.ps1 -Sync (GitHub에서 전체 받기)
param([switch]$Sync, [switch]$Clean)

$ErrorActionPreference = "Stop"
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

if ($PSScriptRoot -match 'OneDrive') {
  Write-Host ""
  Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
  Write-Host "  컴파일이 느린 1순위 원인: OneDrive 경로" -ForegroundColor Red
  Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
  Write-Host "  $PSScriptRoot" -ForegroundColor Yellow
  Write-Host "  기능을 아무리 줄여도 OneDrive가 node_modules를 감시하면" -ForegroundColor Yellow
  Write-Host "  컴파일이 26분+ 걸릴 수 있습니다. (이미 관측됨)" -ForegroundColor Yellow
  Write-Host "  → 폴더를 C:\Projects\AI_Program_Main_Board 로 옮기세요." -ForegroundColor Cyan
  Write-Host "  → 또는: powershell -File scripts\windows-speed-fix.ps1" -ForegroundColor Cyan
  Write-Host "  (보드 UI 없이 수집만 하면: python-collector\run.bat = 컴파일 0초)" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Enter = 그래도 계속 / Ctrl+C = 중단" -ForegroundColor Gray
  Read-Host | Out-Null
}

$Repo = "waterstar21g-png/AI_Program_Main_Board"
$ExpectedVersion = "3.4.0"
$TargetVersion = $ExpectedVersion
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Sha = "main"

function Get-LocalAppVersion {
  if (-not (Test-Path "lib\app-version.ts")) { return "" }
  $raw = Get-Content "lib\app-version.ts" -Raw
  if ($raw -match "APP_VERSION\s*=\s*'([^']+)'") { return $Matches[1] }
  return ""
}

function Get-MainCommitSha {
  # API는 403(한도) 자주 남 → 실패하면 브랜치 이름으로 raw 다운로드
  try {
    $meta = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/main?t=$cb" -Headers @{
      "User-Agent"    = "AI_Program_Main_Board-run.ps1"
      "Cache-Control" = "no-cache"
    }
    if ($meta.sha -and $meta.sha -match '^[0-9a-f]{7,40}$') { return $meta.sha }
  } catch {
    Write-Host "[INFO] commits API unavailable — use branch main (raw)"
  }
  return "main"
}

function Download-RepoFile([string]$LocalPath, [string]$RepoPath) {
  $dir = Split-Path -Parent $LocalPath
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $tmp = "$LocalPath.download"
  $rel = $RepoPath -replace '\\', '/'
  # raw CDN 우선 (API는 403 한도)
  $urls = @(
    "https://raw.githubusercontent.com/$Repo/$Sha/$rel`?t=$cb",
    "https://cdn.jsdelivr.net/gh/${Repo}@$Sha/$rel"
  )
  $lastErr = $null
  foreach ($url in $urls) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -Headers @{
        "User-Agent"    = "AI_Program_Main_Board-run.ps1"
        "Cache-Control" = "no-cache"
      }
      $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $tmp))
      if ($bytes.Length -lt 5) { throw "empty download" }
      $head = [System.Text.Encoding]::UTF8.GetString($bytes, 0, [Math]::Min(40, $bytes.Length))
      if ($head -match '^\s*\{\s*"message"') { throw "API error json" }
      Move-Item -Force $tmp $LocalPath
      return
    } catch {
      $lastErr = $_
      Remove-Item -Force $tmp -ErrorAction SilentlyContinue
    }
  }
  throw $lastErr
}

function Ensure-ShortcutOnLocal {
  # 로컬 폴더에 바로가기 스크립트 확보 + 바탕화면 AI_Program_Main_Board.lnk 생성
  foreach ($pair in @(
      @("make-shortcut.bat", "make-shortcut.bat"),
      @("바로가기만들기.bat", "바로가기만들기.bat"),
      @("create-shortcut.ps1", "create-shortcut.ps1")
    )) {
    if (-not (Test-Path -LiteralPath $pair[0])) {
      try {
        Download-RepoFile $pair[0] $pair[1]
        Write-Host "[OK] $($pair[0]) 로컬에 받음"
      } catch {
        Write-Host "[WARN] $($pair[0]) 다운로드 실패 — $($_.Exception.Message)"
      }
    }
  }

  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) { return }
  $lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"
  $target = Join-Path $PSScriptRoot "run.bat"
  if (-not (Test-Path -LiteralPath $target)) { return }
  try {
    $w = New-Object -ComObject WScript.Shell
    $sc = $w.CreateShortcut($lnkPath)
    $sc.TargetPath = $target
    $sc.WorkingDirectory = $PSScriptRoot
    $sc.WindowStyle = 1
    $sc.Description = "AI_Program_Main_Board — 보드 실행 (P1/P2/P3)"
    $sc.Save()
    Write-Host "[OK] 바탕화면 바로가기: $lnkPath"
  } catch {
    Write-Host "[WARN] 바탕화면 바로가기 실패 — $($_.Exception.Message)"
  }
}

Write-Host "========================================"
Write-Host "  AI_Program_Main_Board  v$ExpectedVersion"
Write-Host "========================================"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

$localVer = Get-LocalAppVersion
$skipSync = (-not $Sync) -and ($localVer -eq $ExpectedVersion) -and (Test-Path "node_modules")

if ($skipSync) {
  $TargetVersion = $localVer
  Write-Host "[SKIP] sync — local v$localVer OK (update: .\run.ps1 -Sync)"
} else {
  $Sha = Get-MainCommitSha
  Write-Host "  sync sha: $Sha"
  Write-Host "[SYNC] GitHub download..."

  $files = @(
    @("lib\product-data-collect\browser-session.ts", "lib/product-data-collect/browser-session.ts"),
    @("lib\product-data-collect\screen-state.ts", "lib/product-data-collect/screen-state.ts"),
    @("lib\product-data-collect\runner.ts", "lib/product-data-collect/runner.ts"),
    @("lib\product-data-collect\steps.ts", "lib/product-data-collect/steps.ts"),
    @("lib\product-data-collect\types.ts", "lib/product-data-collect/types.ts"),
    @("lib\product-data-collect\excel-import.ts", "lib/product-data-collect/excel-import.ts"),
    @("lib\excel-export.ts", "lib/excel-export.ts"),
    @("lib\top-final-label.ts", "lib/top-final-label.ts"),
    @("lib\project-smoke\run.ts", "lib/project-smoke/run.ts"),
    @("lib\board-actions\run.ts", "lib/board-actions/run.ts"),
    @("components\ProgramBoardApp.tsx", "components/ProgramBoardApp.tsx"),
    @("components\BoardCommandPanel.tsx", "components/BoardCommandPanel.tsx"),
    @("components\CategoryExtractorApp.tsx", "components/CategoryExtractorApp.tsx"),
    @("components\ProductDataCollectApp.tsx", "components/ProductDataCollectApp.tsx"),
    @("components\PythonItemCollectorApp.tsx", "components/PythonItemCollectorApp.tsx"),
    @("next.config.ts", "next.config.ts"),
    @("tsconfig.json", "tsconfig.json"),
    @("scripts\windows-speed-fix.ps1", "scripts/windows-speed-fix.ps1"),
    @("app\layout.tsx", "app/layout.tsx"),
    @("app\globals.css", "app/globals.css"),
    @("lib\programs\registry.tsx", "lib/programs/registry.tsx"),
    @("lib\app-version.ts", "lib/app-version.ts"),
    @("package.json", "package.json"),
    @("scripts\next-dev-safe.mjs", "scripts/next-dev-safe.mjs"),
    @("scripts\clean-next.mjs", "scripts/clean-next.mjs"),
    @("scripts\verify-projects.mjs", "scripts/verify-projects.mjs"),
    @("scripts\run-p1.mjs", "scripts/run-p1.mjs"),
    @("scripts\run-p2.mjs", "scripts/run-p2.mjs"),
    @("scripts\run-p3.mjs", "scripts/run-p3.mjs"),
    @("scripts\COMMANDS.txt", "scripts/COMMANDS.txt"),
    @("app\api\product-collect\run\route.ts", "app/api/product-collect/run/route.ts"),
    @("app\api\product-collect\open\route.ts", "app/api/product-collect/open/route.ts"),
    @("app\api\board-actions\route.ts", "app/api/board-actions/route.ts"),
    @("app\api\project-test\route.ts", "app/api/project-test/route.ts"),
    @("run.ps1", "run.ps1"),
    @("run.bat", "run.bat"),
    @("verify.ps1", "verify.ps1"),
    @("verify.bat", "verify.bat"),
    @("p1.bat", "p1.bat"),
    @("p2.bat", "p2.bat"),
    @("p3.bat", "p3.bat"),
    @("make-shortcut.bat", "make-shortcut.bat"),
    @("create-shortcut.ps1", "create-shortcut.ps1"),
    @("바로가기만들기.bat", "바로가기만들기.bat")
  )

  $failed = @()
  foreach ($f in $files) {
    try {
      Download-RepoFile $f[0] $f[1]
      Write-Host "  OK $($f[0])"
    } catch {
      Write-Host "  FAIL $($f[0]) - $($_.Exception.Message)"
      $failed += $f[0]
    }
  }

  if ($failed.Count -gt 0) {
    Write-Host "[FATAL] sync failed: $($failed -join ', ')"
    Read-Host "Press Enter"
    exit 1
  }

  $TargetVersion = Get-LocalAppVersion
  Write-Host "[CHECK] APP_VERSION = $TargetVersion"

  if ($TargetVersion -ne $ExpectedVersion) {
    # Sync로 run.ps1이 갱신된 경우 — 새 스크립트로 다시 실행
    Write-Host "[INFO] version updated ($ExpectedVersion → $TargetVersion). re-launch run.ps1 ..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1") @PSBoundParameters
    exit $LASTEXITCODE
  }
}

# 로컬 폴더에 바로가기만들기.bat 확보 + 바탕화면 바로가기 생성
Ensure-ShortcutOnLocal

$prevVer = ""
if (Test-Path "VERSION.txt") {
  $prevRaw = Get-Content "VERSION.txt" -Raw
  if ($prevRaw -match '([\d.]+)') { $prevVer = $Matches[1] }
}
"version $TargetVersion" | Out-File -FilePath "VERSION.txt" -Encoding utf8

Write-Host "[STOP] kill port 3000..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-Process -Name node -ErrorAction SilentlyContinue |
  ForEach-Object {
    try {
      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
      if ($cmd -match 'next') { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    } catch {}
  }
Start-Sleep -Seconds 2

if (-not (Test-Path "node_modules")) {
  Write-Host "[INSTALL] npm install..."
  npm install
}

# 버전이 바뀌었다고 매번 캐시를 지우면 Windows에서 콜드 컴파일이
# (백신 실시간 검사까지 겹치면) 몇 분씩 걸려 "멈춘 것처럼" 보인다.
# webpack 자체 캐시가 파일 변경을 알아서 추적하므로 평소엔 그냥 둔다.
# 화면이 이상하거나 깨진 것 같을 때만 .\run.ps1 -Clean 으로 수동 정리.
if ($Clean) {
  Write-Host "[CLEAN] -Clean 지정 — .next/.next-dev 삭제 (다음 실행은 콜드 컴파일)"
  Remove-Item -Recurse -Force ".next", ".next-dev" -ErrorAction SilentlyContinue
} else {
  Write-Host "[CACHE] .next-dev 유지 (문제 있으면 .\run.ps1 -Clean)"
}

Write-Host ""
Write-Host "  VERSION: $TargetVersion"
Write-Host "  http://localhost:3000"
Write-Host ""

# npm run dev를 백그라운드로 띄우고, 포트 3000이 실제로 열릴 때까지
# 기다린 뒤에 브라우저를 연다. (먼저 브라우저부터 열면 서버가 아직
# 안 떠서 "연결할 수 없음 / ERR_CONNECTION_REFUSED"가 뜬다.)
Write-Host "[START] npm run dev ..."
Write-Host "  (첫 컴파일은 Windows 백신 검사까지 겹치면 오래 걸릴 수 있습니다."
Write-Host "   작업관리자에서 node.exe가 CPU를 쓰고 있으면 진행 중인 것입니다."
Write-Host "   '✓ Compiled / in Ns' 가 뜨면 끝난 것입니다."
Write-Host "   계속 느리면: Windows 보안 > 바이러스 및 위협 방지 > 제외 추가"
Write-Host "   에 이 폴더($PSScriptRoot)를 등록하면 훨씬 빨라집니다.)"
$devProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -NoNewWindow -PassThru

$ready = $false
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Milliseconds 500
  if ($devProc.HasExited) {
    Write-Host "[FATAL] npm run dev 가 예기치 않게 종료됨 (exit code $($devProc.ExitCode))"
    break
  }
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 3000)
    $ready = $tcp.Connected
    $tcp.Close()
  } catch {
    $ready = $false
  }
  if ($ready) { break }
}

if ($ready) {
  Write-Host "[READY] http://localhost:3000"
  Start-Process "http://localhost:3000"
} elseif (-not $devProc.HasExited) {
  Write-Host "[WARN] 60초 안에 3000 포트가 응답하지 않았습니다."
  Write-Host "       브라우저를 자동으로 열지 않았으니, 잠시 후 직접 http://localhost:3000 을 열어보세요."
}

Wait-Process -Id $devProc.Id -ErrorAction SilentlyContinue
