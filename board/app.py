"""
AI_Program_Main_Board — Python B안 보드 (P1 / P2=구P3)
아주 단순한 UI, 필요한 기능만.
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "P1"))
sys.path.insert(0, str(ROOT / "P2"))
sys.path.insert(0, str(ROOT / "board"))

from crawl import crawl_site, save_excel  # noqa: E402
from library import (  # noqa: E402
    add_paths,
    default_roots,
    entries_annotated,
    is_in_library,
    load,
    remove_path,
    search_xlsx,
    set_selected,
)
from tmg_auth import (  # noqa: E402
    clear_credentials,
    has_saved_credentials,
    load_credentials,
    save_credentials,
)

VERSION = "2.0.8"
APP_TITLE = "AI_Program_Main_Board"


class BoardApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_TITLE}  v{VERSION}")
        self.geometry("920x620")
        self.minsize(780, 520)
        self.configure(bg="#1a4d5c")

        self._p1_result = None
        self._build()
        self._show("p1")
        self._refresh_p2_list()

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
            text="P1 카테고리 URL 추출  ·  P2 더망고 대량수집",
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

        self.btn_p1 = tk.Button(
            side,
            text="P1\n카테고리 URL 추출",
            command=lambda: self._show("p1"),
            font=("Malgun Gothic", 9, "bold"),
            relief="groove",
            pady=10,
        )
        self.btn_p1.pack(fill="x", padx=6, pady=6)

        self.btn_p2 = tk.Button(
            side,
            text="P2\n더망고 대량수집",
            command=lambda: self._show("p2"),
            font=("Malgun Gothic", 9, "bold"),
            relief="groove",
            pady=10,
        )
        self.btn_p2.pack(fill="x", padx=6, pady=6)

        self.main = tk.Frame(body, bg="#f1f5f9")
        self.main.pack(side="left", fill="both", expand=True)

        self.frame_p1 = tk.Frame(self.main, bg="#f1f5f9", padx=12, pady=10)
        self.frame_p2 = tk.Frame(self.main, bg="#f1f5f9", padx=12, pady=10)
        self._build_p1(self.frame_p1)
        self._build_p2(self.frame_p2)

    def _show(self, which: str) -> None:
        self.frame_p1.pack_forget()
        self.frame_p2.pack_forget()
        if which == "p1":
            self.frame_p1.pack(fill="both", expand=True)
            self.btn_p1.configure(bg="#dbeafe")
            self.btn_p2.configure(bg="#ececec")
        else:
            self.frame_p2.pack(fill="both", expand=True)
            self.btn_p2.configure(bg="#dbeafe")
            self.btn_p1.configure(bg="#ececec")

    # ── P1 ─────────────────────────────────────────────
    def _build_p1(self, parent: tk.Frame) -> None:
        tk.Label(
            parent,
            text="P1 — 사이트·상위 카테고리 → 엑셀 (P2 입력용)",
            bg="#f1f5f9",
            font=("Malgun Gothic", 10, "bold"),
            anchor="w",
        ).pack(fill="x", pady=(0, 8))

        form = tk.Frame(parent, bg="#ffffff", padx=10, pady=10, relief="solid", bd=1)
        form.pack(fill="x")

        self.var_site = tk.StringVar(value="ABC마트")
        self.var_url = tk.StringVar(value="https://abcmart.a-rt.com/?track=W0009")
        self.var_tops = tk.StringVar(value="MEN, WOMEN, KIDS")
        self.var_outdir = tk.StringVar(value=str(Path.home() / "Downloads"))

        self._row(form, "사이트명", self.var_site)
        self._row(form, "사이트 URL", self.var_url)
        self._row(form, "상위 카테고리 (쉼표)", self.var_tops)

        out_row = tk.Frame(form, bg="#ffffff")
        out_row.pack(fill="x", pady=3)
        tk.Label(out_row, text="저장 폴더", width=16, anchor="w", bg="#ffffff").pack(side="left")
        tk.Entry(out_row, textvariable=self.var_outdir).pack(side="left", fill="x", expand=True)
        tk.Button(out_row, text="…", width=3, command=self._pick_outdir).pack(side="left", padx=4)

        actions = tk.Frame(parent, bg="#f1f5f9")
        actions.pack(fill="x", pady=10)
        self.btn_crawl = tk.Button(
            actions,
            text="1. 수집 시작",
            command=self._run_p1,
            bg="#2563eb",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            padx=12,
            pady=6,
        )
        self.btn_crawl.pack(side="left")
        self.btn_save = tk.Button(
            actions,
            text="2. 엑셀 저장",
            command=self._save_p1,
            state="disabled",
            padx=12,
            pady=6,
        )
        self.btn_save.pack(side="left", padx=8)
        tk.Button(actions, text="ABC 기본값", command=self._p1_defaults).pack(side="left")

        self.p1_status = tk.Label(parent, text="", bg="#f1f5f9", anchor="w", justify="left")
        self.p1_status.pack(fill="x", pady=4)

        self.p1_preview = tk.Text(parent, height=14, font=("Consolas", 9), wrap="none")
        self.p1_preview.pack(fill="both", expand=True)

    def _row(self, parent: tk.Frame, label: str, var: tk.StringVar) -> None:
        row = tk.Frame(parent, bg="#ffffff")
        row.pack(fill="x", pady=3)
        tk.Label(row, text=label, width=16, anchor="w", bg="#ffffff").pack(side="left")
        tk.Entry(row, textvariable=var).pack(side="left", fill="x", expand=True)

    def _pick_outdir(self) -> None:
        d = filedialog.askdirectory(initialdir=self.var_outdir.get() or str(Path.home()))
        if d:
            self.var_outdir.set(d)

    def _p1_defaults(self) -> None:
        self.var_site.set("ABC마트")
        self.var_url.set("https://abcmart.a-rt.com/?track=W0009")
        self.var_tops.set("MEN, WOMEN, KIDS")

    def _run_p1(self) -> None:
        self.btn_crawl.configure(state="disabled")
        self.btn_save.configure(state="disabled")
        self.p1_status.configure(text="수집 중…")
        self.p1_preview.delete("1.0", "end")
        tops = [t.strip() for t in self.var_tops.get().split(",") if t.strip()]

        def work() -> None:
            result = crawl_site(self.var_site.get(), self.var_url.get(), tops)
            self.after(0, lambda: self._p1_done(result))

        threading.Thread(target=work, daemon=True).start()

    def _p1_done(self, result) -> None:
        self.btn_crawl.configure(state="normal")
        self._p1_result = result
        if not result.ok:
            self.p1_status.configure(text="실패: " + "; ".join(result.errors), fg="#b91c1c")
            return
        self.btn_save.configure(state="normal")
        msg = f"완료 · {result.platform} · {result.total}건"
        if result.warnings:
            msg += " · " + " / ".join(result.warnings)
        self.p1_status.configure(text=msg, fg="#15803d")
        lines = ["상위 | 중위 | 하위 | 최종 | 상위최종 | URL", "-" * 80]
        for r in result.rows[:80]:
            lines.append(
                f"{r.top} | {r.mid or '—'} | {r.low or '—'} | {r.final} | {r.top_final_label} | {r.final_category_url}"
            )
        if result.total > 80:
            lines.append(f"… 외 {result.total - 80}행 (엑셀에 전체 포함)")
        self.p1_preview.insert("1.0", "\n".join(lines))

    def _save_p1(self) -> None:
        if not self._p1_result or not self._p1_result.ok:
            return
        try:
            path = save_excel(self._p1_result.rows, self._p1_result.site_name, self.var_outdir.get())
        except Exception as e:
            messagebox.showerror("저장 실패", str(e))
            return
        self.p1_status.configure(text=f"저장됨: {path}", fg="#15803d")
        # P2 목록에 바로 추가
        add_paths([str(path)])
        self._refresh_p2_list()
        if messagebox.askyesno("P2로 이동", f"엑셀 저장·P2 목록에 추가했습니다.\n\n{path}\n\nP2 화면으로 갈까요?"):
            self._show("p2")

    # ── P2 ─────────────────────────────────────────────
    def _build_p2(self, parent: tk.Frame) -> None:
        tk.Label(
            parent,
            text="P2 — P1 엑셀을 로컬에서 찾아 목록에 넣고, 목록에서만 선택·실행",
            bg="#f1f5f9",
            font=("Malgun Gothic", 10, "bold"),
            anchor="w",
        ).pack(fill="x", pady=(0, 8))

        # 검색
        search = tk.LabelFrame(parent, text="1. 로컬에서 엑셀 찾아 추가", bg="#ffffff", padx=8, pady=8)
        search.pack(fill="x")

        self.var_dir = tk.StringVar(value=(default_roots() or [str(Path.home())])[0])
        self.var_q = tk.StringVar(value="카테고리URL")

        r1 = tk.Frame(search, bg="#ffffff")
        r1.pack(fill="x", pady=2)
        tk.Label(r1, text="폴더", width=8, anchor="w", bg="#ffffff").pack(side="left")
        tk.Entry(r1, textvariable=self.var_dir).pack(side="left", fill="x", expand=True)
        tk.Button(r1, text="…", width=3, command=self._pick_search_dir).pack(side="left", padx=4)

        r2 = tk.Frame(search, bg="#ffffff")
        r2.pack(fill="x", pady=2)
        tk.Label(r2, text="필터", width=8, anchor="w", bg="#ffffff").pack(side="left")
        tk.Entry(r2, textvariable=self.var_q, width=20).pack(side="left")
        tk.Button(r2, text="검색", command=self._search_xlsx, bg="#e2e8f0").pack(side="left", padx=6)
        tk.Button(r2, text="선택 → 목록 추가", command=self._add_found).pack(side="left")

        self.found_list = tk.Listbox(search, height=5, selectmode="extended", font=("Consolas", 9))
        self.found_list.pack(fill="x", pady=6)
        self._found_paths: list[str] = []

        # 리스트박스
        lib = tk.LabelFrame(parent, text="2. 보관 목록 (재실행 시 여기서만 선택)", bg="#ffffff", padx=8, pady=8)
        lib.pack(fill="both", expand=True, pady=(10, 0))

        self.lib_list = tk.Listbox(lib, height=10, font=("Malgun Gothic", 10), exportselection=False)
        self.lib_list.pack(fill="both", expand=True)
        self.lib_list.bind("<<ListboxSelect>>", self._on_lib_select)
        self._lib_paths: list[str] = []

        self.p2_sel = tk.Label(lib, text="", bg="#ffffff", fg="#64748b", anchor="w")
        self.p2_sel.pack(fill="x", pady=4)

        actions = tk.Frame(lib, bg="#ffffff")
        actions.pack(fill="x")
        self.var_verify = tk.BooleanVar(value=True)
        tk.Checkbutton(
            actions,
            text="1행 검증 모드 (추천: 스크린샷·재시도·3건확인)",
            variable=self.var_verify,
            bg="#ffffff",
            font=("Malgun Gothic", 9),
        ).pack(anchor="w", pady=(0, 6))

        login_row = tk.Frame(actions, bg="#ffffff")
        login_row.pack(fill="x", pady=(0, 8))
        tk.Button(
            login_row,
            text="더망고 로그인 저장",
            command=self._save_tmg_login,
            bg="#0f766e",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            padx=10,
            pady=4,
        ).pack(side="left")
        tk.Button(
            login_row,
            text="저장 삭제",
            command=self._clear_tmg_login,
            font=("Malgun Gothic", 9),
            padx=8,
            pady=4,
        ).pack(side="left", padx=6)
        self.p2_login_status = tk.Label(
            login_row,
            text="",
            bg="#ffffff",
            fg="#64748b",
            anchor="w",
            font=("Malgun Gothic", 9),
        )
        self.p2_login_status.pack(side="left", fill="x", expand=True)
        self._refresh_login_status()

        btn_row = tk.Frame(actions, bg="#ffffff")
        btn_row.pack(fill="x")
        tk.Button(
            btn_row,
            text="선택 파일로 수집 시작",
            command=self._run_p2,
            bg="#2563eb",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            padx=12,
            pady=6,
        ).pack(side="left")
        tk.Button(btn_row, text="목록에서 제거", command=self._remove_lib).pack(side="left", padx=8)
        tk.Button(btn_row, text="새로고침", command=self._refresh_p2_list).pack(side="left")

        self.p2_status = tk.Label(parent, text="", bg="#f1f5f9", anchor="w")
        self.p2_status.pack(fill="x", pady=6)

    def _pick_search_dir(self) -> None:
        d = filedialog.askdirectory(initialdir=self.var_dir.get() or str(Path.home()))
        if d:
            self.var_dir.set(d)

    def _search_xlsx(self) -> None:
        self.found_list.delete(0, "end")
        self._found_paths = []
        try:
            files = search_xlsx(self.var_dir.get().strip(), self.var_q.get().strip())
        except Exception as e:
            messagebox.showerror("검색 실패", str(e))
            return
        for f in files:
            self._found_paths.append(f["path"])
            self.found_list.insert("end", f["name"])
        self.p2_status.configure(
            text=f"검색 {len(files)}개" if files else "해당 폴더에서 .xlsx 없음",
            fg="#0f172a",
        )

    def _add_found(self) -> None:
        sel = list(self.found_list.curselection())
        if not sel:
            messagebox.showinfo("안내", "검색 결과에서 파일을 선택하세요.")
            return
        paths = [self._found_paths[i] for i in sel]
        add_paths(paths)
        self._refresh_p2_list()
        self.p2_status.configure(text=f"목록에 {len(paths)}개 추가", fg="#15803d")

    def _refresh_p2_list(self) -> None:
        self.lib_list.delete(0, "end")
        self._lib_paths = []
        items = entries_annotated()
        data = load()
        last = data.get("last_selected") or ""
        select_idx = 0
        for i, it in enumerate(items):
            mark = "" if it["exists"] else "[없음] "
            self.lib_list.insert("end", f"{mark}{it['name']}")
            self._lib_paths.append(it["path"])
            if it["path"] == last:
                select_idx = i
        if self._lib_paths:
            self.lib_list.selection_clear(0, "end")
            self.lib_list.selection_set(select_idx)
            self.lib_list.see(select_idx)
            self.p2_sel.configure(text=self._lib_paths[select_idx])
        else:
            self.p2_sel.configure(text="(비어 있음 — 위에서 검색 후 추가)")

    def _on_lib_select(self, _evt=None) -> None:
        sel = self.lib_list.curselection()
        if not sel:
            return
        path = self._lib_paths[sel[0]]
        self.p2_sel.configure(text=path)
        set_selected(path)

    def _remove_lib(self) -> None:
        sel = self.lib_list.curselection()
        if not sel:
            return
        remove_path(self._lib_paths[sel[0]])
        self._refresh_p2_list()

    def _refresh_login_status(self) -> None:
        if not hasattr(self, "p2_login_status"):
            return
        if has_saved_credentials():
            uid, _ = load_credentials()
            self.p2_login_status.configure(
                text=f"저장됨: {uid}  (수집 시 더망고 로그인창에 자동 입력)",
                fg="#0f766e",
            )
        else:
            self.p2_login_status.configure(
                text="미저장 — [더망고 로그인 저장]을 먼저 하세요",
                fg="#b45309",
            )

    def _save_tmg_login(self) -> None:
        """ID/PW를 로컬에 1회 저장. 이후 수집 시 재입력 없이 전달."""
        cur_id, _ = load_credentials()
        tmg_id = simpledialog.askstring(
            "더망고 로그인 저장",
            "아이디 (1회 저장 후 재사용):",
            initialvalue=cur_id or "",
            parent=self,
        )
        if not tmg_id:
            return
        tmg_pw = simpledialog.askstring(
            "더망고 로그인 저장",
            "비밀번호 (1회 저장 후 재사용):",
            show="*",
            parent=self,
        )
        if not tmg_pw:
            return
        try:
            path = save_credentials(tmg_id, tmg_pw)
        except Exception as e:
            messagebox.showerror("저장 실패", str(e))
            return
        self._refresh_login_status()
        messagebox.showinfo(
            "저장 완료",
            f"로그인 정보를 저장했습니다.\n{path}\n\n"
            "수집 시작 시 더망고 실제 로그인창이 열리고\n"
            "저장된 ID/PW가 자동으로 입력됩니다.",
        )

    def _clear_tmg_login(self) -> None:
        if not has_saved_credentials():
            messagebox.showinfo("안내", "저장된 로그인 정보가 없습니다.")
            return
        if not messagebox.askyesno("확인", "저장된 더망고 ID/PW를 삭제할까요?"):
            return
        clear_credentials()
        self._refresh_login_status()
        self.p2_status.configure(text="로그인 저장 삭제됨", fg="#64748b")

    def _run_p2(self) -> None:
        sel = self.lib_list.curselection()
        if not sel:
            messagebox.showinfo("안내", "보관 목록에서 엑셀을 선택하세요.")
            return
        path = self._lib_paths[sel[0]]
        if not is_in_library(path):
            messagebox.showerror("오류", "목록에 없는 파일입니다.")
            return
        if not os.path.isfile(path):
            messagebox.showerror("오류", f"파일 없음:\n{path}")
            return

        # ID/PW는 저장값만 사용 (매 실행 재입력 없음)
        if not has_saved_credentials():
            messagebox.showwarning(
                "로그인 필요",
                "저장된 더망고 ID/PW가 없습니다.\n"
                "먼저 [더망고 로그인 저장]을 실행하세요.",
            )
            return
        tmg_id, tmg_pw = load_credentials()

        run_bat = ROOT / "P2" / "run.bat"
        collect_py = ROOT / "P2" / "collect.py"
        verify = bool(self.var_verify.get())
        try:
            # Avoid nested quotes like: call "path" inside cmd /k "..."
            # which becomes '"path"' and Windows reports "not recognized".
            flags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0x00000010) if os.name == "nt" else 0
            env = os.environ.copy()
            env["TMG_ID"] = tmg_id
            env["TMG_PW"] = tmg_pw
            if os.name == "nt" and run_bat.is_file():
                args = [
                    "cmd.exe",
                    "/k",
                    str(run_bat),
                    path,
                    "--id",
                    tmg_id,
                    "--pw",
                    tmg_pw,
                ]
                if verify:
                    args.append("--verify")
                subprocess.Popen(args, cwd=str(ROOT / "P2"), creationflags=flags, env=env)
            else:
                args = [
                    sys.executable,
                    str(collect_py),
                    path,
                    "3",
                    "--retries",
                    "3",
                    "--yes",
                    "--id",
                    tmg_id,
                    "--pw",
                    tmg_pw,
                ]
                if verify:
                    args.append("--verify")
                subprocess.Popen(args, cwd=str(ROOT / "P2"), creationflags=flags, env=env)
            set_selected(path)
            mode = "1행 검증" if verify else "전체(--yes)"
            self.p2_status.configure(
                text=f"수집 시작 ({mode}) · 로그인창+저장계정 전달: {path}",
                fg="#15803d",
            )
        except Exception as e:
            messagebox.showerror("실행 실패", str(e))


def main() -> None:
    app = BoardApp()
    app.mainloop()


if __name__ == "__main__":
    main()
