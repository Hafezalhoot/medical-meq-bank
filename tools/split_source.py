#!/usr/bin/env python3
"""Extract the original monolithic application CSS and JavaScript.

This migration is deliberately strict. It refuses to modify the source unless
there is exactly one inline style block and exactly one inline application
script containing stable application and persistence markers.
"""

from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "index.html"
CSS_PATH = ROOT / "src" / "app.css"
JS_PATH = ROOT / "src" / "app.js"

STYLE_PATTERN = re.compile(r"<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>", re.I | re.S)
SCRIPT_PATTERN = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.I | re.S)


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")

    if '<link rel="stylesheet" href="./app.css">' in text and '<script src="./app.js"></script>' in text:
        if not CSS_PATH.is_file() or not JS_PATH.is_file():
            raise SystemExit("External source markers exist but app.css or app.js is missing")
        print("Application source is already split")
        return

    styles = list(STYLE_PATTERN.finditer(text))
    if len(styles) != 1:
        raise SystemExit(f"Expected exactly one inline style block; found {len(styles)}")
    style_match = styles[0]
    if style_match.group("attrs").strip():
        raise SystemExit("The original style block has unexpected attributes")

    scripts = [
        match
        for match in SCRIPT_PATTERN.finditer(text)
        if "src=" not in match.group("attrs").lower()
        and "APP_VERSION" in match.group("body")
        and "medicalBankStatusV2" in match.group("body")
    ]
    if len(scripts) != 1:
        inventory = [
            {
                "bytes": len(match.group("body")),
                "attrs": match.group("attrs").strip(),
                "has_app_version": "APP_VERSION" in match.group("body"),
                "has_progress_key": "medicalBankStatusV2" in match.group("body"),
            }
            for match in SCRIPT_PATTERN.finditer(text)
            if "src=" not in match.group("attrs").lower()
        ]
        raise SystemExit(
            f"Expected exactly one inline application script; found {len(scripts)}; "
            f"inline inventory={inventory}"
        )
    script_match = scripts[0]
    if script_match.group("attrs").strip():
        raise SystemExit("The original application script has unexpected attributes")

    css = style_match.group("body").strip() + "\n"
    javascript = script_match.group("body").strip() + "\n"
    if len(css) < 10_000 or len(javascript) < 10_000:
        raise SystemExit("Extracted application source is unexpectedly small")

    replacements = [
        (style_match.start(), style_match.end(), '<link rel="stylesheet" href="./app.css">'),
        (script_match.start(), script_match.end(), '<script src="./app.js"></script>'),
    ]
    for start, end, replacement in sorted(replacements, reverse=True):
        text = text[:start] + replacement + text[end:]

    if "APP_VERSION" in text or "medicalBankStatusV2" in text:
        raise SystemExit("Application JavaScript remains embedded in index.html")

    CSS_PATH.write_text(css, encoding="utf-8")
    JS_PATH.write_text(javascript, encoding="utf-8")
    SOURCE.write_text(text, encoding="utf-8")

    print(f"Wrote {CSS_PATH.relative_to(ROOT)} ({CSS_PATH.stat().st_size} bytes)")
    print(f"Wrote {JS_PATH.relative_to(ROOT)} ({JS_PATH.stat().st_size} bytes)")
    print(f"Updated {SOURCE.relative_to(ROOT)} ({SOURCE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
