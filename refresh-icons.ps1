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
  # cmd.exe wrapper: .bat alone often cannot pin to taskbar on Windows
  $cmdExe = Join-Path $env:SystemRoot "System32\cmd.exe"
  if (Test-Path -LiteralPath $StartBat) {
    $target = $cmdExe
    $args = "/c `"$StartBat`""
    $chain = "cmd -> start.bat -> boot-from-icon.ps1"
  } elseif (Test-Path -LiteralPath $BootPs1) {
    $target = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $args = "-NoProfile -ExecutionPolicy Bypass -File `"$BootPs1`""
    $chain = "boot-from-icon.ps1"
  } else {
    $runBat = Join-Path $ProjectRoot "run.bat"
    $target = $cmdExe
    $args = "/c `"$runBat`""
    $chain = "cmd -> run.bat (legacy)"
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
    $bat = $updateBatEn
  } elseif (Test-Path -LiteralPath $updateBatKo) {
    $bat = $updateBatKo
  } else {
    throw "update-version.bat not found"
  }
  # cmd.exe wrapper so version-update shortcut can pin to taskbar
  $cmdExe = Join-Path $env:SystemRoot "System32\cmd.exe"
  New-LnkFile -LnkPath $LnkPath -TargetPath $cmdExe -Arguments ("/c `"{0}`"" -f $bat) `
    -WorkDir $ProjectRoot `
    -Description "Force VERSION update from GitHub main, then start board" `
    -IconIndexUse $UpdateIconIndex
  return $bat
}

function Invoke-PinToTaskbar {
  param([string]$FullLnkPath)

  if (-not $FullLnkPath -or -not (Test-Path -LiteralPath $FullLnkPath)) {
    return $false
  }

  # Korean: "작업 표시줄에 고정"
  $koPin = -join (
    [char]0xC791, [char]0xC5C5, [char]0x20,
    [char]0xD45C, [char]0xC2DC, [char]0xC904, [char]0xC5D0, [char]0x20,
    [char]0xACE0, [char]0xC815
  )
  $name = [System.IO.Path]::GetFileName($FullLnkPath)
  $folder = [System.IO.Path]::GetDirectoryName($FullLnkPath)

  try {
    $shell = New-Object -ComObject Shell.Application
    $folderItem = $null
    try {
      $desk = $shell.NameSpace("shell:Desktop")
      if ($desk) { $folderItem = $desk.ParseName($name) }
    } catch {}
    if (-not $folderItem) {
      $ns = $shell.NameSpace($folder)
      if ($ns) { $folderItem = $ns.ParseName($name) }
    }
    if (-not $folderItem) { return $false }

    foreach ($verb in @($folderItem.Verbs())) {
      if (-not $verb.Name) { continue }
      $n = (($verb.Name) -replace '&', '').Trim()
      if (
        $n -eq 'Pin to taskbar' -or
        $n -eq $koPin -or
        $n -match '(?i)pin to taskbar' -or
        ($n -match '(?i)taskbar' -and $n -match '(?i)pin')
      ) {
        $verb.DoIt()
        return $true
      }
    }
  } catch {
    Write-IconLog ("WARN pin-verb " + $name + " :: " + $_.Exception.Message)
  }
  return $false
}

