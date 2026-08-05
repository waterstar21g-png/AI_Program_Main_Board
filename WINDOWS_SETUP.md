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

- **Category_Item_Url_List** — API 키 없이 사용
- **상품캡처 및 가격조회** — `.env.local` API 키 필요

## Node.js

https://nodejs.org — LTS 버전 설치
