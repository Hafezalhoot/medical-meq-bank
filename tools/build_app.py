#!/usr/bin/env python3
"""Generate the deployable Medical MEQ Bank application.

The reviewable shell lives in ``src/index.html``. This builder applies small,
validated compatibility patches and injects independently maintained feature
extensions into both the online app and the standalone offline copy.
"""

from __future__ import annotations

from pathlib import Path
import base64
import gzip
import json
import re
import sys

from lecture_builder import build_lecture_extensions


ROOT = Path(__file__).resolve().parent.parent


def decode_gzip_b64(path: Path) -> str:
    encoded = path.read_text(encoding="ascii").strip()
    try:
        return gzip.decompress(base64.b64decode(encoded, validate=True)).decode("utf-8")
    except Exception as error:
        raise SystemExit(f"Could not decode {path}: {error}") from error


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f"Could not apply {label}")


def replace_regex_required(
    text: str,
    pattern: str,
    replacement: str,
    label: str,
    *,
    flags: int = 0,
) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Could not apply {label}")
    return updated


def upsert_style(text: str, element_id: str, content: str) -> str:
    tag = f'<style id="{element_id}">\n{content}\n</style>'
    pattern = rf'<style id="{re.escape(element_id)}">.*?</style>'
    if re.search(pattern, text, flags=re.S):
        return re.sub(pattern, lambda _: tag, text, count=1, flags=re.S)
    if "</head>" not in text:
        raise SystemExit(f"Could not inject style {element_id}: missing </head>")
    return text.replace("</head>", tag + "\n</head>", 1)


def upsert_script(
    text: str,
    element_id: str,
    content: str,
    *,
    before_id: str | None = None,
) -> str:
    tag = f'<script id="{element_id}">\n{content}\n</script>'
    pattern = rf'<script id="{re.escape(element_id)}">.*?</script>'
    if re.search(pattern, text, flags=re.S):
        return re.sub(pattern, lambda _: tag, text, count=1, flags=re.S)

    if before_id:
        marker = f'<script id="{before_id}">'
        if marker in text:
            return text.replace(marker, tag + "\n" + marker, 1)

    if "</body>" not in text:
        raise SystemExit(f"Could not inject script {element_id}: missing </body>")
    before_body, after_body = text.rsplit("</body>", 1)
    return before_body + tag + "\n</body>" + after_body


def ensure_accessibility_attributes(text: str) -> str:
    text = text.replace(
        '<div class="empty-message" id="emptyMessage">',
        '<div class="empty-message" id="emptyMessage" aria-live="polite">',
        1,
    )
    text = text.replace(
        '<div class="toast" id="appToast">',
        '<div class="toast" id="appToast" role="status" aria-live="polite">',
        1,
    )
    return text


def build(output: Path) -> None:
    html = output / "index.html"
    if not html.is_file():
        raise SystemExit(f"Missing generated application shell: {html}")

    version_data = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    version = version_data.get("version")
    if not isinstance(version, str) or not version.strip():
        raise SystemExit("version.json is missing a valid version")

    review_css = (ROOT / "review-filter.css").read_text(encoding="utf-8")
    review_js = (ROOT / "review-filter.js").read_text(encoding="utf-8")
    mobile_filter_css = (ROOT / "mobile-filters.css").read_text(encoding="utf-8")
    mobile_filter_js = (ROOT / "mobile-filters.js").read_text(encoding="utf-8")
    print_css = decode_gzip_b64(ROOT / "print-manager.v8.css.gz.b64")
    print_js = decode_gzip_b64(ROOT / "print-manager.v8.js.gz.b64")
    back_to_top_css = (ROOT / "back-to-top.css").read_text(encoding="utf-8")
    back_to_top_js = (ROOT / "back-to-top.js").read_text(encoding="utf-8")
    lecture_js = build_lecture_extensions(ROOT)

    text = html.read_text(encoding="utf-8")

    text = replace_regex_required(
        text,
        r"const APP_VERSION = '[^']+';",
        f"const APP_VERSION = '{version}';",
        "APP_VERSION update",
    )

    old_state = "const state=JSON.parse(storage.get('medicalBankStatusV2')||'{}');"
    new_state = (
        "const state=(()=>{try{const value=JSON.parse(storage.get('medicalBankStatusV2')||'{}');"
        "return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(e){return {}}})();"
    )
    text = replace_required(text, old_state, new_state, "safe progress-state parser")

    old_restore = (
        "Object.entries(data.storage).forEach(([k,v]) => { "
        "if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });"
    )
    new_restore = (
        "[...Array(localStorage.length)].map((_,i)=>localStorage.key(i))"
        ".filter(k=>k&&k.startsWith('medicalBank')).forEach(k=>localStorage.removeItem(k)); "
        "Object.entries(data.storage).forEach(([k,v]) => { "
        "if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });"
    )
    text = replace_required(text, old_restore, new_restore, "clean progress restore")
    text = ensure_accessibility_attributes(text)

    text = upsert_style(text, "review-filter-styles", review_css)
    text = upsert_style(text, "mobile-filter-styles", mobile_filter_css)
    text = upsert_style(text, "print-manager-styles", print_css)
    text = upsert_style(text, "back-to-top-styles", back_to_top_css)

    if lecture_js:
        text = upsert_script(
            text,
            "lecture-extensions",
            lecture_js,
            before_id="review-filter-extension",
        )
    text = upsert_script(text, "review-filter-extension", review_js)
    text = upsert_script(text, "mobile-filter-extension", mobile_filter_js)
    text = upsert_script(text, "print-manager-extension", print_js)
    text = upsert_script(text, "back-to-top-extension", back_to_top_js)

    html.write_text(text, encoding="utf-8")

    offline = output / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
    offline.parent.mkdir(parents=True, exist_ok=True)
    offline_text = text
    if '<base href="../">' not in offline_text:
        if "<head>" not in offline_text:
            raise SystemExit("Could not create offline copy: missing <head>")
        offline_text = offline_text.replace("<head>", '<head>\n<base href="../">', 1)
    offline.write_text(offline_text, encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/build_app.py <output-directory>")
    build(Path(sys.argv[1]))
