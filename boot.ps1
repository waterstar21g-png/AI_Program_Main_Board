#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$repo = "waterstar21g-png/AI_Program_Main_Board"
# Sync from main
$ref = "main"
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Save-Bytes([string]$Path, [byte[]]$Bytes) {
  # UTF-16 LE/BE -> UTF-8 no BOM
  if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
    $text = [Text.Encoding]::Unicode.GetString($Bytes, 2, $Bytes.Length - 2)
    [IO.File]::WriteAllText($Path, $text, (New-Object Text.UTF8Encoding $false))
    return
  }
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    $rest = New-Object byte[] ($Bytes.Length - 3)
    [Array]::Copy($Bytes, 3, $rest, 0, $rest.Length)
    $Bytes = $rest
  }
  [IO.File]::WriteAllBytes($Path, $Bytes)
}

function Download-Raw([string]$RepoPath, [string]$LocalPath) {
  $urls = @(
    "https://raw.githubusercontent.com/$repo/$ref/$RepoPath`?t=$cb",
    "https://cdn.jsdelivr.net/gh/${repo}@$ref/$RepoPath"
  )
  $last = $null
  foreach ($url in $urls) {
    try {
      $tmp = "$LocalPath.download"
      Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -Headers @{
        "User-Agent"    = "AI-Program-Main-Board-boot"
        "Cache-Control" = "no-cache"
      }
      $bytes = [IO.File]::ReadAllBytes((Resolve-Path $tmp))
      Remove-Item -Force $tmp -ErrorAction SilentlyContinue
      if ($bytes.Length -lt 20) { throw "too small: $($bytes.Length)" }
      # reject JSON error payloads
      $head = [Text.Encoding]::UTF8.GetString($bytes, 0, [Math]::Min(40, $bytes.Length))
      if ($head -match '^\s*\{\s*"message"') { throw "got API error JSON" }
      Save-Bytes $LocalPath $bytes
      return
    } catch {
      $last = $_
    }
  }
  throw $last
}

Write-Host "[BOOT] downloading run.ps1 (raw, no API) ..." -ForegroundColor Cyan
try {
  Download-Raw "run.ps1" (Join-Path $PSScriptRoot "run.ps1")
} catch {
  Write-Host "[FATAL] boot download failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this ONE line in PowerShell:" -ForegroundColor Yellow
  Write-Host "Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/gh/waterstar21g-png/AI_Program_Main_Board@main/recover.ps1' -OutFile recover.ps1 -UseBasicParsing; powershell -NoProfile -ExecutionPolicy Bypass -File .\recover.ps1" -ForegroundColor Gray
  exit 1
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1")
exit $LASTEXITCODE
