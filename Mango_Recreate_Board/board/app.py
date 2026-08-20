"""
Mango_Recreate_Board — 메인 UI 셸
(AI_Program_Main_Board 메인 보드 UI만 복사 · 프로그램은 추후 추가)
"""

from __future__ import annotations

import os
import re
import sys
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "board"))

from self_update import (  # noqa: E402
    latest_open_pr_url,
    launch_external_updater,
    local_version,
)


def _read_version() -> str:
    """VERSION.txt(저장소 루트)를 단일 소스로 읽는다."""
    try:
        text = (ROOT / "VERSION.txt").read_text(encoding="utf-8")
        m = re.search(r"(?:버전|version)\s*([0-9]+(?:\.[0-9]+)+)", text, re.I)
        if not m:
            m = re.search(r"([0-9]+\.[0-9]+\.[0-9]+)", text)
        if m:
            return m.group(1)
    except OSError:
        pass
    return "?"


VERSION = _read_version()
APP_TITLE = "Mango_Recreate_Board"


class BoardApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_TITLE}  v{VERSION}")
        self.geometry("1280x900")
        self.minsize(1024, 760)
        self.configure(bg="#1a4d5c")
        self._merge_update_busy = False
        self._build()

    def _build(self) -> None:
        head = tk.Frame(self, bg="#164a59", pady=10)
        head.pack(fill="x")
        tk.Label(
            head,
            text=APP_TITLE,
            fg="white",
            bg="#164a59",
            font=("Malgun Gothic", 14, "bold"),
        ).pack()
        tk.Label(
            head,
            text="메인 UI 셸 · 신규 프로그램 추가 예정",
            fg="#cbd5e1",
            bg="#164a59",
            font=("Malgun Gothic", 9),
        ).pack()

        body = tk.Frame(self, bg="#1a4d5c")
        body.pack(fill="both", expand=True, padx=8, pady=8)

        side = tk.Frame(body, bg="#d9d9d9", width=180)
        side.pack(side="left", fill="y", padx=(0, 8))
        side.pack_propagate(False)

        tk.Label(
            side,
            text=f"v{VERSION}\n프로그램",
            bg="#2563eb",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            pady=8,
        ).pack(fill="x")

        # 프로그램 버튼 영역 — 추후 신규 프로그램 추가 시 여기에 pack
        self.side_programs = tk.Frame(side, bg="#d9d9d9")
        self.side_programs.pack(fill="both", expand=True)
        tk.Label(
            self.side_programs,
            text="(프로그램 없음)\n추가 예정",
            bg="#d9d9d9",
            fg="#64748b",
            font=("Malgun Gothic", 8),
            justify="center",
            pady=16,
        ).pack(fill="x", padx=8)

        side_bottom = tk.Frame(side, bg="#d9d9d9")
        side_bottom.pack(side="bottom", fill="x", padx=6, pady=(4, 10))
        self.lbl_update_hint = tk.Label(
            side_bottom,
            text="종료 후 강제 버전갱신",
            bg="#d9d9d9",
            fg="#475569",
            font=("Malgun Gothic", 8),
        )
        self.lbl_update_hint.pack(fill="x", pady=(0, 4))
        self.btn_merge_update = tk.Button(
            side_bottom,
            text="머지반영\n업데이트",
            command=self._run_merge_update,
            bg="#0f766e",
            fg="white",
            activebackground="#0d9488",
            activeforeground="white",
            font=("Malgun Gothic", 9, "bold"),
            relief="raised",
            pady=12,
            cursor="hand2",
        )
        self.btn_merge_update.pack(fill="x")
        self.lbl_update_status = tk.Label(
            side_bottom,
            text=f"현재 v{VERSION}\n(또는 바탕화면 버전갱신)",
            bg="#d9d9d9",
            fg="#64748b",
            font=("Malgun Gothic", 7),
            wraplength=160,
            justify="left",
        )
        self.lbl_update_status.pack(fill="x", pady=(4, 0))

        self.main = tk.Frame(body, bg="#f1f5f9")
        self.main.pack(side="left", fill="both", expand=True)

        self.frame_home = tk.Frame(self.main, bg="#f1f5f9", padx=12, pady=10)
        self.frame_home.pack(fill="both", expand=True)
        self._build_home(self.frame_home)

    def _build_home(self, parent: tk.Frame) -> None:
        tk.Label(
            parent,
            text="Mango_Recreate_Board — 메인 보드",
            bg="#f1f5f9",
            fg="#0f172a",
            font=("Malgun Gothic", 13, "bold"),
            anchor="w",
        ).pack(fill="x", pady=(4, 8))

        panel = tk.Frame(parent, bg="#ffffff", padx=16, pady=16, relief="solid", bd=1)
        panel.pack(fill="both", expand=True)

        tk.Label(
            panel,
            text="AI_Program_Main_Board 메인 UI만 복사한 신규 보드입니다.",
            bg="#ffffff",
            fg="#334155",
            font=("Malgun Gothic", 10),
            anchor="w",
            justify="left",
        ).pack(fill="x", pady=(0, 8))
        tk.Label(
            panel,
            text="좌측 프로그램 목록은 비어 있습니다.\n여기에 신규 프로그램을 추가할 예정입니다.",
            bg="#ffffff",
            fg="#64748b",
            font=("Malgun Gothic", 9),
            anchor="w",
            justify="left",
        ).pack(fill="x")

        self.home_status = tk.Label(
            parent,
            text=f"준비됨 · v{VERSION}",
            bg="#f1f5f9",
            fg="#15803d",
            font=("Malgun Gothic", 9),
            anchor="w",
        )
        self.home_status.pack(fill="x", pady=(8, 0))

    def _run_merge_update(self) -> None:
        """보드를 종료한 뒤 외부 스크립트로 GitHub main 강제 반영·재시작."""
        if self._merge_update_busy:
            messagebox.showinfo("안내", "이미 업데이트를 진행 중입니다.")
            return

        pr_url = ""
        try:
            pr_url = latest_open_pr_url()
        except Exception:
            pr_url = "https://github.com/waterstar21g-png/Mango_Recreate_Board/pulls"

        cur = local_version(ROOT) or VERSION
        msg = (
            "보드를 종료한 뒤 GitHub main 을 강제 반영하고 재시작합니다.\n\n"
            f"현재 버전: v{cur}\n\n"
            "아직 PR 머지 전이면 아래 머지 URL에서 먼저 머지하세요.\n"
            f"{pr_url}\n\n"
            "계속할까요?"
        )
        if not messagebox.askyesno("머지반영 업데이트", msg, parent=self):
            return

        try:
            if pr_url.startswith("http"):
                webbrowser.open(pr_url)
        except Exception:
            pass

        self._merge_update_busy = True
        self.btn_merge_update.configure(state="disabled", text="종료 후 갱신…")
        self.lbl_update_status.configure(
            text="보드 종료 → 강제 버전갱신 → 재시작",
            fg="#0f172a",
        )

        ok, detail = launch_external_updater(ROOT, wait_pid=os.getpid())
        if not ok:
            self._merge_update_busy = False
            self.btn_merge_update.configure(state="normal", text="머지반영\n업데이트")
            self.lbl_update_status.configure(text="업데이터 실행 실패", fg="#b91c1c")
            messagebox.showerror(
                "업데이트 실패",
                "외부 버전갱신 실행에 실패했습니다.\n\n"
                f"{detail}\n\n"
                "바탕화면 '망고보드_버전갱신' 아이콘을 사용하세요.\n"
                f"머지 URL:\n{pr_url}",
                parent=self,
            )
            return

        messagebox.showinfo(
            "버전갱신 시작",
            "보드를 종료합니다.\n\n"
            "이어서 자동으로:\n"
            "1) GitHub main 강제 반영\n"
            "2) 보드 재시작\n\n"
            f"(실패 시 바탕화면 '망고보드_버전갱신' 아이콘)\n"
            f"머지 URL:\n{pr_url}",
            parent=self,
        )
        try:
            self.destroy()
        except Exception:
            pass
        sys.exit(0)


def main() -> None:
    app = BoardApp()
    app.mainloop()


if __name__ == "__main__":
    main()
