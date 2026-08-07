@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [P3] 독립 실행 — 명령 순서대로 점검
node scripts\run-p3.mjs %*
if errorlevel 1 pause
