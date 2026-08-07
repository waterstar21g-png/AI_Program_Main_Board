# P1_Category_Url_Extract

ABC마트(A-RT) 사이트에서 상위 카테고리별 URL 목록을 엑셀로 추출합니다.

## 실행

```bat
run.bat
run.bat --tops MEN,WOMEN,KIDS,BRAND
run.bat --site-url "https://abcmart.a-rt.com/" --out 결과.xlsx
```

최초 실행 시 `npm install`이 자동으로 실행됩니다. Node.js 18+ 필요.

## 출력

`카테고리표` 시트 — P2/P3 입력 양식과 호환 (6열).
