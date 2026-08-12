#Requires -Version 5.1
# Recreate desktop + taskbar shortcuts for AI_Program_Main_Board.
# IMPORTANT: keep this file ASCII-only (PS 5.1 + UTF8-no-BOM safe on KR Windows).
# Korean display names are built from [char] codepoints at runtime.
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$LnkName = "AI_Program_Main_Board.lnk"
# Korean update shortcut name built from codepoints below
$UpdateLnkName = (
  "AI_" +
  [string]([char]0xBCF4) + [string]([char]0xB4DC) + "_" +
  [string]([char]0xBC84) + [string]([char]0xC804) +
  [string]([char]0xAC31) + [string]([char]0xC2E0) +
  ".lnk"
)
$UpdateLnkNameAscii = "AI_Board_Update.lnk"
$IconDll = "$env:SystemRoot\System32\imageres.dll"
$IconIndex = 109
$UpdateIconIndex = 23

function Write-IconLog([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Host $line
  try {
    $log = Join-Path $script:Root "icon-last.log"
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
  } catch {}
}

function Resolve-ProjectRoot {
  if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
    return (Resolve-Path -LiteralPath $PSScriptRoot).Path
  }
  if (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
    return $PreferredRoot
  }
  throw "run.bat not found. Expected: $PreferredRoot or script folder."
}

