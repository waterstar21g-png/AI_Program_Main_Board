@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === AI_Program_Main_Board 환경 점검 ===
echo [폴더] %CD%
where node >nul 2>&1 && node -v || echo [X] Node.js 없음
where npm >nul 2>&1 && npm -v || echo [X] npm 없음
if exist node_modules\ (echo [OK] node_modules) else echo [X] setup.bat 실행 필요
if exist .next\BUILD_ID (echo [OK] 빌드됨 - start-prod.bat 가능) else echo [--] 빌드 없음 - build.bat 후 start-prod.bat
if exist .env.local (echo [OK] .env.local) else echo [--] .env.local 없음 ^(카테고리 추출은 OK^)
if exist node_modules\playwright\ (echo [OK] playwright 패키지) else echo [X] playwright 없음
where npx >nul 2>&1 && npx playwright --version 2>nul || echo [--] playwright CLI 확인 불가
echo.
echo 실행: start.bat ^(개발^)  /  start-prod.bat ^(빌드 후^)
pause
