@echo off
chcp 65001 >nul
title AI_Program_Main_Board - 보드 수정

cd /d "%~dp0"

echo ========================================
echo   보드 목록 수정 + 실행 파일 복구
echo ========================================
echo [폴더] %CD%
echo.

if not exist "lib\programs\" mkdir "lib\programs"

set BASE=https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main

where curl >nul 2>&1
if errorlevel 1 (
  echo [오류] curl 이 없습니다. 인터넷 연결 후 다시 시도하거나
  echo GitHub에서 AI_Program_Main_Board 폴더 전체를 다시 받으세요.
  pause
  exit /b 1
)

echo [1/4] registry.tsx 다운로드 ^(상품캡처 제거, 상품데이터수집 추가^)...
curl -fsSL -o "lib\programs\registry.tsx" "%BASE%/lib/programs/registry.tsx"
if errorlevel 1 (
  echo [오류] registry.tsx 다운로드 실패
  pause
  exit /b 1
)

echo [2/4] run.bat / start.bat ...
curl -fsSL -o "run.bat" "%BASE%/run.bat"
curl -fsSL -o "start.bat" "%BASE%/start.bat"

echo [3/4] 캐시 삭제...
if exist ".next\" rmdir /s /q ".next"
if exist ".next-dev\" rmdir /s /q ".next-dev"

echo [4/4] 등록된 프로그램 확인:
echo ----------------------------------------
findstr /i "name:" lib\programs\registry.tsx
echo ----------------------------------------
findstr /i "ProductCapture 상품캡처" lib\programs\registry.tsx >nul
if not errorlevel 1 (
  echo [경고] 아직 상품캡처 코드가 registry 에 있습니다!
) else (
  echo [OK] 상품캡처 없음 - Category_Item_Url_List + 상품데이터수집 만 등록
)

echo.
echo 완료. 이제 run.bat 또는 start.bat 실행하세요.
echo 브라우저 Ctrl+F5 새로고침
echo.
pause
