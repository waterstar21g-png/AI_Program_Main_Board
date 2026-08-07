"""
AI_Program_Main_Board — Python B안 보드 (P1 / P2=구P3)
아주 단순한 UI, 필요한 기능만.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "P1"))
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
from shot_viewer import latest_shot_dir, open_shot_viewer  # noqa: E402

VERSION = "2.0.18"
APP_TITLE = "AI_Program_Main_Board"


class BoardApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_TITLE}  v{VERSION}")
        self.geometry("960x720")
        self.minsize(820, 600)
        self.configure(bg="#1a4d5c")

        self._p1_result = None
        self._p2_proc: subprocess.Popen | None = None
        self._last_shot_dir: Path | None = None
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
        ).pack(fill="x", pady=(0, 6))

        # 1. 검색
        search = tk.LabelFrame(parent, text="1. 로컬에서 엑셀 찾아 추가", bg="#ffffff", padx=8, pady=6)
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

        # 1번 검색결과 그리드 · 2번 보관목록 동일 높이
        self._p2_list_height = 4

        found_wrap = tk.Frame(search, bg="#ffffff")
        found_wrap.pack(fill="x", pady=4)
        self.found_list = tk.Listbox(
            found_wrap,
            height=self._p2_list_height,
            selectmode="extended",
            font=("Consolas", 9),
        )
        found_sb = tk.Scrollbar(found_wrap, orient="vertical", command=self.found_list.yview)
        self.found_list.configure(yscrollcommand=found_sb.set)
        self.found_list.pack(side="left", fill="x", expand=True)
        found_sb.pack(side="right", fill="y")
        self._found_paths: list[str] = []

        # 실행 버튼 — 2.보관목록 위에 가로 배치
        actions = tk.LabelFrame(parent, text="실행", bg="#ffffff", padx=8, pady=6)
        actions.pack(fill="x", pady=(8, 0))

        self.var_verify = tk.BooleanVar(value=True)
        btn_row = tk.Frame(actions, bg="#ffffff")
        btn_row.pack(fill="x")
        tk.Checkbutton(
            btn_row,
            text="1·2행 전과정 스크린샷",
            variable=self.var_verify,
            bg="#ffffff",
            font=("Malgun Gothic", 9),
        ).pack(side="left", padx=(0, 8))
        tk.Button(
            btn_row,
            text="선택 파일로 수집 시작",
            command=self._run_p2,
            bg="#2563eb",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            padx=10,
            pady=4,
        ).pack(side="left")
        tk.Button(btn_row, text="목록에서 제거", command=self._remove_lib).pack(
            side="left", padx=6
        )
        tk.Button(btn_row, text="새로고침", command=self._refresh_p2_list).pack(side="left")
        tk.Button(btn_row, text="로그 지우기", command=self._clear_p2_log).pack(
            side="left", padx=6
        )
        tk.Button(
            btn_row,
            text="스크린샷 보기",
            command=self._show_shot_viewer,
            bg="#0f766e",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            padx=8,
            pady=4,
        ).pack(side="left", padx=6)
        tk.Label(
            actions,
            text="실행로그: 전행 카테고리명·URL 기록 · 1·2행은 단계별 스크린샷 · [스크린샷 보기]",
            bg="#ffffff",
            fg="#0f766e",
            anchor="w",
            font=("Malgun Gothic", 8),
        ).pack(fill="x", pady=(4, 0))

        # 2. 보관 목록 — 1번 데이터 그리드와 동일 높이 + 스크롤
        lib = tk.LabelFrame(
            parent, text="2. 보관 목록 (재실행 시 여기서만 선택)", bg="#ffffff", padx=8, pady=4
        )
        lib.pack(fill="x", pady=(8, 0))

        lib_wrap = tk.Frame(lib, bg="#ffffff")
        lib_wrap.pack(fill="x")
        self.lib_list = tk.Listbox(
            lib_wrap,
            height=self._p2_list_height,
            font=("Malgun Gothic", 10),
            exportselection=False,
        )
        lib_sb = tk.Scrollbar(lib_wrap, orient="vertical", command=self.lib_list.yview)
        self.lib_list.configure(yscrollcommand=lib_sb.set)
        self.lib_list.pack(side="left", fill="x", expand=True)
        lib_sb.pack(side="right", fill="y")
        self.lib_list.bind("<<ListboxSelect>>", self._on_lib_select)
        self.lib_list.bind("<MouseWheel>", self._on_lib_mousewheel)
        self.lib_list.bind("<Button-4>", self._on_lib_mousewheel)
        self.lib_list.bind("<Button-5>", self._on_lib_mousewheel)
        self._lib_paths: list[str] = []

        self.p2_sel = tk.Label(lib, text="", bg="#ffffff", fg="#64748b", anchor="w")
        self.p2_sel.pack(fill="x", pady=(2, 0))

        # 3. 실행 로그 그리드 (하단 · 진행 상황)
        log_frame = tk.LabelFrame(parent, text="3. 실행 로그", bg="#ffffff", padx=6, pady=4)
        log_frame.pack(fill="both", expand=True, pady=(8, 0))

        cols = ("time", "stage", "message")
        self.p2_log = ttk.Treeview(
            log_frame,
            columns=cols,
            show="headings",
            height=12,
        )
        self.p2_log.heading("time", text="시각")
        self.p2_log.heading("stage", text="단계")
        self.p2_log.heading("message", text="내용")
        self.p2_log.column("time", width=70, minwidth=60, stretch=False, anchor="center")
        self.p2_log.column("stage", width=90, minwidth=70, stretch=False, anchor="center")
        self.p2_log.column("message", width=560, minwidth=200, stretch=True, anchor="w")
        log_sb = tk.Scrollbar(log_frame, orient="vertical", command=self.p2_log.yview)
        self.p2_log.configure(yscrollcommand=log_sb.set)
        self.p2_log.pack(side="left", fill="both", expand=True)
        log_sb.pack(side="right", fill="y")

        self.p2_status = tk.Label(parent, text="", bg="#f1f5f9", anchor="w")
        self.p2_status.pack(fill="x", pady=4)

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

    def _on_lib_mousewheel(self, event) -> str:
        """보관 목록 스크롤 (Windows/macOS/Linux)."""
        if getattr(event, "num", None) == 4 or getattr(event, "delta", 0) > 0:
            self.lib_list.yview_scroll(-1, "units")
        elif getattr(event, "num", None) == 5 or getattr(event, "delta", 0) < 0:
            self.lib_list.yview_scroll(1, "units")
        return "break"

    def _clear_p2_log(self) -> None:
        if hasattr(self, "p2_log"):
            for item in self.p2_log.get_children():
                self.p2_log.delete(item)

    def _p2_log_line(self, message: str, stage: str = "") -> None:
        """메인 스레드에서 실행로그 그리드에 한 줄 추가."""
        if not hasattr(self, "p2_log"):
            return
        text = (message or "").rstrip()
        if not text:
            return
        t = time.strftime("%H:%M:%S")
        m = re.match(r"^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$", text)
        if m:
            t = m.group(1)
            text = m.group(2)
        self._capture_shot_dir_from_log(text)
        if not stage:
            stage = self._guess_log_stage(text)
        self.p2_log.insert("", "end", values=(t, stage, text))
        children = self.p2_log.get_children()
        if children:
            self.p2_log.see(children[-1])

    def _capture_shot_dir_from_log(self, text: str) -> None:
        """로그에서 샷 폴더 경로를 잡아 둔다."""
        for key in ("[샷폴더]", "[갤러리]", "스크린샷·로그:", "로그="):
            if key not in text:
                continue
            part = text.split(key, 1)[-1].strip()
            # "[갤러리] C:\...\index.html (12장)" → 폴더
            part = part.split(" (", 1)[0].strip()
            if part.lower().endswith("index.html"):
                part = str(Path(part).parent)
            # "verify=True · 로그=C:\...\run-logs\..." 형태
            if "로그=" in text and key == "로그=":
                part = text.split("로그=", 1)[-1].strip()
            p = Path(part)
            if p.is_dir():
                self._last_shot_dir = p
            elif p.parent.is_dir() and p.parent.name:
                self._last_shot_dir = p.parent

    @staticmethod
    def _guess_log_stage(text: str) -> str:
        low = text.lower()
        if "[샷]" in text or "샷폴더" in text or "갤러리" in text:
            return "샷"
        if "망고 자체" in text or "검색결과가 없습니다" in text or "무결과" in text:
            return "무결과"
        if "입력목록" in text or "상위 최종 카테고리명" in text or "최종 카테고리 URL" in text:
            return "입력"
        if "로그인" in text:
            return "로그인"
        if "초기화" in text or "대량" in text:
            return "초기화"
        if "검색" in text or "url" in low:
            return "검색"
        if "저장" in text:
            return "저장"
        if "실패" in text or "error" in low or "오류" in text:
            return "오류"
        if "성공" in text or "완료" in text or "done" in low:
            return "완료"
        if "대기" in text:
            return "대기"
        if "행" in text or "row" in low:
            return "행처리"
        return "진행"

    def _show_shot_viewer(self) -> None:
        folder = self._last_shot_dir
        if folder is None or not folder.is_dir():
            folder = latest_shot_dir(ROOT)
        open_shot_viewer(self, shot_dir=folder, root=ROOT)

    def _p2_log_ui(self, message: str, stage: str = "") -> None:
        self.after(0, lambda: self._p2_log_line(message, stage))

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
        if self._p2_proc and self._p2_proc.poll() is None:
            messagebox.showwarning("실행 중", "이미 수집이 진행 중입니다.")
            return

        collect_py = ROOT / "P2" / "collect.py"
        verify = bool(self.var_verify.get())
        args = [
            sys.executable,
            str(collect_py),
            path,
            "3",
            "--retries",
            "3",
            "--yes",
            "--shot-first",
            "2",
        ]
        if verify:
            # 검증: 입력 1·2행 처리 + 단계 스크린샷 (전행 카테고리명·URL은 로그에 기록)
            args.extend(["--verify", "--max-rows", "2"])

        set_selected(path)
        mode = "1·2행 전과정 스크린샷" if verify else "전체(앞2행 샷)"
        self._p2_log_line(f"수집 시작 ({mode}): {path}", "시작")
        self._p2_log_line(
            "실행로그에 모든 입력의 상위 최종 카테고리명 / 최종 카테고리 URL주소 기록",
            "입력",
        )
        self.p2_status.configure(
            text=f"수집 실행 중 ({mode}) — 브라우저에서 직접 로그인하세요",
            fg="#15803d",
        )

        try:
            # 보드 하단 로그로 stdout 수신 (별도 콘솔 창 없음)
            # Windows 기본 콘솔 코드페이지(CP949)와 UTF-8 혼용 대비:
            # 자식 Python은 UTF-8 강제 + 수신 시 utf-8/cp949 폴백 디코딩
            creationflags = 0
            if os.name == "nt":
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            env["PYTHONUTF8"] = "1"
            self._p2_proc = subprocess.Popen(
                args,
                cwd=str(ROOT / "P2"),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=False,
                bufsize=0,
                env=env,
                creationflags=creationflags,
            )
        except Exception as e:
            messagebox.showerror("실행 실패", str(e))
            self._p2_log_line(str(e), "오류")
            return

        threading.Thread(
            target=self._watch_p2_proc,
            args=(self._p2_proc, path),
            daemon=True,
        ).start()

    @staticmethod
    def _decode_log_bytes(raw: bytes) -> str:
        """Windows CP949 / UTF-8 혼용 stdout을 깨지지 않게 디코딩."""
        if not raw:
            return ""
        data = raw.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        for enc in ("utf-8", "cp949", "mbcs"):
            try:
                return data.decode(enc)
            except UnicodeDecodeError:
                continue
        return data.decode("utf-8", errors="replace")

    def _watch_p2_proc(self, proc: subprocess.Popen, path: str) -> None:
        try:
            assert proc.stdout is not None
            buf = b""
            while True:
                chunk = proc.stdout.read(256)
                if not chunk:
                    break
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    text = self._decode_log_bytes(line).rstrip()
                    if text:
                        self._p2_log_ui(text)
            if buf.strip():
                text = self._decode_log_bytes(buf).rstrip()
                if text:
                    self._p2_log_ui(text)
        except Exception as e:  # noqa: BLE001
            self._p2_log_ui(f"로그 수신 오류: {e}", "오류")
        code = proc.wait()
        if code == 0:
            self._p2_log_ui(f"수집 종료 OK (exit={code}): {path}", "완료")
            self.after(0, lambda: self._on_p2_finished(True, path))
        else:
            self._p2_log_ui(f"수집 종료 FAIL (exit={code}): {path}", "오류")
            self.after(0, lambda: self._on_p2_finished(False, path, code))

    def _on_p2_finished(self, ok: bool, path: str, code: int = 0) -> None:
        if ok:
            self.p2_status.configure(text=f"수집 완료: {path}", fg="#15803d")
            folder = self._last_shot_dir or latest_shot_dir(ROOT)
            if folder and folder.is_dir() and any(folder.glob("*.png")):
                self._p2_log_line(f"스크린샷 폴더: {folder}", "샷")
                # 1행 전과정 샷이 있으면 바로 보여 줌
                if bool(self.var_verify.get()):
                    open_shot_viewer(self, shot_dir=folder, root=ROOT)
        else:
            self.p2_status.configure(text=f"수집 실패 (exit={code})", fg="#b91c1c")
            folder = self._last_shot_dir or latest_shot_dir(ROOT)
            if folder and folder.is_dir() and any(folder.glob("*.png")):
                if messagebox.askyesno(
                    "스크린샷",
                    f"실패했지만 단계 스크린샷이 있습니다.\n{folder}\n\n지금 볼까요?",
                    parent=self,
                ):
                    open_shot_viewer(self, shot_dir=folder, root=ROOT)


def main() -> None:
    app = BoardApp()
    app.mainloop()


if __name__ == "__main__":
    main()
