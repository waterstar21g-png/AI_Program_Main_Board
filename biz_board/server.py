"""비즈 보드 — 독립 실행 로컬 서버 (휴대폰 홈 화면용 PWA).

사용:
  python server.py
  → 같은 Wi-Fi의 휴대폰 브라우저에서 http://<PC-IP>:8787 접속
  → 브라우저 메뉴에서 '홈 화면에 추가'
"""

from __future__ import annotations

import json
import os
import socket
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
PORT = int(os.environ.get("BIZ_BOARD_PORT", "8787"))

# allow `python server.py` from any cwd
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from login_runner import find_site, load_sites, run_login, save_sites  # noqa: E402

VERSION = (ROOT / "VERSION.txt").read_text(encoding="utf-8").strip() if (ROOT / "VERSION.txt").is_file() else "1.0.0"


def _lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and ip not in ips:
            ips.insert(0, ip)
    except OSError:
        pass
    return ips


class Handler(BaseHTTPRequestHandler):
    server_version = f"BizBoard/{VERSION}"

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stdout.write("[biz_board] " + (fmt % args) + "\n")

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict | list) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path: Path, content_type: str) -> None:
        if not path.is_file():
            self.send_error(404, "Not Found")
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        # PWA: allow caching of static assets lightly
        if path.suffix in {".js", ".css", ".png", ".svg", ".webmanifest"}:
            self.send_header("Cache-Control", "public, max-age=300")
        else:
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            self._file(STATIC / "index.html", "text/html; charset=utf-8")
            return
        if path == "/manifest.webmanifest":
            self._file(STATIC / "manifest.webmanifest", "application/manifest+json")
            return
        if path == "/sw.js":
            self._file(STATIC / "sw.js", "application/javascript; charset=utf-8")
            return
        if path.startswith("/static/"):
            rel = path[len("/static/") :]
            target = (STATIC / rel).resolve()
            if not str(target).startswith(str(STATIC.resolve())):
                self.send_error(403)
                return
            ctype = {
                ".js": "application/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".webmanifest": "application/manifest+json",
                ".json": "application/json; charset=utf-8",
                ".html": "text/html; charset=utf-8",
            }.get(target.suffix, "application/octet-stream")
            self._file(target, ctype)
            return
        if path.startswith("/icons/"):
            self._file(STATIC / "icons" / path.split("/")[-1], "image/svg+xml" if path.endswith(".svg") else "image/png")
            return

        if path == "/api/health":
            self._json(200, {"ok": True, "version": VERSION, "name": "BizBoard"})
            return
        if path == "/api/sites":
            sites = load_sites()
            # never send passwords to clients that only need the board list? 
            # Board needs them for phone copy-login — send them (local LAN only).
            self._json(200, {"ok": True, "version": VERSION, "sites": sites, "count": len(sites)})
            return
        if path == "/api/info":
            self._json(
                200,
                {
                    "ok": True,
                    "version": VERSION,
                    "port": PORT,
                    "lan_urls": [f"http://{ip}:{PORT}/" for ip in _lan_ips()],
                    "local_url": f"http://127.0.0.1:{PORT}/",
                },
            )
            return

        self.send_error(404, "Not Found")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid JSON"})
            return

        if path == "/api/sites/save":
            sites = body.get("sites")
            if not isinstance(sites, list):
                self._json(400, {"ok": False, "error": "sites must be a list"})
                return
            save_sites(sites)
            self._json(200, {"ok": True, "saved": str(ROOT / "sites.local.json"), "count": len(sites)})
            return

        if path == "/api/login":
            site_id = str(body.get("id") or "").strip()
            site = find_site(site_id)
            if not site:
                self._json(404, {"ok": False, "error": f"site not found: {site_id}"})
                return
            # optional override from client (phone-edited credentials)
            if body.get("user"):
                site = {**site, "user": str(body.get("user"))}
            if body.get("password") is not None and str(body.get("password")) != "":
                site = {**site, "password": str(body.get("password"))}
            headless = bool(body.get("headless", False))
            result = run_login(site, headless=headless, background=True)
            self._json(200, result)
            return

        self.send_error(404, "Not Found")


def main() -> None:
    # bootstrap local sites file once
    local = ROOT / "sites.local.json"
    example = ROOT / "sites.example.json"
    if not local.is_file() and example.is_file():
        local.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")

    host = "0.0.0.0"
    httpd = ThreadingHTTPServer((host, PORT), Handler)
    lan = _lan_ips()
    print("=" * 52)
    print(f"  Biz Board v{VERSION}  (독립 실행)")
    print("=" * 52)
    print(f"  PC:     http://127.0.0.1:{PORT}/")
    for ip in lan:
        print(f"  Phone:  http://{ip}:{PORT}/")
    print()
    print("  휴대폰: 위 Phone URL 접속 → 브라우저 메뉴 → 홈 화면에 추가")
    print("  ID/PW:  biz_board/sites.local.json  편집 (또는 보드 설정)")
    print("=" * 52)

    def _open() -> None:
        try:
            webbrowser.open(f"http://127.0.0.1:{PORT}/")
        except Exception:
            pass

    threading.Timer(0.8, _open).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[biz_board] stopped")
        httpd.server_close()


if __name__ == "__main__":
    main()
