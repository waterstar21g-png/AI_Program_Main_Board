#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$repo = "waterstar21g-png/sangpum-capture-price"
$ref = "main"
$ua = @{ Accept = "application/vnd.github.raw"; "User-Agent" = "AI-Program-Main-Board-boot" }

function Save-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Get-GitHubRaw([string]$Path) {
  $url = "https://api.github.com/repos/$repo/contents/$Path" + "?ref=$ref"
  return Invoke-RestMethod -Uri $url -Headers $ua -TimeoutSec 60
}

Write-Host "[BOOT] downloading run.ps1 ..." -ForegroundColor Cyan
try {
  $raw = Get-GitHubRaw "run.ps1"
  if ($raw -is [string]) {
    Save-Utf8NoBom (Join-Path $PSScriptRoot "run.ps1") $raw
  } else {
    $bytes = [Convert]::FromBase64String([string]$raw.content)
    [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "run.ps1"), $bytes)
  }
} catch {
  Write-Host "[FATAL] boot download failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this in PowerShell:" -ForegroundColor Yellow
  Write-Host @"
`$h=@{Accept='application/vnd.github.raw';'User-Agent'='x'}; `$e=New-Object Text.UTF8Encoding `$false;
`$t=irm 'https://api.github.com/repos/waterstar21g-png/sangpum-capture-price/contents/run.ps1?ref=main' -Headers `$h; [IO.File]::WriteAllText("$PWD\run.ps1",`$t,`$e);
`$t=irm 'https://api.github.com/repos/waterstar21g-png/sangpum-capture-price/contents/boot.ps1?ref=main' -Headers `$h; [IO.File]::WriteAllText("$PWD\boot.ps1",`$t,`$e);
`$t=irm 'https://api.github.com/repos/waterstar21g-png/sangpum-capture-price/contents/run.bat?ref=main' -Headers `$h; [IO.File]::WriteAllText("$PWD\run.bat",`$t,`$e);
.\run.bat
"@ -ForegroundColor Gray
  exit 1
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1")
exit $LASTEXITCODE
