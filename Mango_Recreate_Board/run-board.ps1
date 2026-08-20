# Mango_Recreate_Board — Python 보드 (npm 없음)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Mango_Recreate_Board v1.0.0 (Python UI shell) ===" -ForegroundColor Cyan

$py = $null
foreach ($c in @("py -3", "python", "python3")) {
  $parts = $c.Split(" ")
  try {
    & $parts[0] @($parts[1..($parts.Length-1)]) --version 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $py = $c; break }
  } catch {}
}
if (-not $py) {
  Write-Host "[ERROR] Python 없음 — https://www.python.org/downloads/" -ForegroundColor Red
  exit 1
}

Write-Host "[pip] install..."
$parts = $py.Split(" ")
& $parts[0] @($parts[1..($parts.Length-1)] + @("-m","pip","install","-q","--disable-pip-version-check","-r","requirements.txt"))
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[board] start"
& $parts[0] @($parts[1..($parts.Length-1)] + @("board\app.py"))
