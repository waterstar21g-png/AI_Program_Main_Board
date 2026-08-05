@echo off
chcp 65001 >nul
title AI_Program_Main_Board - 최신 파일 받기

cd /d "%~dp0"

set B=https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main

echo ========================================
echo   상품데이터수집 + 보드 수정 파일 받기
echo ========================================
echo [폴더] %CD%
echo.

where curl >nul 2>&1
if errorlevel 1 (
  echo [오류] curl 이 없습니다.
  echo GitHub - Code - Download ZIP 으로 폴더 통째로 교체하세요.
  pause
  exit /b 1
)

if not exist "lib\programs\" mkdir "lib\programs"
if not exist "lib\product-data-collect\" mkdir "lib\product-data-collect"
if not exist "components\" mkdir "components"
if not exist "app\api\product-collect\run\" mkdir "app\api\product-collect\run"

echo [1] registry.tsx ...
curl -fsSL -o "lib\programs\registry.tsx" "%B%/lib/programs/registry.tsx" || goto fail

echo [2] ProductDataCollectApp.tsx ...
curl -fsSL -o "components\ProductDataCollectApp.tsx" "%B%/components/ProductDataCollectApp.tsx" || goto fail

echo [3] lib\product-data-collect ...
curl -fsSL -o "lib\product-data-collect\types.ts" "%B%/lib/product-data-collect/types.ts" || goto fail
curl -fsSL -o "lib\product-data-collect\steps.ts" "%B%/lib/product-data-collect/steps.ts" || goto fail
curl -fsSL -o "lib\product-data-collect\runner.ts" "%B%/lib/product-data-collect/runner.ts" || goto fail
curl -fsSL -o "lib\product-data-collect\excel-import.ts" "%B%/lib/product-data-collect/excel-import.ts" || goto fail

echo [4] API route ...
curl -fsSL -o "app\api\product-collect\run\route.ts" "%B%/app/api/product-collect/run/route.ts" || goto fail

echo [5] run.bat ...
curl -fsSL -o "run.bat" "%B%/run.bat" || goto fail

echo.
echo [확인]
if not exist "components\ProductDataCollectApp.tsx" goto fail
findstr /i "ProductCapture" lib\programs\registry.tsx >nul && (
  echo [경고] registry 에 아직 ProductCapture 가 있습니다.
) || (
  echo [OK] registry - 상품캡처 제거됨
)
findstr /i "상품데이터수집" lib\programs\registry.tsx >nul && (
  echo [OK] registry - 상품데이터수집 있음
) || (
  echo [경고] registry 에 상품데이터수집 없음
)
echo [OK] ProductDataCollectApp.tsx 있음

echo.
echo 다음 명령 실행:
echo   npm install
echo   npx playwright install chromium
echo   npm run dev:fast
echo.
pause
exit /b 0

:fail
echo.
echo [오류] 다운로드 실패. 인터넷 확인 또는 GitHub ZIP 으로 폴더 교체.
pause
exit /b 1
