#!/usr/bin/env python3
"""Extract the original monolithic application CSS and JavaScript.

The source contains one application runtime and one smaller PWA/update client.
This migration is strict and refuses to modify the page when those blocks
cannot be identified uniquely from stable behavior markers.
"""

from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "index.html"
CSS_PATH = ROOT / "src" / "app.css"
APP_JS_PATH = ROOT / "src" / "app.js"
PWA_JS_PATH = ROOT / "src" / "pwa-client.js"

STYLE_PATTERN = re.compile(r"<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>", re.I | re.S)
SCRIPT_PATTERN = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.I | re.S)


def _inline_scripts(text: str) -> list[re.Match[str]]:
    return [
        match
        for match in SCRIPT_PATTERN.finditer(text)
        if "src=" not in match.group("attrs").lower()
    ]


def _inventory(matches: list[re.Match[str]]) -> list[dict[str, object]]:
    return [
        {
            "bytes": len(match.group("body")),
            "attrs": match.group("attrs").strip(),
            "has_app_version": "APP_VERSION" in match.group("body"),
            "has_progress_key": "medicalBankStatusV2" in match.group("body"),
            "has_service_worker": "serviceWorker" in match.group("body"),
        }
        for match in matches
    ]


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")

    expected_markers = (
        '<link rel="stylesheet" href="./app.css">',
        '<script src="./app.js"></script>',
        '<script src="./pwa-client.js"></script>',
    )
    if all(marker in text for marker in expected_markers):
        missing = [
            path.name
            for path in (CSS_PATH, APP_JS_PATH, PWA_JS_PATH)
            if not path.is_file()
        ]
        if missing:
            raise SystemExit(
                "External source markers exist but files are missing: "
                + ", ".join(missing)
            )
        print("Application source is already split")
        return

    styles = list(STYLE_PATTERN.finditer(text))
    if len(styles) != 1:
        raise SystemExit(f"Expected exactly one inline style block; found {len(styles)}")
    style_match = styles[0]
    if style_match.group("attrs").strip():
        raise SystemExit("The original style block has unexpected attributes")

    inline_scripts = _inline_scripts(text)
    app_scripts = [
        match for match in inline_scripts
        if "medicalBankStatusV2" in match.group("body")
        and "APP_VERSION" not in match.group("body")
    ]
    pwa_scripts = [
        match for match in inline_scripts
        if "APP_VERSION" in match.group("body")
        and "serviceWorker" in match.group("body")
    ]
    if len(app_scripts) != 1 or len(pwa_scripts) != 1:
        raise SystemExit(
            "Could not uniquely identify application and PWA scripts; "
            f"app={len(app_scripts)}, pwa={len(pwa_scripts)}, "
            f"inline inventory={_inventory(inline_scripts)}"
        )

    app_match = app_scripts[0]
    pwa_match = pwa_scripts[0]
    if app_match is pwa_match:
        raise SystemExit("Application and PWA scripts unexpectedly resolve to the same block")
    if app_match.group("attrs").strip() or pwa_match.group("attrs").strip():
        raise SystemExit("Original application scripts have unexpected attributes")

    css = style_match.group("body").strip() + "\n"
    app_javascript = app_match.group("body").strip() + "\n"
    pwa_javascript = pwa_match.group("body").strip() + "\n"
    if len(css) < 10_000 or len(app_javascript) < 100_000 or len(pwa_javascript) < 1_000:
        raise SystemExit("Extracted application source is unexpectedly small")

    replacements = [
        (style_match.start(), style_match.end(), '<link rel="stylesheet" href="./app.css">'),
        (app_match.start(), app_match.end(), '<script src="./app.js"></script>'),
        (pwa_match.start(), pwa_match.end(), '<script src="./pwa-client.js"></script>'),
    ]
    for start, end, replacement in sorted(replacements, reverse=True):
        text = text[:start] + replacement + text[end:]

    for forbidden in ("APP_VERSION", "medicalBankStatusV2"):
        if forbidden in text:
            raise SystemExit(f"Application marker remains embedded in index.html: {forbidden}")

    CSS_PATH.write_text(css, encoding="utf-8")
    APP_JS_PATH.write_text(app_javascript, encoding="utf-8")
    PWA_JS_PATH.write_text(pwa_javascript, encoding="utf-8")
    SOURCE.write_text(text, encoding="utf-8")

    print(f"Wrote {CSS_PATH.relative_to(ROOT)} ({CSS_PATH.stat().st_size} bytes)")
    print(f"Wrote {APP_JS_PATH.relative_to(ROOT)} ({APP_JS_PATH.stat().st_size} bytes)")
    print(f"Wrote {PWA_JS_PATH.relative_to(ROOT)} ({PWA_JS_PATH.stat().st_size} bytes)")
    print(f"Updated {SOURCE.relative_to(ROOT)} ({SOURCE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
