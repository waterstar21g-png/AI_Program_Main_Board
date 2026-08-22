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

| 마켓 | 구분 | 1단계 | 2단계 | 3단계 | 4단계 | 5단계 | 6단계 | 전체경로 |
|------|------|-------|-------|-------|-------|-------|-------|----------|
| 옥션2.0 | | e쿠폰/모바일상품권 | 교육/어학이용권 | 온라인교육/외국어 | | | | (원문 경로) |
| 11번가 | 국내카테고리 | 패션의류 | 남성의류 | 티셔츠 | | | | (원문 경로) |

- 안내 옵션(`- 카테고리를 선택해주세요 -`)과 중복 경로는 제외합니다
- 6단계보다 깊으면 나머지를 6단계에 합쳐 양식(6단계)을 유지하고, 최대 깊이를 로그에 남깁니다

## 마켓 코드

| 코드 | 표기 | 화면 행 |
|------|------|---------|
| `AUC20` | 옥션2.0 (기본) | `tr#mapping_category_AUC20` |
| `11ST` | 11번가 | `tr#mapping_category_11ST` |
| `GMK20` | G마켓2.0 | `tr#mapping_category_GMK20` |
| `SMART` | 스마트스토어 | `tr#mapping_category_SMART` |
| `COUP` | 쿠팡 | `tr#mapping_category_COUP` |
| `LTON` | 롯데ON | `tr#mapping_category_LTON` |
| `ALL` | **전체 마켓 일괄** | 위 6개를 순서대로 |

### 카테고리 구분 (11번가 · 롯데ON)

이 두 마켓은 화면에 구분 라디오가 있고 목록이 서로 다릅니다. **양쪽을 각각 추출**해
엑셀 `구분` 열로 나눠 담습니다.

| 마켓 | 구분 | 라디오 |
|------|------|--------|
| 11번가 | 해외카테고리 / 국내카테고리 | `input[name="openmarket_seller_type2_11ST"]` |
| 롯데ON | 해외직구 카테고리 / 일반카테고리(국내) | `input[name="openmarket_seller_type2_LTON"]` |

라디오는 같은 `label` 안의 `span` 텍스트로 찾고, 클릭하면 `change_category_list(...)`
가 목록을 교체하므로 잠시 기다린 뒤 [전체카테고리] 를 누릅니다.

### 구현 제외 (요건)

화면에 행이 있어도 추출하지 않습니다 — **LFMall · 머스트잇 · 쇼피 ·
큐텐(일본) · 플레이오토(EMP)**. `ALL` 에서도 제외되고, 코드로 직접 지정하면
"구현 제외 마켓입니다" 로 끝냅니다.

마켓마다 목록 select 이 `openmarket_category_search_list_<코드>` 와
`openmarket_category_search_list2_<코드>` 두 벌 있고 보이는 쪽이 다릅니다
(11번가·롯데ON). 둘 다 읽어 **항목이 많은 쪽**을 사용합니다.

## 출력

`output\카테고리분류표_<마켓>_<날짜_시각>.xlsx` (경로 지정 시 그 경로)

## CLI

```powershell
python extract_categories.py                    # 옥션2.0
python extract_categories.py --market ALL       # 6개 마켓 한 파일로
python extract_categories.py --market LTON
python extract_categories.py --out D:\out\분류표.xlsx
python extract_categories.py --from-text 목록.txt   # 브라우저 없이 텍스트 → 엑셀
```

## 보드

망고보드 **P5_카테고리_엑셀추출** 탭 — 마켓 선택 → [추출 시작] → [엑셀 열기]

## 중단

`.p5_stop` 플래그 (보드 [작업중단] 이 생성)
