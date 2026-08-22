# P5_카테고리_엑셀추출

오픈마켓 **전체 카테고리**를 읽어 **카테고리분류표(1~6단계)** 엑셀로 저장합니다.

## 접근 URL

```
https://tmg1898.cafe24.com/mall/admin/admin_category_set.php?tm=F&ps_ftid=790
```

## 동작 (스크린샷 순서)

1. 위 화면 접속 — 마켓별 매핑 행 (`tr#mapping_category_AUC20` = 옥션2.0)
2. **[전체카테고리]** 클릭
   `<a onclick="search_category('AUC20','openmarket_category_search_list_AUC20','allview');">`
3. 목록 리스트박스가 채워질 때까지 대기 (ajax, 최대 15초)
   `select#openmarket_category_search_list_AUC20`
4. 옵션 전체를 읽어 `>` 기준으로 쪼개 **1~6단계**로 정리 → 엑셀 저장

예시 — `e쿠폰/모바일상품권 > 교육/어학이용권 > 온라인교육/외국어`

| 마켓 | 1단계 | 2단계 | 3단계 | 4단계 | 5단계 | 6단계 | 전체경로 |
|------|-------|-------|-------|-------|-------|-------|----------|
| 옥션2.0 | e쿠폰/모바일상품권 | 교육/어학이용권 | 온라인교육/외국어 | | | | e쿠폰/모바일상품권 > 교육/어학이용권 > 온라인교육/외국어 |

- 안내 옵션(`- 카테고리를 선택해주세요 -`)과 중복 경로는 제외합니다
- 6단계보다 깊으면 나머지를 6단계에 합쳐 양식(6단계)을 유지하고, 최대 깊이를 로그에 남깁니다

## 마켓 코드

| 코드 | 표기 |
|------|------|
| `AUC20` | 옥션2.0 (기본) |
| `GMK20` | 지마켓2.0 |
| `11ST` | 11번가 |
| `IPST` | 인터파크 |
| `WMP` | 위메프 |

## 출력

`output\카테고리분류표_<마켓>_<날짜_시각>.xlsx` (경로 지정 시 그 경로)

## CLI

```powershell
python extract_categories.py
python extract_categories.py --market GMK20
python extract_categories.py --out D:\out\분류표.xlsx
python extract_categories.py --from-text 목록.txt   # 브라우저 없이 텍스트 → 엑셀
```

## 보드

망고보드 **P5_카테고리_엑셀추출** 탭 — 마켓 선택 → [추출 시작] → [엑셀 열기]

## 중단

`.p5_stop` 플래그 (보드 [작업중단] 이 생성)
