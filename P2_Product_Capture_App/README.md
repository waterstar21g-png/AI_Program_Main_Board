# P2_Product_Capture_App

더망고(tmg1898) URL 엑셀 기반 상품 대량수집 **배치** (Playwright + CDP).
Next.js 보드 없이 이 폴더만으로 실행됩니다.

같은 작업을 Python으로 돌리려면 **P3_Python_Item_Collector** 를 쓰세요.

## 실행 (Windows)

1. Node.js 설치
2. Chrome 또는 Edge (평소 더망고에 쓰는 브라우저)
3. 엑셀을 `run.bat`에 드래그 앤 드롭

```bat
run.bat 카테고리URL.xlsx
run.bat 카테고리URL.xlsx 5
```

## 엑셀 필수 열

| 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|---|---|

(P1 출력 양식 그대로 사용 가능)

## 워크플로

```
0. 초기화 : 상품데이터수집 → 대량데이터수집
1. URL상품검색하기 → 팝업 자연 종료 대기
2. 검색된 상품 모두저장 → 검색필터명 → 저장하기
3. 팝업 자연 종료 대기
4. → 0. 초기화
```
