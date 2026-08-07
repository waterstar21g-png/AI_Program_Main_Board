#Requires -Version 5.1
# Pin AI_Program_Main_Board to the taskbar (ASCII-only source, PS 5.1 safe)
# Project: D:\My_Project\AI_Program_Main_Board
$ErrorActionPreference = "Stop"

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"
$runBat = Join-Path $PreferredRoot "run.bat"

if (-not (Test-Path -LiteralPath $runBat)) {
  Write-Host "[ERROR] Not found: $runBat" -ForegroundColor Red
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"
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
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($w) | Out-Null

Write-Host "[OK] Desktop shortcut: $lnkPath" -ForegroundColor Green

# "Pin to taskbar" / Korean equivalent via char codes (keep file ASCII)
$koPin = -join (
  [char]0xC791, [char]0xC5C5, [char]0x20,
  [char]0xD45C, [char]0xC2DC, [char]0xC904, [char]0xC5D0, [char]0x20,
  [char]0xACE0, [char]0xC815
)

function Invoke-PinVerb([string]$Path) {
  $folder = Split-Path -LiteralPath $Path -Parent
  $name = Split-Path -LiteralPath $Path -Leaf
  $shell = New-Object -ComObject Shell.Application
  $ns = $shell.NameSpace($folder)
  if (-not $ns) { return $false }
  $folderItem = $ns.ParseName($name)
  if (-not $folderItem) { return $false }
  foreach ($verb in @($folderItem.Verbs())) {
    $n = (($verb.Name) -replace '&', '').Trim()
    if ($n -eq 'Pin to taskbar' -or $n -eq $koPin -or $n -match '(?i)pin to taskbar') {
      $verb.DoIt()
      return $true
    }
  }
  return $false
}

$pinned = $false
try {
  $pinned = Invoke-PinVerb -Path $lnkPath
} catch {
  Write-Host "[WARN] Pin verb failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

$pinDir = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
try {
  if (-not (Test-Path -LiteralPath $pinDir)) {
    New-Item -ItemType Directory -Force -Path $pinDir | Out-Null
  }
  Copy-Item -LiteralPath $lnkPath -Destination (Join-Path $pinDir "AI_Program_Main_Board.lnk") -Force
  Write-Host "[OK] Copied to: $pinDir" -ForegroundColor Green
} catch {
  Write-Host "[WARN] Pinned folder copy failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

if ($pinned) {
  Write-Host "[DONE] Pinned to taskbar." -ForegroundColor Green
} else {
  Write-Host "[INFO] Auto-pin not available. Do this once:" -ForegroundColor Yellow
  Write-Host "  Right-click desktop icon AI_Program_Main_Board"
  Write-Host "  -> Pin to taskbar"
}

Write-Host ""
