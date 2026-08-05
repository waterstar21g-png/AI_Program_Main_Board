@echo off
echo Updating run.ps1 from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main/run.ps1' -OutFile '%~dp0run.ps1' -UseBasicParsing"
echo Done. Now double-click run.bat
pause
