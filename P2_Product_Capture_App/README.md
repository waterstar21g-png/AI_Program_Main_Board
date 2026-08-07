# P2_Product_Capture_App — 더망고 상품 대량수집 (Node 배치)

P1 엑셀(또는 동일 양식)을 읽어 더망고 관리자에서 대량수집을 돌립니다.
Next.js/웹보드 없이 **이 폴더만**으로 실행합니다.

## 순서 (요건)

```
0. 초기화 : 상품데이터수집 -> 대량데이터수집
1. URL상품검색하기 → 팝업 닫힐 때까지 대기
2. 모두저장 → 검색필터명 → 저장하기
3. 팝업 닫힐 때까지 대기
4. → 0. 초기화
```

## 실행

```bat
run.bat 엑셀파일.xlsx
run.bat 엑셀파일.xlsx 5
```

엑셀을 `run.bat`에 드래그해도 됩니다.

## 브라우저

- PC Chrome/Edge에 CDP(`9222`)로 연결 (Playwright 전용 Chromium 미사용)
- 로컬 PC 전용

## 요구사항

- Node.js 20+
- 최초 1회 `npm install` (`run.bat` 자동)
- P3와 같은 업무의 파이썬 버전은 `../P3_Python_Item_Collector`
