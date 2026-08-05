# AI_Program_Main_Board (로컬 실행)

## Windows — 로컬 실행 (권장)

| 파일 | 설명 |
|------|------|
| `setup.bat` | 최초 1회 설치 |
| `start.bat` | 개발 모드 실행 |
| `build.bat` | 프로덕션 빌드 |
| `start-prod.bat` | 빌드 후 로컬 실행 |

자세한 내용: [WINDOWS_SETUP.md](./WINDOWS_SETUP.md)

## Mac / Linux

```bash
npm install
npm run dev:fast
```

브라우저: http://localhost:3000

## 포함 프로그램

| 좌측 목록 | 설명 |
|-----------|------|
| Category_Item_Url_List | 카테고리 URL 엑셀 추출 (API 키 불필요) |
| **상품데이터수집** | 더망고 엑셀 URL 자동 수집 (Playwright, 로컬) |
| 상품캡처 및 가격조회 | 사진·키워드 가격 조회 (`.env.local` API 키 필요) |

## 프로그램 추가

`lib/programs/registry.tsx` → `PROGRAMS` 배열에 항목 추가

## 환경 변수 (상품캡처만 해당)

`.env.example` → `.env.local` 복사 후 입력:

```
OPENAI_API_KEY=...
ITEMSCOUT_API_KEY=...
```
