#!/usr/bin/env python3
"""Enforce practical size budgets for the generated study bank."""

from __future__ import annotations

from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

BUDGETS = {
    "index.html": 1_500_000,
    "app.css": 500_000,
    "app.js": 500_000,
    "progress-resilience.js": 100_000,
    "lecture-loader.js": 100_000,
    "pwa-client.js": 150_000,
    "service-worker.js": 100_000,
    "offline/Medical_MEQ_Review_Bank_Offline.html": 20_000_000,
}
MAX_LECTURE_JSON_BYTES = 4_000_000
MAX_TOTAL_LECTURE_BYTES = 18_000_000
MAX_TOTAL_DIST_BYTES = 30_000_000


def fail(message: str) -> None:
    raise SystemExit(f"PERFORMANCE BUDGET FAILED: {message}")


def size(path: Path) -> int:
    if not path.is_file():
        fail(f"missing generated file: {path.relative_to(ROOT)}")
    return path.stat().st_size


def main() -> None:
    measured = {}
    for relative, budget in BUDGETS.items():
        actual = size(DIST / relative)
        measured[relative] = actual
        if actual > budget:
            fail(f"{relative} is {actual:,} bytes; budget is {budget:,}")

    catalog_path = DIST / "lectures" / "catalog.json"
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"could not read generated lecture catalog: {error}")

    entries = catalog.get("lectures") if isinstance(catalog, dict) else None
    if not isinstance(entries, list) or not entries:
        fail("generated lecture catalog has no entries")

    total_lecture_bytes = size(catalog_path)
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
            fail("generated lecture catalog contains an invalid entry")
        path = DIST / "lectures" / entry["file"]
        actual = size(path)
        measured[f"lectures/{entry['file']}"] = actual
        total_lecture_bytes += actual
        if actual > MAX_LECTURE_JSON_BYTES:
            fail(
                f"lecture {entry.get('id', entry['file'])} is {actual:,} bytes; "
                f"per-lecture budget is {MAX_LECTURE_JSON_BYTES:,}"
            )

    if total_lecture_bytes > MAX_TOTAL_LECTURE_BYTES:
        fail(
            f"lecture assets total {total_lecture_bytes:,} bytes; "
            f"budget is {MAX_TOTAL_LECTURE_BYTES:,}"
        )

    total_dist_bytes = sum(
        path.stat().st_size
        for path in DIST.rglob("*")
        if path.is_file()
    )
    if total_dist_bytes > MAX_TOTAL_DIST_BYTES:
        fail(
            f"dist totals {total_dist_bytes:,} bytes; "
            f"budget is {MAX_TOTAL_DIST_BYTES:,}"
        )

    print("Validated production performance budgets")
    for relative, actual in sorted(measured.items()):
        print(f"  {relative}: {actual:,} bytes")
    print(f"  lecture assets total: {total_lecture_bytes:,} bytes")
    print(f"  dist total: {total_dist_bytes:,} bytes")


if __name__ == "__main__":
    main()
