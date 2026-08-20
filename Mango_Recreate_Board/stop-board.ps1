#Requires -Version 5.1
# Stop running Mango_Recreate_Board (board\app.py) before restart.
# ASCII-only (PS 5.1 safe). Called by boot-from-icon.ps1 / run.bat.
$ErrorActionPreference = "SilentlyContinue"

$pattern = 'board[\\/]app\.py'
$stopped = 0

foreach ($name in @('python.exe', 'pythonw.exe')) {
  try {
    Get-CimInstance Win32_Process -Filter "Name='$name'" | ForEach-Object {
      $cmd = $_.CommandLine
      if ($cmd -and ($cmd -match $pattern)) {
        Write-Host "[STOP] board pid=$($_.ProcessId) ($name)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped++
      }
    }
  } catch {}
}

if ($stopped -gt 0) {
  Start-Sleep -Milliseconds 500
  Write-Host "[OK] Stopped $stopped board process(es)"
} else {
  Write-Host "[INFO] No running board process"
}

exit 0
