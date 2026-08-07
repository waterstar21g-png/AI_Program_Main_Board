# P2_Product_Capture_App

더망고(tmg1898) URL 엑셀 기반 상품 대량수집 — Node.js + Playwright CLI.

P3(Python)과 같은 업무입니다. Python이 더 가볍다면 P3를 사용하세요.

## 실행

```bat
run.bat --open-only          REM ① 브라우저 열기 · 로그인
run.bat 엑셀파일.xlsx         REM ② 수집 시작
run.bat 엑셀.xlsx --save-count 5
```

엑셀을 `run.bat`에 드래그해도 됩니다.

## 엑셀 필수 열

- `상위 최종 카테고리명`
- `최종 카테고리 URL주소`

(P1 출력 양식 그대로 사용 가능)
