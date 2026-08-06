* 최종 버전 --> 2.2.11
* 로컬PC 보관 --> OK
* Vercel 배포 --> Not-OK
* GitHUB Commit --> OK

1. 요구사항 요청 받은 날짜·시간
2026-08-06 (KST) — TurbopackInternalError 보고

2. 요구사항 반영 완료 날짜·시간
2026-08-06 09:40:47 (KST)

3. 반영된 프로그램 버전
2.2.11

4. 최종본 위치
- 로컬PC: raw 복구 후 localhost:3000 (APP_VERSION 2.2.11, webpack dev)
- Vercel: Not-OK
- GitHub: branch cursor/fix-runbat-encoding-dcbc

5. 사용자 작성 원문 전체

```
Error [TurbopackInternalError]: Failed to write page endpoint /elastic-beanstalk
```

6. 반영 내용
- 기본 dev를 Turbopack(--turbo) → webpack 으로 변경 (Windows 안정화)
- 잔여 app/elastic-beanstalk 폴더 자동 삭제
- turbopack.root 설정, 버전 2.2.11
