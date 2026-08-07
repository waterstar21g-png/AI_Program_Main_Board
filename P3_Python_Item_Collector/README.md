# P3_Python_Item_Collector — 더망고 상품데이터 대량수집 (Python)

`AI_Program_Main_Board`의 **P2_Product_Capture_App**(Node CLI)과 **같은 작업**을 하는 파이썬 독립 버전입니다.
이 폴더만으로 완결됩니다.
**Playwright 전용 Chromium을 따로 내려받지 않습니다** — PC에 이미 설치된
Chrome 또는 Edge(평소 망고 화면을 여는 그 브라우저)에 그대로 연결해서 씁니다.

## 순서 (요건 원문)

```
0. 초기화 : 상품데이터수집 -> 대량데이터수집 클릭
1. URL상품검색하기 : 필드값 입력 후 클릭 -> 팝업창이 없어질 때까지 대기
2. 검색된 상품 모두저장 클릭 -> 팝업창에서 검색필터명 입력 -> 저장하기 버튼 클릭
3. 팝업창이 없어질 때까지 대기
4. -> 0. 초기화
```

팝업창은 스크립트가 **절대 열거나 닫지 않습니다.** 항상 스스로 닫힐 때까지만 기다립니다.

## 실행 (한 번에 — run.bat)

1. Python이 없으면 먼저 설치: https://www.python.org/downloads/
   (설치 화면에서 **"Add python.exe to PATH"** 체크)
2. Chrome 또는 Edge는 원래 쓰던 그대로 두면 됩니다 (별도 설치 불필요)
3. 엑셀 파일을 **`run.bat`에 드래그 앤 드롭**
   - 또는 `run.bat` 더블클릭 후 엑셀 경로를 직접 입력

`run.bat`이 자동으로 하는 일:
- 패키지 설치 (`pip install` — Playwright는 CDP 연결용으로만 사용)
- `collect.py` 실행

## 브라우저 동작 방식

- 이미 더망고 화면을 열어둔 Chrome/Edge 창이 있으면 **그 탭을 그대로** 이어서 씁니다(로그인 다시 안 함, 새 창 안 뜸).
- 열려 있는 게 없으면 평소 쓰는 Chrome(없으면 Edge)을 디버그 모드로 새로 띄우고, 메인화면(`admin.php`)에서 시작합니다.
- 세션이 살아있으면 로그인 화면을 거치지 않고 바로 메인화면 → 0.초기화(대량데이터수집)로 진행합니다.
- 세션이 만료됐을 때만 화면에서 직접 로그인 후, 실행 중인 검은 창(터미널)에서 **Enter**를 누르면 계속 진행됩니다.
- 로그인 정보는 `.chrome-profile` 폴더(새 창을 띄운 경우만 해당)에 저장됩니다.

## 수동 설치 · 실행 (선택)

Windows PowerShell에서:

```powershell
cd P3_Python_Item_Collector
pip install -r requirements.txt
python collect.py 엑셀파일.xlsx
python collect.py 엑셀파일.xlsx 5    # 저장수 5개 (기본 3)
```

엑셀 1행(헤더)에 아래 두 열이 있어야 합니다.

| 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|---|---|
| 예: 스니커즈 | https://... |

## 문제 생김

행 처리 중 오류가 나면 터미널에 이유가 뜨고, 계속할지(y) 멈출지(n) 물어봅니다.
브라우저 화면의 항목 이름(버튼/필드 문구)이 다르면 그 문구를 알려주세요.
