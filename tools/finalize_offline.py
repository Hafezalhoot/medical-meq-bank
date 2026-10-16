#!/usr/bin/env python3
"""Remove PWA-only external links from the directly opened offline HTML file."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OFFLINE = ROOT / "dist" / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
MAX_LEGACY_OFFLINE_BYTES = 8_000_000

PWA_ONLY_LINKS = (
    '<link rel="manifest" href="./manifest.webmanifest">',
    '<link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">',
    '<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">',
)


def main() -> None:
    if not OFFLINE.is_file():
        raise SystemExit(f"Missing standalone offline file: {OFFLINE}")

    html = OFFLINE.read_text(encoding="utf-8")
    for link in PWA_ONLY_LINKS:
        count = html.count(link)
        if count != 1:
            raise SystemExit(
                f"Expected exactly one PWA-only link in standalone HTML, found {count}: {link}"
            )
        html = html.replace(link, "", 1)

    OFFLINE.write_text(html, encoding="utf-8")
    actual = OFFLINE.stat().st_size
    if actual > MAX_LEGACY_OFFLINE_BYTES:
        raise SystemExit(
            "Legacy standalone offline export exceeded its 8 MB safety ceiling "
            f"({actual:,} bytes). Use selective PWA lecture/subject downloads instead."
        )
    print(
        "Standalone legacy offline HTML finalized without external PWA link dependencies "
        f"({actual:,} bytes / {MAX_LEGACY_OFFLINE_BYTES:,} byte ceiling)"
    )


if __name__ == "__main__":
    main()
