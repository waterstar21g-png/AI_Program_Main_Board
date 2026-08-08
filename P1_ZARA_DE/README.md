# P1_ZARA_DE (독일자라)

ZARA Deutschland 카테고리 URL 리스트 추출 → 엑셀  
(P1을 복제한 신규 프로젝트)

## 기본값

| 항목 | 값 |
|------|-----|
| 사이트명 | 독일자라 |
| 사이트 URL | `https://www.zara.com/de/en/user/order` |
| 언어 | **영어** (`/de/en`) — 독일어(`/de/de`) 미사용 |
| 카테고리 입력 | **20열 × 3계층** (열=한 경로). 1·2계층 생략 시 **이전 열** 값 복사 |
| 수집 | 입력 계층과 일치하는 노드의 **하위 카테고리 전부** |
| 엑셀 | 상위/중위/하위에 **입력 계층명** 반영 |

## 보드

좌측 **P1_ZARA_DE** → 카테고리 칸에 상위명을 입력 후 수집

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
