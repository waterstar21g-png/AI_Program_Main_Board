# P3_필터단위_수집조건수정

`P2_필터단위_상품수변경` 을 복제해, 입력값을 **번역옵션(리스트박스 선택)** 으로
바꾼 프로그램입니다. 더망고 **필터 목록**의 각 행에 선택한 번역옵션을 일괄 적용합니다.

## 입력 (리스트박스 2개)

- **수집사이트** — 목록 화면 검색줄 `select[name="site_id"]` 값
  - `-- 수집사이트 --` (전체) · `4910.kr` · `ABCmart.a-rt.com` · `HIVER.co.kr` ·
    `MUSINSA.com` · `Zara.com/de`
  - 전체가 아니면 그 사이트로 **검색을 걸고** 결과 행만 처리합니다
- **번역옵션** — 팝업의 「번역 후 저장」 `select[name="translate_method"]` 값
  - `번역안함` · `더망고 무료 번역기 사용` · `구글 번역기 사용` ·
    `DeepL 번역기 사용` · `네이버(클라우드) 번역기 사용`
- 두 목록 모두 보드 **[망고에서 옵션 읽기]**(또는 `--list-options`) 로 실제 화면에서
  다시 읽어 `.site_options.json` · `.translate_options.json` 에 캐시합니다
- **망고 URL** — 첫 화면(검색필터 목록) 기본값
  `https://tmg1898.cafe24.com/mall/admin/shop/getGoodsCategory.php`
  (비우면 Chrome 에 열려 있는 화면 사용)

## 동작

1. 필터 목록 화면 연결 → (수집사이트 선택 시) 검색 적용
2. 각 행마다:
   - `[수집조건수정]` 클릭 → **팝업창** 열림
     (`admin_group_modify.php?ps_mode=modify_filter&ps_fuid=…`)
   - 팝업의 「번역 후 저장」 리스트박스에서 선택값 적용
   - 하단 **[저장하기]**(`onclick="set_save()"`) 클릭 → 저장 수행
   - 저장 알림은 자동 확인, 팝업(`window.close()`) 닫힘까지 대기
3. 목록 페이지는 그대로 두고 다음 행 진행 (검색조건이 풀리지 않음)

팝업 클릭이 막히면 팝업 URL 을 직접 열고, `[저장하기]` 요소를 못 찾으면
`set_save()` 를 직접 호출하는 폴백이 있습니다. 번역옵션 컨트롤은 select 외에
라디오·체크박스 형태도 라벨(`번역 후 저장`·`번역옵션`·`번역`)로 찾아냅니다.

## CLI

```powershell
python update_collect_option.py --list-options
python update_collect_option.py --translate-option "구글 번역기 사용"
python update_collect_option.py --translate-option "구글 번역기 사용" --collect-site "MUSINSA.com"
python update_collect_option.py --translate-option "번역안함" --mango-url "https://..."
```

`--list-options` 출력은 `##OPTION##<번역옵션>` · `##SITE##<수집사이트>` 형식이며,
보드가 이 줄만 파싱해 두 리스트박스를 채웁니다.

## 보드

망고보드 **P3_필터단위_수집조건수정** 탭 — 리스트박스에서 선택 → [작업시작]

## 중단

`.option_stop` 플래그 (보드 [작업중단] 이 생성)
