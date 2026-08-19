#!/usr/bin/env python3
"""비즈보드 로컬 서버 — 휴대폰에서 같은 Wi-Fi로 접속 후 홈 화면 추가."""

from __future__ import annotations

import argparse
import http.server
import os
import socket
import socketserver
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8787


def lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main() -> int:
    parser = argparse.ArgumentParser(description="Biz Board local static server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    os.chdir(ROOT)

    class Handler(http.server.SimpleHTTPRequestHandler):
        extensions_map = {
            **getattr(http.server.SimpleHTTPRequestHandler, "extensions_map", {}),
            ".webmanifest": "application/manifest+json",
            ".js": "application/javascript",
        }

        def log_message(self, fmt: str, *a) -> None:
            sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % a))

    with socketserver.TCPServer(("0.0.0.0", args.port), Handler) as httpd:
        ip = lan_ip()
        print("=" * 56)
        print("  비즈보드 v1.0.0")
        print(f"  PC:     http://127.0.0.1:{args.port}/")
        print(f"  휴대폰: http://{ip}:{args.port}/")
        print("  → 브라우저에서 연 뒤 '홈 화면에 추가'")
        print("  종료: Ctrl+C")
        print("=" * 56)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
