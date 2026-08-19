# 비즈 보드 (Biz Board) — 독립 실행

휴대폰 **홈 화면 아이콘** → **바로가기 URL 20+** → 각 URL **사전 정의 ID/PW 로그인**.

메인보드(P1/P2/P3)와 **완전히 분리**된 프로그램입니다.

## 실행

```bat
biz_board\run.bat
```

또는:

```bash
cd biz_board
python server.py
```

- PC: `http://127.0.0.1:8787/`
- 휴대폰(같은 Wi-Fi): 콘솔에 표시되는 `http://<PC-IP>:8787/`

## 휴대폰 홈 아이콘

1. Phone URL로 접속
2. Safari/Chrome 메뉴 → **홈 화면에 추가**
3. 홈의 **비즈보드** 아이콘 탭 → 바로가기 보드

## ID / PW

1. 보드에서 **ID/PW 설정** 또는
2. `biz_board/sites.local.json` 편집 (`sites.example.json` 복사본)

`sites.local.json` 은 Git에 커밋하지 마세요.

## 로그인 동작

| 환경 | 동작 |
|------|------|
| 휴대폰 | URL 열기 + ID/PW 복사 붙여넣기 (또는 설정값 사용) |
| PC 서버 | **자동 로그인** 버튼 → Playwright가 Chromium에서 ID/PW 입력·제출 |

## 포함 바로가기 (24개)

더망고 · Cafe24 · 스마트스토어 · 네이버 · 네이버쇼핑 · 쿠팡 · 쿠팡윙 · 도매꾹 · 도매매 · 1688 · Alibaba · TaoBao · 아이템소싱 · ABC마트 · ZARA DE · G마켓 · 옥션 · 11번가 · 카카오비즈 · 네이버광고 · 사방넷 · 플레이오토 · 셀메이트 · ESM+

URL·셀렉터는 `sites.local.json`에서 수정 가능합니다.

## 버전

`biz_board/VERSION.txt`
