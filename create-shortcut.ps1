#Requires -Version 5.1
# 바탕화면에 AI_Program_Main_Board 시작 아이콘 생성 → run.bat
$ErrorActionPreference = "Stop"
chcp 65001 > $null

$PreferredRoot = "D:\My_Project\AI_Program_Main_Board"

# 1) 고정 경로 우선  2) 이 스크립트 위치
if (Test-Path -LiteralPath (Join-Path $PreferredRoot "run.bat")) {
  $projectRoot = $PreferredRoot
} elseif ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "run.bat"))) {
  $projectRoot = $PSScriptRoot
} else {
  Write-Host "[ERROR] run.bat 을 찾을 수 없습니다." -ForegroundColor Red
  Write-Host "  먼저 소스를 받으세요: $PreferredRoot"
  Write-Host "  (fetch-local.ps1 또는 git clone)"
  exit 1
}

Set-Location -LiteralPath $projectRoot
$target = Join-Path $projectRoot "run.bat"

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AI_Program_Main_Board.lnk"

$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut($lnkPath)
$sc.TargetPath = $target
$sc.WorkingDirectory = $projectRoot
$sc.WindowStyle = 1
$sc.Description = "AI_Program_Main_Board 시작 (P1/P2/P3)"
# 눈에 띄는 앱 아이콘 (shell32 기본 중 컴퓨터/프로그램 느낌)
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$sc.Save()

Write-Host ""
Write-Host "  [OK] 프로젝트: $projectRoot" -ForegroundColor Green
Write-Host "  [OK] 바탕화면 아이콘: $lnkPath" -ForegroundColor Green
Write-Host "       대상: $target"
Write-Host "  더블클릭하면 보드가 시작됩니다."
Write-Host ""
