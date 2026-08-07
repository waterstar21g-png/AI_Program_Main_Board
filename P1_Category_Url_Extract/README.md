# P1_Category_Url_Extract

카테고리별 상품 URL 리스트 추출 (ABC마트 / A-RT 계열).  
브라우저 자동화 없이 HTML fetch + 파싱만 사용합니다.

## 실행

```bat
run.bat
```

또는:

```bat
run.bat --site "ABC마트" --url "https://abcmart.a-rt.com/?track=W0009" --tops MEN,WOMEN,KIDS
```

결과 엑셀이 이 폴더에 저장됩니다 (`*_카테고리URL_LIST_YYYYMMDD.xlsx`).

## 필요 환경

- Node.js 18+
- 최초 1회 `npm install` (`run.bat`이 자동 실행)
