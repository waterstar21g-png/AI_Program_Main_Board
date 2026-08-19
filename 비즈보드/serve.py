#!/usr/bin/env python3
"""비즈보드 독립 로컬 서버 (기본 http://127.0.0.1:8787)."""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="비즈보드 local server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    os.chdir(ROOT)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    with socketserver.ThreadingTCPServer((args.host, args.port), handler) as httpd:
        httpd.allow_reuse_address = True
        print(f"비즈보드 실행: http://{args.host}:{args.port}/")
        print("종료: Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n중지")


if __name__ == "__main__":
    main()
