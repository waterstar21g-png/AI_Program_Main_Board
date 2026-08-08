# P1_ZARA_DE (독일자라)

ZARA Deutschland 카테고리 URL 리스트 추출 → 엑셀  
(P1을 복제한 신규 프로젝트)

## 기본값

| 항목 | 값 |
|------|-----|
| 사이트명 | 독일자라 |
| 사이트 URL | `https://www.zara.com/de/en/user/order` |
| 언어 | **영어** (`/de/en`) — 독일어(`/de/de`) 미사용 |
| 카테고리 입력 | **20행 × 3열**. 한 행 = 상위 카테고리명, 중위 카테고리명, 하위 카테고리 URL |
| 수집 | **사용자 DRIVEN** — 입력 하위 URL로 최종 경로에 직접 접근 후 최종 카테고리명 리스트업 |
| 엑셀 | 상위/중위/하위에 **입력 계층명** 반영, 최종명·URL은 사이트 값 |

## 보드

좌측 **P1_ZARA_DE** → 그리드에 상위·중위명과 하위 URL을 입력 후 수집

- 전체 카테고리 메뉴를 기다리지 않고, **입력한 하위 URL**로 바로 들어가 수집
- 하위 URL 칸 폭 = 상위/중위 칸의 **10배**
- 상위/중위 생략 시 **이전 행** 값 복사
- **실행 로그** 그리드에 단계별 로그 실시간 표시
- 수집 종료 시 **최종 스크린샷** (`P1_ZARA_DE/run-logs/<시각>/final.png`) 표시

## CLI

```bat
cd P1_ZARA_DE
python crawl.py --site 독일자라 --url https://www.zara.com/de/en/user/order --tops WOMAN,MAN --out %USERPROFILE%\Downloads
```

## 참고

- 주문/계정 URL이어도 카테고리 수집은 DE 스토어 홈·API로 수행합니다.
- 클라우드/일부 IP에서는 ZARA가 HTTP 403으로 차단할 수 있습니다. **로컬 PC**에서 실행하세요.
