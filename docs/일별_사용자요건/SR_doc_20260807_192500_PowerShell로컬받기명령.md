* 최종 버전 --> 3.4.1 + AI_Program_Main_Board_New 2.0.4
* 로컬PC 보관 --> OK
* Vercel 배포 --> Not-OK
* GitHUB Commit --> OK

1. 요구사항 요청 받은 날짜·시간: 2026-08-07 19:00~19:24 KST
2. 요구사항 반영 완료 날짜·시간: 2026-08-07 19:25 KST
3. 반영된 프로그램 버전: fetch-local.ps1 / LOCAL_WORKSPACE PowerShell 명령
4. 최종본 위치:
- 로컬PC: D:\My_Project\AI_Program_Main_Board (모든 프로그램 이 안)
- GitHub: LOCAL_WORKSPACE.md, fetch-local.ps1, README
- Vercel: 미해당

5. 사용자 작성 원문 전체:

D:\My_Project\AI_Program_Main_Board 에 모든 프로그램을 담도록 
위 명령어들을 수정해 ...

(이어서 PowerShell에서 CMD 문법 사용 오류 로그)

PS D:\My_Project> mkdir D:\My_Project\AI_Program_Main_Board 2>nul
...
PS D:\My_Project> cd /d D:\My_Project\AI_Program_Main_Board
...
PS D:\My_Project> curl -L -o New.zip ...
...
PS D:\My_Project\AI_Program_Main_Board_New> run.bat
...

---

반영 요약:
- PowerShell용 명령으로 교체 (New-Item, Set-Location, Invoke-WebRequest, Expand-Archive, .\run.bat)
- 대상 고정: D:\My_Project\AI_Program_Main_Board 안에 저장소 전체
- fetch-local.ps1 추가
