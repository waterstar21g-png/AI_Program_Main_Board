# PC에서 망고보드 가져오기 — 한 페이지 요약

## 질문: 망고보드를 리포지토리로 지정하면 되나?

**네. 맞습니다.**

PC에서 지금까지 작업한 소스를 **그대로** 이어서 쓰려면:

- **저장소(리포지토리) = `Mango_Helper_AI_Board` (망고보드)**
- **PC 폴더 = `D:\My_Project\Mango_Helper_AI_Board`**

이렇게 **망고보드만** clone 하면 됩니다.  
`AI_Program_Main_Board` 전체를 받을 필요는 없습니다.

---

## PC에서 할 일 (3단계)

### ① GitHub에 빈 저장소 만들기 (최초 1회, 1분)

1. https://github.com/new
2. Repository name: **`Mango_Helper_AI_Board`**
3. Public, **README 추가하지 않음**
4. Create repository

### ② 소스 올리기 (최초 1회)

이미 `AI_Program_Main_Board` 를 받아 둔 PC라면:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board\Mango_Helper_AI_Board
.\scripts\publish-standalone.ps1
```

### ③ PC에서 받아서 작업 (이후 매번)

```powershell
Set-Location D:\My_Project
git clone https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git
Set-Location Mango_Helper_AI_Board
.\scripts\setup-pc.ps1
.\run.bat
```

---

## 아직 ①②를 안 했다면 (임시)

독립 repo 가 없을 때는 부모 저장소 브랜치로 동일 소스를 받을 수 있습니다.

```powershell
Set-Location D:\My_Project
git clone -b cursor/mango-helper-ai-board-0c73 https://github.com/waterstar21g-png/AI_Program_Main_Board.git
Set-Location AI_Program_Main_Board\Mango_Helper_AI_Board
.\scripts\setup-pc.ps1
.\run.bat
```

**①② 완료 후에는 위 임시 방법 대신 `Mango_Helper_AI_Board` 만 clone 하세요.**

---

## 실행 요약

| 하고 싶은 것 | 명령 |
|-------------|------|
| 망고보드 전체 | `.\run.bat` |
| 프로그램 목록 | `py -3 scripts\launch.py list` |
| 개별 프로그램 | `scripts\launch\` 배치 더블클릭 |
| 최신 소스 받기 | `.\scripts\pull-update.ps1` |

자세한 내용: **PC_SETUP.md**
