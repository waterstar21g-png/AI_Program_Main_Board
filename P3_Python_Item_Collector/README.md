# P3_Python_Item_Collector — 더망고 상품데이터 대량수집 (Python)

`P2_Product_Capture_App`(Node + Playwright)과 **같은 작업**을 하는 파이썬 독립 버전입니다.
웹앱/Next.js 없이 이 폴더만으로 완결됩니다.

**Playwright 전용 Chromium을 따로 내려받지 않습니다** — PC에 이미 설치된
Chrome 또는 Edge에 CDP로 연결합니다.

## 순서 (요건 원문)

```
0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭
1. URL상품검색하기 : 필드값 입력 후 클릭 -> 팝업창이 없어질 때까지 대기
2. 검색된 상품 모두저장 클릭 -> 팝업창에서 검색필터명 입력 -> 저장하기 버튼 클릭
3. 팝업창이 없어질 때까지 대기
4. -> 0. 초기화
```

팝업창은 스크립트가 **절대 열거나 닫지 않습니다.**

## 실행

1. Python: https://www.python.org/downloads/ (`Add python.exe to PATH` 체크)
2. 엑셀을 **`run.bat`에 드래그 앤 드롭**

```bat
run.bat
run.bat 엑셀파일.xlsx
```

## 수동 실행

```powershell
cd P3_Python_Item_Collector
pip install -r requirements.txt
python collect.py 엑셀파일.xlsx
python collect.py 엑셀파일.xlsx 5
```

엑셀 1행 헤더:

| 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|---|---|
