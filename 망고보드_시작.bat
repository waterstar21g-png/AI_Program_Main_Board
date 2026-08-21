@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: 망고보드 시작 (부트스트랩)
::
:: 이 파일만 더블클릭하면 끝난다.
::   1) AI보드 저장소를 최신으로 (git pull)
::   2) 망고보드 폴더(D:\My_Project\Mango_Helper_AI_Board)로 최신 소스 복사
::      — 로그·엑셀·크롬프로필·캐시는 건드리지 않음
::   3) 바탕화면 [망고보드] 아이콘 생성·작업표시줄 고정
::   4) 망고보드 실행
::
:: 이후로는 바탕화면 [망고보드] 아이콘만 눌러도 스스로 최신 버전을 받아온다
:: (망고보드 run.bat 의 자동갱신). 이 파일은 그 시작점을 만들어 주는 역할이다.
::
:: ※ 망고보드는 AI보드와 별개의 독립 보드다. AI보드 파일은 수정하지 않는다.

set "SRC=%~dp0Mango_Helper_AI_Board"
set "DST=D:\My_Project\Mango_Helper_AI_Board"

echo ========================================
echo   망고보드 시작
echo   원본: %SRC%
echo   대상: %DST%
echo ========================================

where git >nul 2>nul
if errorlevel 1 (
  echo [건너뜀] Git 없음 - 저장소 갱신 없이 진행
) else (
  echo [1/4] AI보드 저장소 최신화 ...
  pushd "%~dp0" >nul
  git pull origin main
  popd >nul
)

if not exist "%SRC%\run.bat" (
  echo [ERROR] 망고보드 소스를 찾지 못했습니다: %SRC%
  echo         AI보드를 최신으로 갱신한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

echo [2/4] 망고보드 폴더로 복사 ...
if not exist "%DST%" mkdir "%DST%"
robocopy "%SRC%" "%DST%" /E /IS /IT /XD .git __pycache__ .pytest_cache .chrome-profile run-logs output /XF *.pyc *.lnk *.xlsx .translate_options.json .site_options.json /NFL /NDL /NJH /NJS >nul
if errorlevel 8 (
  echo [ERROR] 복사 실패
  pause
  exit /b 1
)

cd /d "%DST%"

where py >nul 2>nul
if not errorlevel 1 (
  set "PY=py -3"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PY=python"
  ) else (
    echo [ERROR] Python 없음 - https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

echo [3/4] 바탕화면 아이콘 · 작업표시줄 고정 ...
call %PY% board\desktop_icon.py

echo [4/4] 망고보드 실행 ...
call "%DST%\run.bat" --noupdate

exit /b 0
