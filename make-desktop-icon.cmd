@echo off
REM Create desktop shortcut to D:\My_Project\AI_Program_Main_Board\run.bat
REM Double-click this file, or run from PowerShell: cmd /c make-desktop-icon.cmd
set "ROOT=D:\My_Project\AI_Program_Main_Board"
set "TARGET=%ROOT%\run.bat"
if not exist "%TARGET%" (
  echo [ERROR] Not found: %TARGET%
  echo Get source first into %ROOT%
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%'; $t='%TARGET%'; $d=[Environment]::GetFolderPath('Desktop'); $l=Join-Path $d 'AI_Program_Main_Board.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($l); $s.TargetPath=$t; $s.WorkingDirectory=$p; $s.WindowStyle=1; $s.Description='AI_Program_Main_Board start'; $s.IconLocation=$env:SystemRoot+'\System32\shell32.dll,21'; $s.Save(); Write-Host '[OK]' $l"
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
