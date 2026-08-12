#Requires -Version 5.1
# Recreate desktop + taskbar shortcuts for AI_Program_Main_Board.
# Target chain: start.bat -> boot-from-icon.ps1 (stop + update + board restart)
# ASCII-only (PS 5.1 safe)
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$LnkName = "AI_Program_Main_Board.lnk"
# ★요건: 머지·버전갱신 전용 바탕화면 아이콘 (보드와 분리)
$UpdateLnkName = "AI_보드_버전갱신.lnk"
$IconDll = "$env:SystemRoot\System32\imageres.dll"
$IconIndex = 109
$UpdateIconIndex = 23

function Resolve-ProjectRoot {
  if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
    return (Resolve-Path -LiteralPath $PSScriptRoot).Path
  }
  if (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
    return $PreferredRoot
  }
  throw "run.bat not found. Expected: $PreferredRoot or script folder."
}

function Remove-OldShortcuts {
  param([string[]]$Folders)
  foreach ($folder in $Folders) {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { continue }
    Get-ChildItem -LiteralPath $folder -Filter "AI_Program*.lnk" -ErrorAction SilentlyContinue |
      ForEach-Object {
        Write-Host "[DEL] $($_.FullName)"
        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
      }
    $exact = Join-Path $folder $LnkName
    if (Test-Path -LiteralPath $exact) {
      Write-Host "[DEL] $exact"
      Remove-Item -LiteralPath $exact -Force -ErrorAction SilentlyContinue
    }
  }
}

function New-BoardShortcut {
  param(
    [string]$LnkPath,
    [string]$ProjectRoot,
    [string]$StartBat,
    [string]$BootPs1
  )
  $w = New-Object -ComObject WScript.Shell
  $sc = $w.CreateShortcut($LnkPath)
  if (Test-Path -LiteralPath $StartBat) {
    $sc.TargetPath = $StartBat
    $sc.Arguments = ""
    $chain = "start.bat -> boot-from-icon.ps1"
  } elseif (Test-Path -LiteralPath $BootPs1) {
    $psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $sc.TargetPath = $psExe
    $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$BootPs1`""
    $chain = "boot-from-icon.ps1"
  } else {
    $sc.TargetPath = Join-Path $ProjectRoot "run.bat"
    $sc.Arguments = ""
    $chain = "run.bat (legacy)"
  }
  $sc.WorkingDirectory = $ProjectRoot
  $sc.WindowStyle = 1
  $sc.Description = "AI_Program_Main_Board v2 stop+update+restart"
  if (Test-Path -LiteralPath $IconDll) {
    $sc.IconLocation = "$IconDll,$IconIndex"
  } else {
    $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,16"
  }
  $sc.Save()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sc) | Out-Null
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($w) | Out-Null
  return $chain
}

function New-UpdateShortcut {
  param(
    [string]$LnkPath,
    [string]$ProjectRoot
  )
  $updateBatKo = Join-Path $ProjectRoot "버전갱신.bat"
  $updateBatEn = Join-Path $ProjectRoot "update-version.bat"
  $target = $null
  if (Test-Path -LiteralPath $updateBatKo) { $target = $updateBatKo }
  elseif (Test-Path -LiteralPath $updateBatEn) { $target = $updateBatEn }
  else { throw "버전갱신.bat / update-version.bat not found" }

  $w = New-Object -ComObject WScript.Shell
  $sc = $w.CreateShortcut($LnkPath)
  $sc.TargetPath = $target
  $sc.Arguments = ""
  $sc.WorkingDirectory = $ProjectRoot
  $sc.WindowStyle = 1
  $sc.Description = "Merge+force VERSION update from GitHub main, then start board"
  if (Test-Path -LiteralPath $IconDll) {
    $sc.IconLocation = "$IconDll,$UpdateIconIndex"
  } else {
    $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,18"
  }
  $sc.Save()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sc) | Out-Null
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($w) | Out-Null
  return $target
}

try {
  $root = Resolve-ProjectRoot
  $startBat = Join-Path $root "start.bat"
  $bootPs1 = Join-Path $root "boot-from-icon.ps1"

  Write-Host "========================================"
  Write-Host "  Refresh icons: AI_Program_Main_Board"
  Write-Host "  Project: $root"
  Write-Host "========================================"

  $desktop = [Environment]::GetFolderPath("Desktop")
  $taskPin = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
  $startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "AI_Program_Main_Board"
  if (-not (Test-Path -LiteralPath $startMenu)) {
    New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
  }

  Remove-OldShortcuts @($desktop, $taskPin, $startMenu)
  # also remove previous update shortcut name
  foreach ($folder in @($desktop, $taskPin, $startMenu)) {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { continue }
    $oldUp = Join-Path $folder $UpdateLnkName
    if (Test-Path -LiteralPath $oldUp) {
      Remove-Item -LiteralPath $oldUp -Force -ErrorAction SilentlyContinue
    }
  }

  $desktopLnk = Join-Path $desktop $LnkName
  $taskLnk = Join-Path $taskPin $LnkName
  $menuLnk = Join-Path $startMenu $LnkName
  $desktopUpdateLnk = Join-Path $desktop $UpdateLnkName

  $chain = New-BoardShortcut -LnkPath $desktopLnk -ProjectRoot $root -StartBat $startBat -BootPs1 $bootPs1
  Write-Host "[OK] Desktop : $desktopLnk"
  Write-Host "     Chain   : $chain"

  $updTarget = New-UpdateShortcut -LnkPath $desktopUpdateLnk -ProjectRoot $root
  Write-Host "[OK] Desktop : $desktopUpdateLnk"
  Write-Host "     Target  : $updTarget  (머지·버전갱신 전용)"

  if (-not (Test-Path -LiteralPath $taskPin)) {
    New-Item -ItemType Directory -Force -Path $taskPin | Out-Null
  }
  Copy-Item -LiteralPath $desktopLnk -Destination $taskLnk -Force
  Write-Host "[OK] Taskbar : $taskLnk (copied)"

  Copy-Item -LiteralPath $desktopLnk -Destination $menuLnk -Force
  Write-Host "[OK] Start menu: $menuLnk"

  # Verify shortcut target
  $verify = $w2 = New-Object -ComObject WScript.Shell
  $opened = $verify.CreateShortcut($desktopLnk)
  Write-Host ""
  Write-Host "[VERIFY] TargetPath = $($opened.TargetPath)"
  Write-Host "[VERIFY] Arguments  = $($opened.Arguments)"
  Write-Host "[VERIFY] WorkDir    = $($opened.WorkingDirectory)"
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($opened) | Out-Null
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($verify) | Out-Null

  Write-Host ""
  Write-Host "[DONE] New desktop + taskbar icons created." -ForegroundColor Green
  Write-Host "  - Remove OLD taskbar pin manually if duplicate icon remains."
  Write-Host "  - Pin fresh desktop icon to taskbar if needed (right-click)."
  Write-Host ""
  exit 0
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
