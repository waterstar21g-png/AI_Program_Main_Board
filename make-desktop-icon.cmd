@echo off
REM Create desktop shortcut -> boot-from-icon.ps1 (VERSION change => git pull)
set "ROOT=D:\My_Project\AI_Program_Main_Board"
if not exist "%ROOT%\run.bat" (
  echo [ERROR] Not found: %ROOT%\run.bat
  echo Get source first into %ROOT%
  pause
  exit /b 1
)
if exist "%~dp0create-shortcut.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
) else if exist "%ROOT%\create-shortcut.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\create-shortcut.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p='%ROOT%'; $boot=Join-Path $p 'boot-from-icon.ps1'; $ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'; $d=[Environment]::GetFolderPath('Desktop'); $l=Join-Path $d 'AI_Program_Main_Board.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($l); if(Test-Path $boot){ $s.TargetPath=$ps; $s.Arguments=('-NoProfile -ExecutionPolicy Bypass -File \"'+$boot+'\"') } else { $s.TargetPath=(Join-Path $p 'run.bat') }; $s.WorkingDirectory=$p; $s.WindowStyle=1; $s.Description='AI_Program_Main_Board (update if VERSION changed)'; $s.IconLocation=$env:SystemRoot+'\System32\shell32.dll,21'; $s.Save(); Write-Host '[OK]' $l"
)
if errorlevel 1 (
  echo [FAIL]
  pause
  exit /b 1
)
echo [OK] Desktop icon: AI_Program_Main_Board
if exist "%~dp0pin-taskbar.ps1" (
  echo [..] Pin to taskbar...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pin-taskbar.ps1"
)
pause
