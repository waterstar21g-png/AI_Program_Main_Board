@echo off
REM Create desktop shortcut to D:\My_Project\AI_Program_Main_Board\start.bat
REM start.bat = version check + pull(only if changed) + run.bat
set "ROOT=D:\My_Project\AI_Program_Main_Board"
set "TARGET=%ROOT%\start.bat"
if not exist "%TARGET%" set "TARGET=%ROOT%\run.bat"
if not exist "%TARGET%" (
  echo [ERROR] Not found: %ROOT%\start.bat
  echo Get source first into %ROOT%
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%'; $t='%TARGET%'; $d=[Environment]::GetFolderPath('Desktop'); $l=Join-Path $d 'AI_Program_Main_Board.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($l); $s.TargetPath=$t; $s.WorkingDirectory=$p; $s.WindowStyle=1; $s.Description='AI_Program_Main_Board start (update if VERSION changed)'; $s.IconLocation=$env:SystemRoot+'\System32\shell32.dll,21'; $s.Save(); Write-Host '[OK]' $l"
if errorlevel 1 (
  echo [FAIL]
  pause
  exit /b 1
)
echo [OK] Desktop icon: AI_Program_Main_Board -^> start.bat
if exist "%~dp0pin-taskbar.ps1" (
  echo [..] Pin to taskbar...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pin-taskbar.ps1"
)
pause
