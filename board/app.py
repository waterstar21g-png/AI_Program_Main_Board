"""
AI_Program_Main_Board — Python B안 보드 (P1 / P2=구P3)
아주 단순한 UI, 필요한 기능만.
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
import tkinter as tk
import webbrowser
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
from log_protocol import (  # noqa: E402
    META_FIELDS,
    format_meta_line,
    parse_line,
    step_tag,
    strip_timestamp,
    sub_time_range,
)
from shot_viewer import latest_shot_dir, open_shot_viewer  # noqa: E402

VERSION = "2.0.55"
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
        tk.Button(
            btn_row,
            text="수집 종료",
            command=self._stop_p2,
            bg="#b91c1c",
            fg="white",
            font=("Malgun Gothic", 9, "bold"),
            padx=10,
            pady=4,
        ).pack(side="left", padx=6)
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
            text="실행로그: main(1~13단계) · sub(단계별 추가정보/스크린샷) — main 행 클릭시 sub 갱신",
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

        # 3. 실행 로그 — main(13단계) / sub(단계별 추가정보·스크린샷) 두 그리드
        log_area = tk.Frame(parent, bg="#f1f5f9")
        log_area.pack(fill="both", expand=True, pady=(8, 0))

        style = ttk.Style(self)
        try:
            style.configure("P2Log.Treeview", rowheight=22, font=("Malgun Gothic", 9))
            style.configure("P2Log.Treeview.Heading", font=("Malgun Gothic", 9, "bold"))
        except tk.TclError:
            pass

        main_frame = tk.LabelFrame(
            log_area,
            text="3-A. 실행 로그 main (상단=엑셀정보 5항목 · 아래=1~13단계)",
            bg="#ffffff",
            padx=6,
            pady=4,
        )
        main_frame.pack(fill="both", expand=True)

        self.p2_main_log = ttk.Treeview(
            main_frame,
            columns=("time", "step", "message"),
            show="headings",
            height=9,
            style="P2Log.Treeview",
        )
        self.p2_main_log.heading("time", text="시각")
        self.p2_main_log.heading("step", text="단계")
        self.p2_main_log.heading("message", text="내용 (1~13단계)")
        self.p2_main_log.column("time", width=130, minwidth=110, stretch=False, anchor="center")
        self.p2_main_log.column("step", width=44, minwidth=40, stretch=False, anchor="center")
        self.p2_main_log.column("message", width=620, minwidth=220, stretch=True, anchor="w")
        main_sb = tk.Scrollbar(main_frame, orient="vertical", command=self.p2_main_log.yview)
        self.p2_main_log.configure(yscrollcommand=main_sb.set)
        self.p2_main_log.pack(side="left", fill="both", expand=True)
        main_sb.pack(side="right", fill="y")
        self.p2_main_log.bind("<<TreeviewSelect>>", self._on_main_log_select)
        self._setup_p2_log_tags()

        sub_frame = tk.LabelFrame(
            log_area,
            text="3-B. 실행 로그 sub (선택한 단계의 추가정보·스크린샷)",
            bg="#ffffff",
            padx=6,
            pady=4,
        )
        sub_frame.pack(fill="both", expand=True, pady=(6, 0))

        self.p2_sub_log = ttk.Treeview(
            sub_frame,
            columns=("time", "message"),
            show="headings",
            height=7,
            style="P2Log.Treeview",
        )
        self.p2_sub_log.heading("time", text="시각")
        self.p2_sub_log.heading("message", text="추가정보 · [샷]은 더블클릭으로 열기")
        self.p2_sub_log.column("time", width=130, minwidth=110, stretch=False, anchor="center")
        self.p2_sub_log.column("message", width=700, minwidth=220, stretch=True, anchor="w")
        sub_sb = tk.Scrollbar(sub_frame, orient="vertical", command=self.p2_sub_log.yview)
        self.p2_sub_log.configure(yscrollcommand=sub_sb.set)
        self.p2_sub_log.pack(side="left", fill="both", expand=True)
        sub_sb.pack(side="right", fill="y")
        self.p2_sub_log.tag_configure("shot", foreground="#0f766e")
        self.p2_sub_log.bind("<Double-Button-1>", self._on_sub_log_double_click)

        # seq(단계 발생 고유번호) 기반 main↔sub 연결 데이터
        self._sub_by_seq: dict[int, list[tuple[str, str, str]]] = {}
        self._shot_path_by_seq: dict[tuple[int, int], str] = {}
        self._main_item_by_seq: dict[int, str] = {}
        self._main_ts_end: dict[int, str] = {}
        self._seq_by_main_item: dict[str, int] = {}
        self._meta_item_id: str | None = None
        self._meta_values: dict[str, str] = {f: "" for f in META_FIELDS}
        self._selected_seq: int | None = None
        self._latest_seq: int = 0
        self._follow_latest: bool = True

        self._setup_meta_rows()

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
        for tv in (getattr(self, "p2_main_log", None), getattr(self, "p2_sub_log", None)):
            if tv is not None:
                for item in tv.get_children():
                    tv.delete(item)
        self._sub_by_seq = {}
        self._shot_path_by_seq = {}
        self._main_item_by_seq = {}
        self._main_ts_end = {}
        self._seq_by_main_item = {}
        self._meta_item_id = None
        self._meta_values = {f: "" for f in META_FIELDS}
        self._selected_seq = None
        self._latest_seq = 0
        self._follow_latest = True
        self._setup_meta_rows()

    def _setup_meta_rows(self) -> None:
        """main 상단 엑셀 진행 정보 — 5항목을 1줄(오렌지)로 표시."""
        tv = getattr(self, "p2_main_log", None)
        if tv is None:
            return
        self._meta_values = {f: "" for f in META_FIELDS}
        line = format_meta_line(self._meta_values)
        self._meta_item_id = tv.insert("", 0, values=("", "엑셀", line), tags=("meta",))

    def _update_meta_row(self, field: str, value: str) -> None:
        if field not in META_FIELDS:
            return
        self._meta_values[field] = str(value or "").strip()
        if not self._meta_item_id:
            return
        line = format_meta_line(self._meta_values)
        self.p2_main_log.item(self._meta_item_id, values=("", "엑셀", line))

    def _setup_p2_log_tags(self) -> None:
        """main 실행로그 — 단계 성격별 색상 태그."""
        tv = self.p2_main_log
        tv.tag_configure("meta", foreground="#ea580c", background="#fff7ed")
        tv.tag_configure("normal", foreground="#0f172a")
        tv.tag_configure("login", foreground="#7c3aed", background="#f5f3ff")
        tv.tag_configure("init", foreground="#0f766e", background="#f0fdfa")
        tv.tag_configure("save", foreground="#5b21b6", background="#f3e8ff")
        tv.tag_configure("done", foreground="#166534", background="#dcfce7")

    def _handle_collect_line(self, message: str) -> None:
        """collect.py stdout 한 줄 처리 — main/sub 프로토콜만 그리드에 반영.

        (요건: main엔 1~13단계만, 그 외 잡다한 로그는 화면에 출력하지 않음)
        """
        text = (message or "").rstrip()
        if not text:
            return
        t, text = strip_timestamp(text)
        parsed = parse_line(text)
        if parsed is None:
            return  # 마커 없는 줄은 화면에 출력하지 않음 — 요건 2

        kind = parsed[0]
        if kind == "meta":
            _, field, value = parsed
            self._update_meta_row(field, value)
        elif kind == "main":
            _, seq, n, msg = parsed
            self._insert_main_row(t, seq, n, msg)
        elif kind == "sub":
            _, seq, msg = parsed
            self._append_sub_entry(seq, t, "info", msg)
        elif kind == "subshot":
            _, seq, path, label = parsed
            self._capture_shot_dir_from_path(path)
            self._append_sub_entry(seq, t, "shot", f"[샷] {label} -> {Path(path).name}")
            self._shot_path_by_seq[(seq, len(self._sub_by_seq.get(seq, [])) - 1)] = path

    def _main_ts_for_seq(self, seq: int) -> str | None:
        """main 그리드에 기록된 시각 — sub와 동일하게 맞출 때 사용."""
        item = self._main_item_by_seq.get(seq)
        if not item:
            return None
        vals = self.p2_main_log.item(item, "values")
        return vals[0] if vals else None

    def _ts_for_sub(self, seq: int, t: str) -> str:
        """sub 시각 = 현단계 MAIN 진입 ~ 다음 MAIN 진입."""
        if "~" in (t or ""):
            return t
        start = self._main_ts_for_seq(seq)
        if not start:
            return t
        end = self._main_ts_end.get(seq, start)
        return sub_time_range(start, end)

    def _insert_main_row(self, t: str, seq: int, n: int, msg: str) -> None:
        if seq > 1:
            self._main_ts_end[seq - 1] = t
            if self._selected_seq == seq - 1:
                self._render_sub_grid(seq - 1)
        tag = step_tag(n)
        item = self.p2_main_log.insert("", "end", values=(t, n, msg), tags=(tag,))
        self._main_item_by_seq[seq] = item
        self._seq_by_main_item[item] = seq
        self._latest_seq = max(self._latest_seq, seq)
        self.p2_main_log.see(item)
        if self._follow_latest:
            self.p2_main_log.selection_set(item)
            self._selected_seq = seq
            self._render_sub_grid(seq)

    def _append_sub_entry(self, seq: int, t: str, kind: str, msg: str) -> None:
        display_t = self._ts_for_sub(seq, t)
        self._sub_by_seq.setdefault(seq, []).append((display_t, kind, msg))
        if self._selected_seq == seq:
            tag = ("shot",) if kind == "shot" else ()
            item = self.p2_sub_log.insert("", "end", values=(display_t, msg), tags=tag)
            self.p2_sub_log.see(item)

    def _render_sub_grid(self, seq: int) -> None:
        for item in self.p2_sub_log.get_children():
            self.p2_sub_log.delete(item)
        for t, kind, msg in self._sub_by_seq.get(seq, []):
            display_t = self._ts_for_sub(seq, t)
            tag = ("shot",) if kind == "shot" else ()
            self.p2_sub_log.insert("", "end", values=(display_t, msg), tags=tag)

    def _on_main_log_select(self, _evt=None) -> None:
        sel = self.p2_main_log.selection()
        if not sel:
            return
        seq = self._seq_by_main_item.get(sel[0])
        if seq is None:
            return
        if self._meta_item_id and sel[0] == self._meta_item_id:
            return
        self._selected_seq = seq
        self._follow_latest = seq == self._latest_seq
        self._render_sub_grid(seq)

    def _on_sub_log_double_click(self, _evt=None) -> None:
        sel = self.p2_sub_log.selection()
        if not sel or self._selected_seq is None:
            return
        idx = self.p2_sub_log.index(sel[0])
        path = self._shot_path_by_seq.get((self._selected_seq, idx))
        if not path:
            return
        p = Path(path)
        if not p.is_file():
            return
        try:
            if os.name == "nt":
                os.startfile(str(p))  # type: ignore[attr-defined]
            else:
                webbrowser.open(p.as_uri())
        except Exception:  # noqa: BLE001
            pass

    def _capture_shot_dir_from_path(self, path: str) -> None:
        try:
            p = Path(path)
            if p.parent.is_dir():
                self._last_shot_dir = p.parent
        except Exception:  # noqa: BLE001
            pass

    def _show_shot_viewer(self) -> None:
        folder = self._last_shot_dir
        if folder is None or not folder.is_dir():
            folder = latest_shot_dir(ROOT)
        open_shot_viewer(self, shot_dir=folder, root=ROOT)

    def _p2_log_ui(self, message: str) -> None:
        self.after(0, lambda: self._handle_collect_line(message))

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
        stop_flag = ROOT / "P2" / ".collect_stop"
        try:
            stop_flag.unlink(missing_ok=True)  # type: ignore[call-arg]
        except TypeError:
            if stop_flag.exists():
                try:
                    stop_flag.unlink()
                except OSError:
                    pass
        except OSError:
            pass

        verify = bool(self.var_verify.get())
        args = [
            sys.executable,
            str(collect_py),
            path,
            "3",
            "--retries",
            "2",
            "--yes",
            "--shot-first",
            "2",
        ]
        if verify:
            # 검증: 1·2행 단계 스크린샷만 (행 수 제한 없음 — 엑셀 전체 처리)
            args.append("--verify")

        set_selected(path)
        self._clear_p2_log()
        mode = "1·2행 스크린샷·전체수집" if verify else "전체(앞2행 샷)"
        self.p2_status.configure(
            text=f"수집 시작 ({mode}): {path} — 브라우저에서 직접 로그인하세요",
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
            self.p2_status.configure(text=f"실행 실패: {e}", fg="#b91c1c")
            return

        threading.Thread(
            target=self._watch_p2_proc,
            args=(self._p2_proc, path),
            daemon=True,
        ).start()

    def _stop_flag_path(self) -> Path:
        return ROOT / "P2" / ".collect_stop"

    def _stop_p2(self) -> None:
        """중도 수집 중단 — 화면 실행로그는 지우지 않고 보존."""
        proc = self._p2_proc
        if proc is None or proc.poll() is not None:
            messagebox.showinfo("안내", "실행 중인 수집이 없습니다.")
            return
        try:
            self._stop_flag_path().write_text("stop\n", encoding="utf-8")
        except OSError as e:
            self.p2_status.configure(text=f"중단 플래그 기록 실패: {e}", fg="#b91c1c")
        self.p2_status.configure(text="수집 종료 요청 중… (로그 보존)", fg="#b45309")
        threading.Thread(target=self._force_stop_p2, args=(proc,), daemon=True).start()

    def _force_stop_p2(self, proc: subprocess.Popen) -> None:
        """협조적 중단 후 응답 없으면 프로세스 종료."""
        for _ in range(24):  # ~12초
            if proc.poll() is not None:
                return
            time.sleep(0.5)
        if proc.poll() is not None:
            return
        self.after(
            0,
            lambda: self.p2_status.configure(
                text="협조 중단 지연 — 프로세스 강제 종료", fg="#b45309"
            ),
        )
        try:
            proc.terminate()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(1.5)
        if proc.poll() is None:
            try:
                proc.kill()
            except Exception:  # noqa: BLE001
                pass

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
            self.after(
                0,
                lambda: self.p2_status.configure(text=f"로그 수신 오류: {e}", fg="#b91c1c"),
            )
        code = proc.wait()
        if code == 0:
            self.after(0, lambda: self._on_p2_finished(True, path, code))
        elif code == 130:
            self.after(0, lambda: self._on_p2_finished(False, path, code, stopped=True))
        else:
            self.after(0, lambda: self._on_p2_finished(False, path, code))

    def _on_p2_finished(
        self,
        ok: bool,
        path: str,
        code: int = 0,
        *,
        stopped: bool = False,
    ) -> None:
        # 중단/완료 모두 실행로그는 그대로 둔다 (_clear_p2_log 호출 없음)
        if stopped:
            self.p2_status.configure(
                text="수집 종료(사용자 중단) — 실행로그 보존됨",
                fg="#b45309",
            )
            return
        if ok:
            self.p2_status.configure(text=f"수집 완료: {path}", fg="#15803d")
            folder = self._last_shot_dir or latest_shot_dir(ROOT)
            if folder and folder.is_dir() and any(folder.glob("*.png")):
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
