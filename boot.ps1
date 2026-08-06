#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$repo = "waterstar21g-png/sangpum-capture-price"
# Prefer feature branch until v2.2.10 is on main (API rate-limit / encoding fix)
$ref = "cursor/fix-runbat-encoding-dcbc"
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
  Write-Host "Paste this in PowerShell (uses raw.githubusercontent.com, not API):" -ForegroundColor Yellow
  Write-Host @"
`$cb=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); `$b='https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/cursor/fix-runbat-encoding-dcbc'; foreach(`$f in @('boot.ps1','run.bat','run.ps1')){ Invoke-WebRequest -Uri "`$b/`$f`?t=`$cb" -OutFile "`$PWD\`$f" -UseBasicParsing -Headers @{'User-Agent'='x';'Cache-Control'='no-cache'} }; cmd /c run.bat
"@ -ForegroundColor Gray
  exit 1
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run.ps1")
exit $LASTEXITCODE