function Place-OnTaskbarAndStartMenu {
  param(
    [string]$SrcLnk,
    [string]$DestName,
    [string]$TaskPinDir,
    [string]$StartMenuDir
  )
  if (-not $SrcLnk -or -not (Test-Path -LiteralPath $SrcLnk)) {
    Write-IconLog ("SKIP taskbar missing src " + $DestName)
    return $false
  }
  if (-not (Test-Path -LiteralPath $TaskPinDir)) {
    New-Item -ItemType Directory -Force -Path $TaskPinDir | Out-Null
  }
  if (-not (Test-Path -LiteralPath $StartMenuDir)) {
    New-Item -ItemType Directory -Force -Path $StartMenuDir | Out-Null
  }

  $destTask = Join-Path $TaskPinDir $DestName
  $destStart = Join-Path $StartMenuDir $DestName
  Copy-Item -LiteralPath $SrcLnk -Destination $destTask -Force
  Copy-Item -LiteralPath $SrcLnk -Destination $destStart -Force
  Write-IconLog ("OK taskbar-copy " + $destTask)

  $pinned = $false
  try { $pinned = Invoke-PinToTaskbar -FullLnkPath $SrcLnk } catch {}
  if ($pinned) {
    Write-IconLog ("OK pin-verb " + $DestName)
  } else {
    Write-IconLog ("INFO pin-verb unavailable for " + $DestName + " (folder copy done)")
  }
  return $true
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
  $createdUpdateName = $UpdateLnkName

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
      $createdUpdateName = $UpdateLnkName
      $okCount++
    } catch {
      Write-IconLog ("FAIL update-ko " + $desktopUpdateLnk + " :: " + $_.Exception.Message)
      try {
        $updTarget = New-UpdateShortcut -LnkPath $desktopUpdateAscii -ProjectRoot $Root
        Write-IconLog ("OK update-ascii " + $desktopUpdateAscii)
        $createdUpdateName = $UpdateLnkNameAscii
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

  # ★요건: 작업표시줄에 메인보드 + 버전갱신(바로가기) 둘 다 추가
  $srcBoard = Join-Path $primaryDesktop $LnkName
  if (-not (Test-Path -LiteralPath $srcBoard)) { $srcBoard = Join-Path $Root $LnkName }

  $srcUpdate = Join-Path $primaryDesktop $createdUpdateName
  if (-not (Test-Path -LiteralPath $srcUpdate)) {
    $srcUpdate = Join-Path $primaryDesktop $UpdateLnkName
  }
  if (-not (Test-Path -LiteralPath $srcUpdate)) {
    $srcUpdate = Join-Path $primaryDesktop $UpdateLnkNameAscii
  }
  if (-not (Test-Path -LiteralPath $srcUpdate)) {
    $srcUpdate = Join-Path $Root $UpdateLnkName
  }
  if (-not (Test-Path -LiteralPath $srcUpdate)) {
    $srcUpdate = Join-Path $Root $UpdateLnkNameAscii
  }

  $tbBoard = Place-OnTaskbarAndStartMenu -SrcLnk $srcBoard -DestName $LnkName `
    -TaskPinDir $taskPin -StartMenuDir $startMenu
  $updDestName = [System.IO.Path]::GetFileName($srcUpdate)
  if (-not $updDestName) { $updDestName = $UpdateLnkName }
  $tbUpdate = Place-OnTaskbarAndStartMenu -SrcLnk $srcUpdate -DestName $updDestName `
    -TaskPinDir $taskPin -StartMenuDir $startMenu

  Write-Host ""
  Write-Host ("[VERIFY] desktop dirs tried : {0}" -f $desktops.Count)
  Write-Host ("[VERIFY] shortcuts created : {0}" -f $okCount)
  Write-Host ("[VERIFY] board chain       : {0}" -f $chain)
  Write-Host ("[VERIFY] update target     : {0}" -f $updTarget)
  Write-Host ("[VERIFY] taskbar board     : {0}" -f $tbBoard)
  Write-Host ("[VERIFY] taskbar update    : {0}" -f $tbUpdate)
  Write-Host ("[VERIFY] log               : {0}" -f $logPath)
  Write-Host ""

  if ($okCount -le 0) {
    Write-Host "[ERROR] No desktop shortcut was created." -ForegroundColor Red
    Write-Host ("See log: " + $logPath)
    exit 1
  }

  Write-Host "[DONE] Desktop + Taskbar icons created." -ForegroundColor Green
  Write-Host "  - AI_Program_Main_Board  (main board)"
  Write-Host ("  - " + [System.IO.Path]::GetFileNameWithoutExtension($updDestName) + "  (version update)")
  Write-Host "  - Both copied to Taskbar pin folder + Start Menu"
  Write-Host "  - If taskbar icon missing: right-click desktop icon -> Pin to taskbar"
  Write-Host ""
  exit 0
} catch {
  Write-Host ("[ERROR] " + $_.Exception.Message) -ForegroundColor Red
  try { Write-IconLog ("ERROR " + $_.Exception.Message) } catch {}
  exit 1
}
