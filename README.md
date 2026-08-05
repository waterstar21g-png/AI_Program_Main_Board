# 카테고리별_상품목록_URL_LIST추출

네이버 쇼핑 **카테고리별 대표 URL**과 **상품 URL**을 추출해 **엑셀(.xlsx)** 파일로 저장하는 웹 앱입니다.

## 핵심 기능

- 카테고리명 + `catId`(또는 목록 URL) 입력
- 네이버 쇼핑 대분류 10개 일괄 불러오기
- 일괄 붙여넣기 (`카테고리명, catId, 추출개수`)
- 카테고리별 상품 URL 추출 (네이버 검색 API)
- 엑셀 다운로드: 카테고리 · 카테고리대표URL · 순번 · 상품명 · 상품URL · 가격 · 쇼핑몰

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 입력
npm run dev
```

[http://localhost:3001](http://localhost:3001)

## 환경 변수

| 변수 | 설명 |
|------|------|
| `NAVER_CLIENT_ID` | 네이버 개발자센터 검색 API Client ID |
| `NAVER_CLIENT_SECRET` | Client Secret |

API 키가 없으면 **카테고리 대표 URL만** 엑셀에 포함됩니다.

## GitHub 레포 연결

GitHub에서 빈 레포 `카테고리별_상품목록_URL_LIST추출` 생성 후:

```bash
git remote add origin https://github.com/waterstar21g-png/카테고리별_상품목록_URL_LIST추출.git
git push -u origin main
git push -u origin cursor/category-url-list-extract-dcbc
```

## 배포

Vercel에서 GitHub 레포 Import 후 환경 변수를 설정하세요.

## 사용자 요구사항 보관

`docs/일별_사용자요건/` — 커밋 시점마다 SR 문서 보관 ([README](./docs/일별_사용자요건/README.md))
