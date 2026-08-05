# AI_Program_Main_Board — Windows 로컬 실행

## 실행 파일 (하나만 사용)

```
C:\Users\water\AI_Program_Main_Board\run.bat
```

**더블클릭** 또는 명령 프롬프트:

```cmd
cd /d C:\Users\water\AI_Program_Main_Board
run.bat
```

## run.bat 이 하는 일

| 순서 | 작업 |
|------|------|
| 1 | 구버전이면 GitHub에서 상품데이터수집·registry 자동 다운로드 |
| 2 | `npm install` |
| 3 | Playwright Chromium 설치 |
| 4 | 브라우저 열고 http://localhost:3000 |

## 사전 준비

- Node.js LTS: https://nodejs.org

## run.bat 이 없을 때

```cmd
cd /d C:\Users\water\AI_Program_Main_Board
curl -o run.bat https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main/run.bat
run.bat
```

`curl` 실패 시 → GitHub **Download ZIP** → 폴더 통째 교체

## 보드 프로그램

1. **Category_Item_Url_List**
2. **상품데이터수집**

## Node.js

https://nodejs.org — LTS
