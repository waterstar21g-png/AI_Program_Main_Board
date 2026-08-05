@echo off
chcp 65001 >nul
title AI_Program_Main_Board

cd /d "%~dp0"
set "GITHUB_RAW=https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main"

echo ========================================
echo   AI_Program_Main_Board - 실행
echo   (파일받기 + 설치 + 서버시작)
echo ========================================
echo [폴더] %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 없음 - https://nodejs.org LTS 설치
  pause
  exit /b 1
)

echo [1/4] 최신 프로그램 파일 확인...
set "NEED_DL=0"
if not exist "components\ProductDataCollectApp.tsx" set "NEED_DL=1"
if not exist "lib\product-data-collect\runner.ts" set "NEED_DL=1"
if exist "lib\programs\registry.tsx" (
  findstr /i "ProductCapture" "lib\programs\registry.tsx" >nul 2>&1 && set "NEED_DL=1"
) else (
  set "NEED_DL=1"
)

if "%NEED_DL%"=="1" (
  where curl >nul 2>&1
  if errorlevel 1 (
    echo [오류] 구버전 폴더입니다. curl 없음.
    echo GitHub - Code - Download ZIP 으로 폴더 교체하세요.
    pause
    exit /b 1
  )
  echo       GitHub 에서 필요 파일 다운로드...
  if not exist "lib\programs\" mkdir "lib\programs"
  if not exist "lib\product-data-collect\" mkdir "lib\product-data-collect"
  if not exist "components\" mkdir "components"
  if not exist "app\api\product-collect\run\" mkdir "app\api\product-collect\run"
  curl -fsSL -o "lib\programs\registry.tsx" "%GITHUB_RAW%/lib/programs/registry.tsx" || goto dlfail
  curl -fsSL -o "components\ProductDataCollectApp.tsx" "%GITHUB_RAW%/components/ProductDataCollectApp.tsx" || goto dlfail
  curl -fsSL -o "lib\product-data-collect\types.ts" "%GITHUB_RAW%/lib/product-data-collect/types.ts" || goto dlfail
  curl -fsSL -o "lib\product-data-collect\steps.ts" "%GITHUB_RAW%/lib/product-data-collect/steps.ts" || goto dlfail
  curl -fsSL -o "lib\product-data-collect\runner.ts" "%GITHUB_RAW%/lib/product-data-collect/runner.ts" || goto dlfail
  curl -fsSL -o "lib\product-data-collect\excel-import.ts" "%GITHUB_RAW%/lib/product-data-collect/excel-import.ts" || goto dlfail
  curl -fsSL -o "app\api\product-collect\run\route.ts" "%GITHUB_RAW%/app/api/product-collect/run/route.ts" || goto dlfail
  echo       [OK] 상품데이터수집 + 보드 목록 반영
) else (
  echo       [OK] 파일 최신
)
echo.

echo [2/4] npm 패키지...
if not exist "node_modules\" (
  call npm install
  if errorlevel 1 goto fail
) else (
  echo       [OK] node_modules 있음
)
echo.

echo [3/4] Playwright Chromium...
if not exist ".local\playwright-chromium.ok" (
  if not exist ".local\" mkdir ".local"
  call npx playwright install chromium
  if not errorlevel 1 echo ok> ".local\playwright-chromium.ok"
)
echo.

echo [4/4] 서버 시작...
echo ========================================
echo   http://localhost:3000
echo   종료: Ctrl+C
echo   보드: Category_Item_Url_List + 상품데이터수집
echo ========================================
echo.

start "" "http://localhost:3000"
call npm run dev:fast
pause
exit /b 0

:dlfail
echo [오류] 파일 다운로드 실패. 인터넷 확인 또는 GitHub ZIP 교체.
pause
exit /b 1

:fail
echo [오류] npm install 실패
pause
exit /b 1
