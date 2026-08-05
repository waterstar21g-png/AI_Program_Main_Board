# AI_Program_Main_Board — Windows 로컬 실행

## 폴더 예시

```
D:\함께온라인\AI_Program_Main_Board\
└── run.bat    ← 설치 + 실행 (이 파일만 사용)
```

## 1. 사전 준비

- **Node.js LTS**: https://nodejs.org
- 프로젝트 폴더를 PC에 둠 (Git clone 등)

## 2. 실행

**`run.bat`** 또는 **`start.bat`** 더블클릭 (내용 동일)

`run.bat`이 없다고 나오면 **`update.bat`** 실행 후 다시 시도:

```cmd
cd /d C:\Users\water\AI_Program_Main_Board
.\update.bat
.\run.bat
```

또는 Git이 있으면:

```cmd
git pull
dir *.bat
```

`run.bat`이 목록에 없으면 GitHub에서 최신 소스를 다시 받거나 `start.bat`을 실행하세요.

**`npm run dev:fast`만으로도 실행 가능** (브라우저: http://localhost:3000)

- 주소: **http://localhost:3000**
- 종료: 명령 창에서 **Ctrl+C**

Chromium 설치가 실패한 경우:

```cmd
npx playwright install chromium
```

## 3. 프로그램

좌측 **프로그램 목록**에서 선택합니다.

| 프로그램 | 설명 |
|----------|------|
| **Category_Item_Url_List** | 카테고리 URL 엑셀 추출 (API 키 불필요) |
| **상품데이터수집** | 더망고 로그인 + 엑셀 URL 자동 수집 (Playwright) |

`Category_Item_Url_List`와 `상품데이터수집`은 별개 프로그램입니다.

## 참고

- `start.bat`, `setup.bat`은 예전 이름이며, 내부에서 `run.bat`을 호출합니다.
- `build.bat`, `start-prod.bat`, `check.bat`은 제거되었습니다. 일반 사용은 `run.bat`만 쓰면 됩니다.
