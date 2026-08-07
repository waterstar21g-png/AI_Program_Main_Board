"""BATCH 1~13 순차 골격 단위 테스트 (브라우저 최소)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import batch_steps as B  # noqa: E402


def test_batch_module_has_ordered_steps():
    names = [
        "run_row_batch",
        "step02_init",
        "step03_input_url",
        "step04_click_search",
        "step05_popup_open",
        "step06_popup_close",
        "step07_save_range",
        "step08_filter_count",
        "step09_to_12_db_save",
    ]
    for n in names:
        assert hasattr(B, n), n
        assert callable(getattr(B, n)), n


def test_doc_mentions_failure_cause():
    doc = Path(B.__file__).read_text(encoding="utf-8")
    assert "6·11·12" in doc or "6·11·12" in doc.replace(" ", "")
    assert "순차" in doc


if __name__ == "__main__":
    failed = 0
    for name, fn in [
        ("ordered_steps", test_batch_module_has_ordered_steps),
        ("doc", test_doc_mentions_failure_cause),
    ]:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as e:
            failed += 1
            print(f"FAIL {name}: {type(e).__name__}: {e}")
    raise SystemExit(failed)
