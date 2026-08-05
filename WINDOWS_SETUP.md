# AI_Program_Main_Board — Windows 로컬 설치

## 폴더 예시

```
D:\함께온라인\AI_Program_Main_Board\
├── setup.bat        ← 최초 1회 설치
├── start.bat        ← 개발 모드 실행 (권장)
├── build.bat        ← 프로덕션 빌드
├── start-prod.bat   ← 빌드 후 로컬 프로덕션 실행
└── check.bat        ← 환경 점검
```

## 1. 다운로드

```cmd
mkdir D:\함께온라인
cd /d D:\함께온라인
git clone https://github.com/waterstar21g-png/sangpum-capture-price.git AI_Program_Main_Board
cd AI_Program_Main_Board
```

## 2. 설치 (1회)

`setup.bat` 더블클릭

## 3. 실행

| 파일 | 용도 |
|------|------|
| **start.bat** | 매일 사용 — 개발 서버, 자동 브라우저 열기 |
| build.bat → start-prod.bat | 빌드 후 빠른 로컬 실행 |

브라우저: **http://localhost:3000**

## 4. 프로그램

좌측 **프로그램 목록**에서 선택합니다.

| 프로그램 | 설명 |
|----------|------|
| **Category_Item_Url_List** | 카테고리 URL 엑셀 추출 (기존, API 키 불필요) |
| **상품데이터수집** | 더망고 로그인 + 엑셀 URL 자동 수집 (신규, Playwright) |
| 상품캡처 및 가격조회 | `.env.local` API 키 필요 |

`Category_Item_Url_List`와 `상품데이터수집`은 서로 별개 프로그램입니다.

상품데이터수집은 `setup.bat`에서 Chromium을 설치합니다. 실패 시:

```cmd
npx playwright install chromium
```

## Node.js

https://nodejs.org — LTS 버전 설치
