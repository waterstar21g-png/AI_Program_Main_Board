# PC에서 망고보드 가져오기 — 한 페이지 요약

## ✅ ① GitHub 저장소 생성 — 완료

https://github.com/waterstar21g-png/Mango_Helper_AI_Board

---

## ② 소스 올리기 (PC에서 1회 실행)

**PowerShell** — 부모 저장소에서 망고보드 폴더로 이동 후:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
git pull origin cursor/mango-helper-ai-board-0c73
Set-Location Mango_Helper_AI_Board
.\scripts\publish-standalone.ps1
```

또는 **Git Bash**:

```bash
cd /d/My_Project/AI_Program_Main_Board/Mango_Helper_AI_Board
bash scripts/publish-standalone.sh
```

성공 메시지: `[OK] publish 완료`

> push 권한 오류 시: GitHub Desktop 로그인 또는 `gh auth login` 후 재시도

---

## ③ PC에서 clone · 설정 · 실행

```powershell
Set-Location D:\My_Project
git clone https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git
Set-Location Mango_Helper_AI_Board
.\scripts\setup-pc.ps1
.\run.bat
```

이후 업데이트:

```powershell
Set-Location D:\My_Project\Mango_Helper_AI_Board
.\scripts\pull-update.ps1
```

---

## 질문: 망고보드를 리포지토리로 지정하면 되나?

**네.** PC 작업 루트 = **`D:\My_Project\Mango_Helper_AI_Board`**  
GitHub = **`waterstar21g-png/Mango_Helper_AI_Board`** 만 사용하면 됩니다.

---

## 실행 요약

| 하고 싶은 것 | 명령 |
|-------------|------|
| 망고보드 전체 | `.\run.bat` |
| 프로그램 목록 | `py -3 scripts\launch.py list` |
| 개별 프로그램 | `scripts\launch\` 배치 더블클릭 |

자세한 내용: **PC_SETUP.md**
