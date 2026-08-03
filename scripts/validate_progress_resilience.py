#!/usr/bin/env python3
"""Validate IndexedDB progress resilience across online, offline and PWA builds."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


def fail(message: str) -> None:
    raise SystemExit(f"PROGRESS RESILIENCE VALIDATION FAILED: {message}")


def read(path: Path) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def main() -> None:
    source = read(ROOT / "src" / "progress-resilience.js")
    generated = read(DIST / "progress-resilience.js")
    html = read(DIST / "index.html")
    offline = read(DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html")
    worker = read(DIST / "service-worker.js")

    if generated != source:
        fail("generated progress-resilience.js differs from source")

    for marker in (
        "const DB_NAME = 'medical-meq-bank';",
        "medicalBankStatusV2",
        "indexedDB.open",
        "snapshotNow",
        "location.reload()",
        "MEQProgressResilience",
    ):
        if marker not in source:
            fail(f"source is missing marker: {marker}")

    if not re.search(r"currentStatus\s*===\s*null\s*\|\|\s*isValidStatus\(currentStatus\)", source):
        fail("missing-status guard does not protect deliberate resets")
    if not re.search(r"storage\.set\s*=\s*\(key, value\)", source):
        fail("storage writes are not mirrored")

    ordered = (
        '<script src="./app.js"></script>',
        '<script src="./progress-resilience.js"></script>',
        '<script src="./lecture-loader.js"></script>',
        '<script src="./pwa-client.js"></script>',
    )
    positions = []
    for marker in ordered:
        if html.count(marker) != 1:
            fail(f"online HTML must contain exactly one {marker}")
        positions.append(html.index(marker))
    if positions != sorted(positions):
        fail("online runtime order is not app, resilience, loader, PWA client")

    if offline.count('id="progress-resilience-runtime"') != 1:
        fail("offline HTML does not embed progress resilience exactly once")
    if '<script src="./progress-resilience.js"></script>' in offline:
        fail("offline HTML still depends on external progress resilience")

    if "./progress-resilience.js" not in worker:
        fail("service worker does not pre-cache progress resilience")

    print("Validated IndexedDB progress resilience integration")


if __name__ == "__main__":
    main()
