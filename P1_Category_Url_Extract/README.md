# P1_Category_Url_Extract

ABC마트/A-RT 계열 사이트에서 카테고리 계층 URL을 엑셀로 추출하는 **배치(CLI)** 도구입니다.

## 실행

```bat
run.bat
run.bat --tops MEN,WOMEN
run.bat --site ABC마트 --url https://abcmart.a-rt.com/ --tops MEN,WOMEN,KIDS
run.bat --out D:\out\result.xlsx
```

기본값: 사이트 `ABC마트`, URL `https://abcmart.a-rt.com/?track=W0009`, 상위 `MEN,WOMEN,KIDS`

## 출력 엑셀 열

| 상위 | 중위 | 하위 | 최종 | 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|------|------|------|------|----------------------|------------------------|

시트명: `카테고리표`

## 요구 사항

- Node.js 18+
- 인터넷 (대상 사이트 HTML fetch)

## 수동 실행

```bat
npm install
npx tsx cli.ts --help
```
