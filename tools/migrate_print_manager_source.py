#!/usr/bin/env python3
"""Migrate the print manager from compressed transport files to readable source."""

from __future__ import annotations

from pathlib import Path
import base64
import gzip
import json
import re


ROOT = Path(__file__).resolve().parent.parent


def decode(source: Path) -> str:
    encoded = source.read_text(encoding="ascii").strip()
    try:
        return gzip.decompress(base64.b64decode(encoded, validate=True)).decode("utf-8")
    except Exception as error:
        raise SystemExit(f"Could not decode {source.name}: {error}") from error


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Could not apply {label} in {path.relative_to(ROOT)}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def main() -> None:
    css_encoded = ROOT / "print-manager.v8.css.gz.b64"
    js_encoded = ROOT / "print-manager.v8.js.gz.b64"
    css_output = ROOT / "src" / "print-manager.css"
    js_output = ROOT / "src" / "print-manager.js"

    if not css_output.is_file():
        css_output.write_text(decode(css_encoded).rstrip() + "\n", encoding="utf-8")
    if not js_output.is_file():
        js_output.write_text(decode(js_encoded).rstrip() + "\n", encoding="utf-8")

    if css_output.stat().st_size < 1_000 or js_output.stat().st_size < 5_000:
        raise SystemExit("Decoded print manager source is unexpectedly small")

    build = ROOT / "build.sh"
    replace_once(build, "  print-manager.v8.css.gz.b64\n  print-manager.v8.js.gz.b64", "  src/print-manager.css\n  src/print-manager.js", "print source requirements")
    replace_once(build, "node --check src/pwa-client.js\n", "node --check src/pwa-client.js\nnode --check src/print-manager.js\n", "print source syntax")

    builder = ROOT / "tools" / "build_app.py"
    text = builder.read_text(encoding="utf-8")
    text = text.replace("import base64\nimport gzip\n", "")
    text = re.sub(
        r"\n\ndef decode_gzip_b64\(path: Path\) -> str:\n.*?\n\ndef replace_required",
        "\n\ndef replace_required",
        text,
        count=1,
        flags=re.S,
    )
    text = text.replace(
        '    print_css = decode_gzip_b64(ROOT / "print-manager.v8.css.gz.b64")\n'
        '    print_js = decode_gzip_b64(ROOT / "print-manager.v8.js.gz.b64")',
        '    print_css = (ROOT / "src" / "print-manager.css").read_text(encoding="utf-8")\n'
        '    print_js = (ROOT / "src" / "print-manager.js").read_text(encoding="utf-8")',
        1,
    )
    if "decode_gzip_b64" in text or "print-manager.v8" in text:
        raise SystemExit("Compressed print-manager references remain in tools/build_app.py")
    builder.write_text(text, encoding="utf-8")

    validator = ROOT / "scripts" / "validate_build.py"
    validation_text = validator.read_text(encoding="utf-8")
    if 'source_print_css = read_text(ROOT / "src" / "print-manager.css")' not in validation_text:
        marker = '    source_pwa = read_text(ROOT / "src" / "pwa-client.js")\n'
        if marker not in validation_text:
            raise SystemExit("Could not add readable print source validation")
        validation_text = validation_text.replace(
            marker,
            marker
            + '    source_print_css = read_text(ROOT / "src" / "print-manager.css")\n'
            + '    source_print_js = read_text(ROOT / "src" / "print-manager.js")\n'
            + '    if len(source_print_css) < 1_000 or len(source_print_js) < 5_000:\n'
            + '        fail("readable print-manager source is unexpectedly small")\n',
            1,
        )
    validator.write_text(validation_text, encoding="utf-8")

    ci = ROOT / ".github" / "workflows" / "validate-bank.yml"
    replace_once(ci, "          node --check src/pwa-client.js\n", "          node --check src/pwa-client.js\n          node --check src/print-manager.js\n", "print source CI syntax")

    readme = ROOT / "README.md"
    readme_text = readme.read_text(encoding="utf-8")
    if "src/print-manager.js" not in readme_text:
        readme_text = readme_text.replace(
            "src/pwa-client.js                  Updates, backup import/export and PWA client\n",
            "src/pwa-client.js                  Updates, backup import/export and PWA client\nsrc/print-manager.css               Reviewable print and PDF styles\nsrc/print-manager.js                Reviewable print and PDF runtime\n",
            1,
        )
    readme.write_text(readme_text, encoding="utf-8")

    worker = ROOT / "service-worker.js"
    worker_text = worker.read_text(encoding="utf-8")
    worker_text, count = re.subn(
        r"const APP_VERSION = '[^']+';",
        "const APP_VERSION = '2026.08.03.15';",
        worker_text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not update service worker version")
    worker.write_text(worker_text, encoding="utf-8")
    (ROOT / "version.json").write_text(
        json.dumps(
            {"version": "2026.08.03.15", "updatedAt": "2026-08-03T06:20:00+03:00"},
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    print("Migrated print manager to readable source files")


if __name__ == "__main__":
    main()
