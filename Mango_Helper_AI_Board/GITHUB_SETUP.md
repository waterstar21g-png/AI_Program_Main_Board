# GitHub — 망고보드(Mango_Helper_AI_Board) 저장소

**망고보드**는 GitHub 저장소 **`Mango_Helper_AI_Board`** 로 관리합니다.

| 항목 | 값 |
|------|-----|
| Repository name | `Mango_Helper_AI_Board` |
| URL | https://github.com/waterstar21g-png/Mango_Helper_AI_Board |
| PC 경로 | `D:\My_Project\Mango_Helper_AI_Board` |

---

## 1. 독립 저장소 최초 생성 (1회)

1. https://github.com/new
2. Repository name: **`Mango_Helper_AI_Board`**
3. Public, README **추가하지 않음**
4. Create repository

### PC에서 publish

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board\Mango_Helper_AI_Board
# 또는 독립 clone 경로
.\scripts\publish-standalone.ps1
```

또는 수동:

```powershell
Set-Location D:\My_Project\Mango_Helper_AI_Board
git init -b main
git add -A
git commit -m "feat: Mango_Helper_AI_Board 망고보드 초기"
git remote add origin https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git
git push -u origin main
```

---

## 2. 부모 저장소에서 개발 중 (현재)

개발 브랜치: `cursor/mango-helper-ai-board-0c73`  
부모 repo: `AI_Program_Main_Board`  
폴더: `Mango_Helper_AI_Board/`

```powershell
git clone -b cursor/mango-helper-ai-board-0c73 https://github.com/waterstar21g-png/AI_Program_Main_Board.git
cd AI_Program_Main_Board\Mango_Helper_AI_Board
```

---

## 3. PC 일상 업데이트

```powershell
# 독립 repo
.\scripts\pull-update.ps1

# 또는 수동
git pull origin main
```

---

## 4. Cloud Agent 토큰 제한

자동으로 신규 GitHub 저장소를 만들 권한이 없을 수 있습니다.  
이 경우 **방법 1(웹에서 repo 생성)** 후 `publish-standalone.ps1` 을 실행하세요.
