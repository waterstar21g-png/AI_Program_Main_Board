# 비즈보드 (독립 실행)

휴대폰 **홈 화면 아이콘**으로 설치하는 비즈니스 바로가기·자동 로그인 보드입니다.  
기존 Python 메인보드(`board/`)와 **완전히 분리**되어 동작합니다.

## 기능

1. PWA 홈 화면 추가 (아이콘: 비즈보드)
2. **20개 이상** 바로가기 URL 타일
3. 타일 클릭 시 사전 정의 ID/PW 로 로그인 절차 수행
   - `form_post` / `form_get`: 로그인 URL로 ID·PW 자동 전송
   - `open_assist`: 로그인 페이지 오픈 + ID/PW 원탭 복사

## 실행

### 로컬 (휴대폰과 같은 Wi‑Fi에서 접속)

```bash
cd biz-board
python3 -m http.server 8787
```

브라우저에서 `http://<PC-IP>:8787` 접속 → **홈 화면에 추가**.

### Vercel / 정적 호스팅

저장소의 `biz-board/` 경로를 정적 배포하면 됩니다.  
예: `https://<domain>/biz-board/`

## 사용

1. **홈 화면에 추가** (iPhone Safari 공유 / Android Chrome 설치)
2. **ID/PW 설정**에서 각 사이트 계정 저장 (기기에만 보관)
3. 타일 클릭 → 로그인 수행

## 파일

| 파일 | 역할 |
|------|------|
| `index.html` | 보드 UI |
| `login.html` | 로그인 실행기 |
| `config.js` | 기본 바로가기 20+ |
| `manifest.webmanifest` | 홈 아이콘/PWA |
| `sw.js` | 오프라인 캐시 |

버전: `VERSION.txt`
