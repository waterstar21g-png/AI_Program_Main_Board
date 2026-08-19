"""비즈 보드 단위 테스트 — 서버·사이트 로더."""

from __future__ import annotations

import json
import sys
import threading
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from login_runner import find_site, load_sites  # noqa: E402
from server import Handler, VERSION  # noqa: E402
from http.server import ThreadingHTTPServer


def test_sites_count_at_least_20():
    sites = load_sites()
    assert len(sites) >= 20, f"expected >=20 sites, got {len(sites)}"
    for s in sites:
        assert s.get("id")
        assert s.get("name")
        assert s.get("url", "").startswith("http")


def test_find_site_demango():
    site = find_site("demango")
    assert site is not None
    assert "cafe24" in site["url"]


def test_api_health_and_sites():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=5) as r:
            health = json.loads(r.read().decode("utf-8"))
        assert health["ok"] is True
        assert health["version"] == VERSION

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/sites", timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
        assert data["ok"] is True
        assert data["count"] >= 20

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as r:
            html = r.read().decode("utf-8")
        assert "비즈 보드" in html
        assert 'rel="manifest"' in html
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    test_sites_count_at_least_20()
    test_find_site_demango()
    test_api_health_and_sites()
    print("ok", len(load_sites()), "sites · version", VERSION)
