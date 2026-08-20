# GitHub 신규 저장소 연결

에이전트 토큰으로는 `Mango_Recreate_Board` 저장소를 **생성할 수 없습니다**.
아래를 완료한 뒤 에이전트에 「레포 생성 완료」라고 알려주세요.

## 1) GitHub에서 빈 저장소 생성

1. https://github.com/new
2. Owner: `waterstar21g-png`
3. Repository name: `Mango_Recreate_Board`
4. Public
5. README / .gitignore / license **모두 체크 해제** (빈 저장소)
6. Create repository

## 2) 로컬에 독립 클론으로 쓰기 (권장)

이 폴더(`Mango_Recreate_Board/`) 전체가 신규 저장소의 루트입니다.

```powershell
Set-Location D:\My_Project
# AI_Program_Main_Board 안의 서브폴더를 독립 저장소로 옮기는 경우:
Copy-Item -Recurse .\AI_Program_Main_Board\Mango_Recreate_Board .\Mango_Recreate_Board_tmp
Set-Location .\Mango_Recreate_Board_tmp
git init
git add .
git commit -m "chore: Mango_Recreate_Board v1.0.0 UI shell"
git branch -M main
git remote add origin https://github.com/waterstar21g-png/Mango_Recreate_Board.git
git push -u origin main
# 완료 후 D:\My_Project\Mango_Recreate_Board 로 rename
```

## 3) 기존 AI_Program_Main_Board

기존 보드·프로그램(P1/P2/P3 등)은 **그대로 유지**합니다.
앞으로 당분간 신규 요구 작업은 **Mango_Recreate_Board** 에서 개발합니다.
