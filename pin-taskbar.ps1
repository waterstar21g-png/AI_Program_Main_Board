#Requires -Version 5.1
# Pin AI_Program_Main_Board to the taskbar (ASCII-only, PS 5.1 safe)
# Project: D:\My_Project\AI_Program_Main_Board
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$runBat = Join-Path $PreferredRoot "run.bat"
$lnkName = "AI_Program_Main_Board.lnk"

if (-not (Test-Path -LiteralPath $runBat)) {
  Write-Host "[ERROR] Not found: $runBat" -ForegroundColor Red
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop $lnkName
$cmdExe = Join-Path $env:SystemRoot "System32\cmd.exe"

# Desktop shortcut as cmd.exe wrapper (bat alone often cannot pin)
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = $cmdExe
$sc.Arguments = "/c `"$runBat`""
$sc.WorkingDirectory = $PreferredRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board start"
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$sc.Save()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($sc) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($w) | Out-Null

Write-Host "[OK] Desktop shortcut: $lnkPath" -ForegroundColor Green

# Korean "Pin to taskbar" via char codes (keep file ASCII)
$koPin = -join (
  [char]0xC791, [char]0xC5C5, [char]0x20,
  [char]0xD45C, [char]0xC2DC, [char]0xC904, [char]0xC5D0, [char]0x20,
  [char]0xACE0, [char]0xC815
)

function Get-FolderItemForLnk {
  param([string]$FullLnkPath, [string]$Name)
  $shell = New-Object -ComObject Shell.Application

  # 1) shell:Desktop (works with OneDrive Desktop redirect)
  try {
    $desk = $shell.NameSpace("shell:Desktop")
    if ($desk) {
      $item = $desk.ParseName($Name)
      if ($item) { return $item }
    }
  } catch {}

  # 2) folder path (PS 5.1: do NOT use -LiteralPath with -Leaf)
  $folder = [System.IO.Path]::GetDirectoryName($FullLnkPath)
  $fileName = [System.IO.Path]::GetFileName($FullLnkPath)
  try {
    $ns = $shell.NameSpace($folder)
    if ($ns) {
      $item = $ns.ParseName($fileName)
      if ($item) { return $item }
    }
  } catch {}

  return $null
}

function Invoke-PinVerb {
  param([string]$FullLnkPath, [string]$Name)
  $folderItem = Get-FolderItemForLnk -FullLnkPath $FullLnkPath -Name $Name
  if (-not $folderItem) {
    Write-Host "[WARN] Shortcut item not found via Shell." -ForegroundColor Yellow
    return $false
  }

  $verbs = @($folderItem.Verbs())
  Write-Host "[..] Verbs found: $($verbs.Count)"
  foreach ($verb in $verbs) {
    if (-not $verb.Name) { continue }
    $n = ($verb.Name -replace '&', '').Trim()
    if (
      $n -eq 'Pin to taskbar' -or
      $n -eq $koPin -or
      $n -match '(?i)pin to taskbar' -or
      $n -match '(?i)taskbar'
    ) {
      Write-Host "[..] Invoking verb: $n"
      $verb.DoIt()
      return $true
    }
  }

  # Show available verbs to help diagnose (ASCII names / lengths)
  $names = @()
  foreach ($verb in $verbs) {
    if ($verb.Name) { $names += (($verb.Name -replace '&', '').Trim()) }
  }
  if ($names.Count -gt 0) {
    Write-Host "[INFO] Available verbs: $($names -join ' | ')"
  }
  return $false
}

$pinned = $false
try {
  $pinned = Invoke-PinVerb -FullLnkPath $lnkPath -Name $lnkName
} catch {
  Write-Host "[WARN] Pin verb failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

$pinDir = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
try {
  if (-not (Test-Path -LiteralPath $pinDir)) {
    New-Item -ItemType Directory -Force -Path $pinDir | Out-Null
  }
  Copy-Item -LiteralPath $lnkPath -Destination (Join-Path $pinDir $lnkName) -Force
  Write-Host "[OK] Copied to: $pinDir" -ForegroundColor Green
} catch {
  Write-Host "[WARN] Pinned folder copy failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

if ($pinned) {
  Write-Host "[DONE] Pinned to taskbar." -ForegroundColor Green
} else {
  Write-Host "[INFO] Windows blocked auto-pin. Do this once:" -ForegroundColor Yellow
  Write-Host "  1) Show desktop"
  Write-Host "  2) Right-click AI_Program_Main_Board"
  Write-Host "  3) Pin to taskbar"
}

Write-Host ""
