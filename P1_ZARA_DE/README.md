# P1_ZARA_DE (독일자라)

ZARA Deutschland 카테고리 URL 리스트 추출 → 엑셀  
(P1을 복제한 신규 프로젝트)

## 기본값

| 항목 | 값 |
|------|-----|
| 사이트명 | 독일자라 |
| 사이트 URL | `https://www.zara.com/de/en/user/order` |
| 언어 | **영어** (`/de/en`) — 독일어(`/de/de`) 미사용 |
| 상위 카테고리 | **입력으로 지정** (예: WOMAN, MAN, KIDS) |

## 보드

좌측 **P1_ZARA_DE** → 카테고리 칸에 상위명을 입력 후 수집

## CLI

```bat
cd P1_ZARA_DE
python crawl.py --site 독일자라 --url https://www.zara.com/de/en/user/order --tops WOMAN,MAN --out %USERPROFILE%\Downloads
```

## 참고

- 주문/계정 URL이어도 카테고리 수집은 DE 스토어 홈·API로 수행합니다.
- 클라우드/일부 IP에서는 ZARA가 HTTP 403으로 차단할 수 있습니다. **로컬 PC**에서 실행하세요.
