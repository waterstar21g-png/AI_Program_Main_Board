# Category_Item_Url_List

카테고리 **계층 구조**(상위·중위·하위·최종)와 **브라우저 주소창 URL**을 엑셀(.xlsx)로 추출하는 웹 앱입니다.

## 핵심 기능

- 사이트명·URL 입력 (ABC마트 기본값)
- 상위 카테고리 지정 (최대 15개, 예: MEN, WOMEN, KIDS)
- GNB 메뉴에서 4단계 카테고리 자동 수집
- 최종 URL: `/display/category/main?genderGbnCode=...&ctgrNo=...&page=1`
- 상위 최종명: `MEN 라이프스타일` 형식
- 엑셀 로컬 저장

## 로컬 실행

```bash
npm install
npm run dev
```

[http://localhost:3001](http://localhost:3001)

## GitHub

`waterstar21g-png/Category_Item_Url_List`

## 배포

Vercel — `main` 브랜치 push 시 자동 배포

## 사용자 요구사항 보관

`docs/일별_사용자요건/` ([README](./docs/일별_사용자요건/README.md))
