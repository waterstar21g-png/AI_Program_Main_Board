#Requires -Version 5.1
# 바탕화면에 AI_Program_Main_Board 바로가기 생성 → run.bat
$ErrorActionPreference = "Stop"
chcp 65001 > $null
Set-Location -LiteralPath $PSScriptRoot

$target = Join-Path $PSScriptRoot "run.bat"
if (-not (Test-Path -LiteralPath $target)) {
  Write-Host "[ERROR] run.bat 없음: $target" -ForegroundColor Red
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"

$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = $target
$sc.WorkingDirectory = $PSScriptRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board — 보드 실행 (P1/P2/P3)"
$sc.Save()

Write-Host ""
Write-Host "  바로가기 생성 완료" -ForegroundColor Green
Write-Host "  $lnkPath"
Write-Host "  → $target"
Write-Host ""
Write-Host "  바탕화면의 AI_Program_Main_Board 를 더블클릭하면 됩니다."
Write-Host ""
