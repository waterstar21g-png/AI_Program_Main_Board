#Requires -Version 5.1
# 1) 프로젝트 폴더에 바로가기 생성 스크립트 확보
# 2) 바탕화면에 AI_Program_Main_Board.lnk 생성 → run.bat
$ErrorActionPreference = "Stop"
chcp 65001 > $null
Set-Location -LiteralPath $PSScriptRoot

$target = Join-Path $PSScriptRoot "run.bat"
if (-not (Test-Path -LiteralPath $target)) {
  Write-Host "[오류] run.bat 없음: $target" -ForegroundColor Red
  Write-Host "  이 스크립트를 AI_Program_Main_Board 폴더 안에서 실행하세요."
  exit 1
}

# 한글 이름 bat도 폴더에 남겨 둠 (make-shortcut.bat 호출)
$koBat = Join-Path $PSScriptRoot "바로가기만들기.bat"
$enBat = Join-Path $PSScriptRoot "make-shortcut.bat"
if (-not (Test-Path -LiteralPath $koBat)) {
  @(
    '@echo off',
    'chcp 65001 >nul',
    'cd /d "%~dp0"',
    'call "%~dp0make-shortcut.bat"'
  ) | Set-Content -LiteralPath $koBat -Encoding UTF8
}
if (-not (Test-Path -LiteralPath $enBat)) {
  Write-Host "[경고] make-shortcut.bat 없음 — 바탕화면 lnk만 생성합니다."
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
Write-Host "  [정상] 로컬 폴더: $PSScriptRoot" -ForegroundColor Green
if (Test-Path -LiteralPath $koBat) { Write-Host "       바로가기만들기.bat" }
if (Test-Path -LiteralPath $enBat) { Write-Host "       make-shortcut.bat" }
Write-Host "  [정상] 바탕화면: $lnkPath" -ForegroundColor Green
Write-Host "       → $target"
Write-Host ""