function Get-DesktopDirs {
  $list = New-Object System.Collections.Generic.List[string]
  # Korean localized Desktop folder name via codepoints
  $koDesktop = (
    [string]([char]0xBC14) + [string]([char]0xD0D5) + " " +
    [string]([char]0xD654) + [string]([char]0xBA74)
  )
  $candidates = @(
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("CommonDesktopDirectory"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE $koDesktop),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
    (Join-Path $env:USERPROFILE ("OneDrive\" + $koDesktop)),
    (Join-Path $env:USERPROFILE "OneDrive - Personal\Desktop"),
    (Join-Path $env:USERPROFILE ("OneDrive - Personal\" + $koDesktop)),
    (Join-Path $env:OneDrive "Desktop"),
    (Join-Path $env:OneDrive $koDesktop)
  )
  foreach ($p in $candidates) {
    if (-not $p) { continue }
    try {
      if (-not (Test-Path -LiteralPath $p)) { continue }
      $full = (Resolve-Path -LiteralPath $p).Path
      if (-not $list.Contains($full)) { [void]$list.Add($full) }
    } catch {}
  }
  return $list
}

function Remove-NamedShortcuts {
  param(
    [string[]]$Folders,
    [string[]]$Names
  )
  foreach ($folder in $Folders) {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { continue }
    foreach ($name in $Names) {
      $exact = Join-Path $folder $name
      if (Test-Path -LiteralPath $exact) {
        Write-IconLog ("DEL " + $exact)
        Remove-Item -LiteralPath $exact -Force -ErrorAction SilentlyContinue
      }
    }
    Get-ChildItem -LiteralPath $folder -Filter "AI_Program*.lnk" -ErrorAction SilentlyContinue |
      ForEach-Object {
        Write-IconLog ("DEL " + $_.FullName)
        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
      }
  }
}

function New-LnkFile {
  param(
    [string]$LnkPath,
    [string]$TargetPath,
    [string]$Arguments,
    [string]$WorkDir,
    [string]$Description,
    [int]$IconIndexUse
  )
  $w = New-Object -ComObject WScript.Shell
  try {
    $sc = $w.CreateShortcut($LnkPath)
    $sc.TargetPath = $TargetPath
    $sc.Arguments = $Arguments
    $sc.WorkingDirectory = $WorkDir
    $sc.WindowStyle = 1
    $sc.Description = $Description
    if (Test-Path -LiteralPath $IconDll) {
      $sc.IconLocation = "$IconDll,$IconIndexUse"
    } else {
      $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,16"
    }
    $sc.Save()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sc) | Out-Null
  } finally {
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($w) | Out-Null
  }
  if (-not (Test-Path -LiteralPath $LnkPath)) {
    throw ("shortcut not created: " + $LnkPath)
  }
}

function New-BoardShortcut {
  param(
    [string]$LnkPath,
    [string]$ProjectRoot,
    [string]$StartBat,
    [string]$BootPs1
  )
  $args = ""
  if (Test-Path -LiteralPath $StartBat) {
    $target = $StartBat
    $chain = "start.bat -> boot-from-icon.ps1"
  } elseif (Test-Path -LiteralPath $BootPs1) {
    $target = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $args = "-NoProfile -ExecutionPolicy Bypass -File `"$BootPs1`""
    $chain = "boot-from-icon.ps1"
  } else {
    $target = Join-Path $ProjectRoot "run.bat"
    $chain = "run.bat (legacy)"
  }
  New-LnkFile -LnkPath $LnkPath -TargetPath $target -Arguments $args -WorkDir $ProjectRoot `
    -Description "AI_Program_Main_Board stop+update+restart" -IconIndexUse $IconIndex
  return $chain
}

function New-UpdateShortcut {
  param(
    [string]$LnkPath,
    [string]$ProjectRoot
  )
  # Prefer ASCII bat path (shortcut TargetPath encoding safe)
  $updateBatEn = Join-Path $ProjectRoot "update-version.bat"
  $updateBatKo = Join-Path $ProjectRoot (
    [string]([char]0xBC84) + [string]([char]0xC804) +
    [string]([char]0xAC31) + [string]([char]0xC2E0) + ".bat"
  )
  if (Test-Path -LiteralPath $updateBatEn) {
    $target = $updateBatEn
  } elseif (Test-Path -LiteralPath $updateBatKo) {
    $target = $updateBatKo
  } else {
    throw "update-version.bat not found"
  }
  New-LnkFile -LnkPath $LnkPath -TargetPath $target -Arguments "" -WorkDir $ProjectRoot `
    -Description "Force VERSION update from GitHub main, then start board" -IconIndexUse $UpdateIconIndex
  return $target
}

try {
  $script:Root = Resolve-ProjectRoot
  $startBat = Join-Path $Root "start.bat"
  $bootPs1 = Join-Path $Root "boot-from-icon.ps1"
  $logPath = Join-Path $Root "icon-last.log"
  try { if (Test-Path -LiteralPath $logPath) { Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue } } catch {}

  Write-Host "========================================"
  Write-Host "  Refresh icons: AI_Program_Main_Board"
  Write-Host "  Project: $Root"
  Write-Host "========================================"
  Write-IconLog ("root=" + $Root)

  $desktops = @(Get-DesktopDirs)
  if ($desktops.Count -eq 0) {
    # last resort: create USERPROFILE\Desktop
    $fallback = Join-Path $env:USERPROFILE "Desktop"
    New-Item -ItemType Directory -Force -Path $fallback | Out-Null
    $desktops = @($fallback)
    Write-IconLog ("created fallback desktop=" + $fallback)
  }
  Write-IconLog ("desktops=" + ($desktops -join " | "))

  $taskPin = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
  $startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "AI_Program_Main_Board"
  if (-not (Test-Path -LiteralPath $startMenu)) {
    New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
  }

  $allNames = @($LnkName, $UpdateLnkName, $UpdateLnkNameAscii)
  Remove-NamedShortcuts -Folders (@($desktops + @($taskPin, $startMenu, $Root))) -Names $allNames

  $okCount = 0
  $chain = ""
  $updTarget = ""
  $primaryDesktop = $desktops[0]

  foreach ($desktop in $desktops) {
    $desktopLnk = Join-Path $desktop $LnkName
    $desktopUpdateLnk = Join-Path $desktop $UpdateLnkName
    $desktopUpdateAscii = Join-Path $desktop $UpdateLnkNameAscii
    try {
      $chain = New-BoardShortcut -LnkPath $desktopLnk -ProjectRoot $Root -StartBat $startBat -BootPs1 $bootPs1
      Write-IconLog ("OK board " + $desktopLnk)
      $okCount++
    } catch {
      Write-IconLog ("FAIL board " + $desktopLnk + " :: " + $_.Exception.Message)
    }
    try {
      $updTarget = New-UpdateShortcut -LnkPath $desktopUpdateLnk -ProjectRoot $Root
      Write-IconLog ("OK update-ko " + $desktopUpdateLnk)
      $okCount++
    } catch {
      Write-IconLog ("FAIL update-ko " + $desktopUpdateLnk + " :: " + $_.Exception.Message)
      try {
        $updTarget = New-UpdateShortcut -LnkPath $desktopUpdateAscii -ProjectRoot $Root
        Write-IconLog ("OK update-ascii " + $desktopUpdateAscii)
        $okCount++
      } catch {
        Write-IconLog ("FAIL update-ascii " + $desktopUpdateAscii + " :: " + $_.Exception.Message)
      }
    }
  }

  # Always also place copies inside project folder (drag to desktop if needed)
  try {
    $projBoard = Join-Path $Root $LnkName
    $chain = New-BoardShortcut -LnkPath $projBoard -ProjectRoot $Root -StartBat $startBat -BootPs1 $bootPs1
    Write-IconLog ("OK project-copy " + $projBoard)
  } catch {
    Write-IconLog ("FAIL project-copy board :: " + $_.Exception.Message)
  }
  try {
    $projUpd = Join-Path $Root $UpdateLnkName
    $updTarget = New-UpdateShortcut -LnkPath $projUpd -ProjectRoot $Root
    Write-IconLog ("OK project-copy " + $projUpd)
  } catch {
    try {
      $projUpd = Join-Path $Root $UpdateLnkNameAscii
      $updTarget = New-UpdateShortcut -LnkPath $projUpd -ProjectRoot $Root
      Write-IconLog ("OK project-copy " + $projUpd)
    } catch {
      Write-IconLog ("FAIL project-copy update :: " + $_.Exception.Message)
    }
  }

  if (-not (Test-Path -LiteralPath $taskPin)) {
    New-Item -ItemType Directory -Force -Path $taskPin | Out-Null
  }
  $srcBoard = Join-Path $primaryDesktop $LnkName
  if (-not (Test-Path -LiteralPath $srcBoard)) { $srcBoard = Join-Path $Root $LnkName }
  if (Test-Path -LiteralPath $srcBoard) {
    Copy-Item -LiteralPath $srcBoard -Destination (Join-Path $taskPin $LnkName) -Force
    Copy-Item -LiteralPath $srcBoard -Destination (Join-Path $startMenu $LnkName) -Force
    Write-IconLog ("OK taskbar+startmenu from " + $srcBoard)
  }

  Write-Host ""
  Write-Host ("[VERIFY] desktop dirs tried : {0}" -f $desktops.Count)
  Write-Host ("[VERIFY] shortcuts created : {0}" -f $okCount)
  Write-Host ("[VERIFY] board chain       : {0}" -f $chain)
  Write-Host ("[VERIFY] update target     : {0}" -f $updTarget)
  Write-Host ("[VERIFY] log               : {0}" -f $logPath)
  Write-Host ""

  if ($okCount -le 0) {
    Write-Host "[ERROR] No desktop shortcut was created." -ForegroundColor Red
    Write-Host ("See log: " + $logPath)
    exit 1
  }

  Write-Host "[DONE] Desktop icons created." -ForegroundColor Green
  Write-Host "  - AI_Program_Main_Board"
  Write-Host ("  - " + [System.IO.Path]::GetFileNameWithoutExtension($UpdateLnkName) + "  (or AI_Board_Update)")
  Write-Host "  - Copies also in project folder if Desktop was blocked."
  Write-Host ""
  exit 0
} catch {
  Write-Host ("[ERROR] " + $_.Exception.Message) -ForegroundColor Red
  try { Write-IconLog ("ERROR " + $_.Exception.Message) } catch {}
  exit 1
}
