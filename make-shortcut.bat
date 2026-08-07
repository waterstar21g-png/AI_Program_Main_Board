@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [AI_Program_Main_Board] 바로가기 파일 받기 + 바탕화면 생성...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $b='https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main'; $d='%~dp0'; Invoke-WebRequest -Uri ($b+'/create-shortcut.ps1') -OutFile ($d+'create-shortcut.ps1') -UseBasicParsing; Invoke-WebRequest -Uri ($b+'/make-shortcut.bat') -OutFile ($d+'make-shortcut.bat') -UseBasicParsing; Invoke-WebRequest -Uri ($b+'/바로가기만들기.bat') -OutFile ($d+'바로가기만들기.bat') -UseBasicParsing; & powershell -NoProfile -ExecutionPolicy Bypass -File ($d+'create-shortcut.ps1')"
if errorlevel 1 pause
