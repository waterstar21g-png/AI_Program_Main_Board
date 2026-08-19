"""비즈보드 스모크: 바로가기 20개 이상 · 필수 필드."""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class BizBoardSmoke(unittest.TestCase):
    def test_version_file(self):
        text = (ROOT / "VERSION.txt").read_text(encoding="utf-8").strip()
        self.assertTrue(text)
        self.assertRegex(text, r"^\d+\.\d+\.\d+$")

    def test_shortcuts_at_least_20(self):
        raw = (ROOT / "config.js").read_text(encoding="utf-8")
        # Extract JSON-like array via shortcuts count of "id":
        ids = re.findall(r'id:\s*"([^"]+)"', raw)
        # filter only shortcut ids (exclude nested none)
        self.assertGreaterEqual(len(ids), 20, f"got {len(ids)} ids: {ids}")
        self.assertEqual(len(ids), len(set(ids)), "duplicate shortcut ids")

    def test_core_files_exist(self):
        for name in (
            "index.html",
            "login.html",
            "app.js",
            "config.js",
            "styles.css",
            "manifest.webmanifest",
            "sw.js",
            "serve.py",
            "icons/icon-192.png",
            "icons/icon-512.png",
            "icons/apple-touch-icon.png",
        ):
            self.assertTrue((ROOT / name).is_file(), name)

    def test_manifest_json(self):
        data = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(data.get("short_name"), "비즈보드")
        self.assertEqual(data.get("display"), "standalone")
        self.assertTrue(data.get("icons"))


if __name__ == "__main__":
    unittest.main()
