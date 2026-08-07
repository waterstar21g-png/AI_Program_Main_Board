# P1_Category_Url_Extract

ABC마트 / A-RT 계열 사이트에서 카테고리 계층 URL을 추출해 엑셀로 저장하는 **배치** 프로젝트입니다.
Next.js 보드 UI 없이 이 폴더만으로 실행됩니다.

## 실행 (Windows)

1. Node.js 설치: https://nodejs.org/
2. `run.bat` 더블클릭 (대화형 입력)
3. 또는:

```bat
run.bat --site "ABC마트" --url "https://abcmart.a-rt.com/?track=W0009" --tops MEN,WOMEN,KIDS
```

`config.json` 예시:

```json
{
  "siteName": "ABC마트",
  "siteUrl": "https://abcmart.a-rt.com/?track=W0009",
  "topCategories": ["MEN", "WOMEN", "KIDS"]
}
```

```bat
run.bat --config config.json --out out.xlsx
```

## 출력 엑셀 열

| 상위 카테고리명 | 중위 | 하위 | 최종 | 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
