#!/usr/bin/env python3
"""Generate the deployable Medical MEQ Bank application.

The online build keeps the shell and runtimes split, then loads lecture JSON by
subject. The standalone offline copy embeds the full validated lecture bank and
all core source assets so it remains directly openable as one HTML file.
"""

from __future__ import annotations

from pathlib import Path
import json
import re
import sys

from lecture_builder import build_lecture_extensions


ROOT = Path(__file__).resolve().parent.parent


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


def ensure_external_script_after(text: str, after_src: str, source: str) -> str:
    tag = f'<script src="{source}"></script>'
    if tag in text:
        return text
    marker = f'<script src="{after_src}"></script>'
    if marker not in text:
        raise SystemExit(f"Could not insert {source}: missing {after_src}")
    return text.replace(marker, marker + "\n" + tag, 1)


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


def safe_inline_script(source: str) -> str:
    return re.sub(r"</script", r"<\\/script", source, flags=re.I)


def safe_inline_style(source: str) -> str:
    return re.sub(r"</style", r"<\\/style", source, flags=re.I)


def create_offline_copy(
    html: str,
    *,
    app_css: str,
    app_js: str,
    progress_js: str,
    lecture_batch_js: str,
    pwa_client_js: str,
) -> str:
    offline = html
    offline = replace_required(
        offline,
        '<link rel="stylesheet" href="./app.css">',
        f'<style id="app-source-styles">\n{safe_inline_style(app_css)}\n</style>',
        "offline application styles",
    )
    offline = replace_required(
        offline,
        '<script src="./app.js"></script>',
        f'<script id="app-source-runtime">\n{safe_inline_script(app_js)}\n</script>',
        "offline application runtime",
    )
    offline = replace_required(
        offline,
        '<script src="./progress-resilience.js"></script>',
        f'<script id="progress-resilience-runtime">\n{safe_inline_script(progress_js)}\n</script>',
        "offline progress resilience",
    )
    offline = replace_required(
        offline,
        '<script src="./lecture-loader.js"></script>',
        f'<script id="lecture-extensions">\n{safe_inline_script(lecture_batch_js)}\n</script>',
        "offline lecture bank",
    )
    offline = replace_required(
        offline,
        '<script src="./pwa-client.js"></script>',
        f'<script id="pwa-client-runtime">\n{safe_inline_script(pwa_client_js)}\n</script>',
        "offline PWA client",
    )
    return offline


def patch_service_worker(output: Path, catalog_entries: list[dict]) -> None:
    worker_path = output / "service-worker.js"
    worker = worker_path.read_text(encoding="utf-8")
    assets = ["./lectures/catalog.json"] + [
        f"./lectures/{entry['file']}" for entry in catalog_entries
    ]
    replacement = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    worker = replace_required(
        worker,
        "/*__LECTURE_ASSETS__*/ []",
        replacement,
        "lecture service-worker precache",
    )
    worker_path.write_text(worker, encoding="utf-8")


def build(output: Path) -> None:
    html_path = output / "index.html"
    app_css_path = output / "app.css"
    app_js_path = output / "app.js"
    progress_path = output / "progress-resilience.js"
    lecture_loader_path = output / "lecture-loader.js"
    pwa_client_path = output / "pwa-client.js"
    service_worker_path = output / "service-worker.js"
    for path in (
        html_path,
        app_css_path,
        app_js_path,
        progress_path,
        lecture_loader_path,
        pwa_client_path,
        service_worker_path,
    ):
        if not path.is_file():
            raise SystemExit(f"Missing generated application source: {path}")

    version_data = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    version = version_data.get("version")
    if not isinstance(version, str) or not version.strip():
        raise SystemExit("version.json is missing a valid version")

    catalog = json.loads((ROOT / "lectures" / "catalog.json").read_text(encoding="utf-8"))
    catalog_entries = catalog.get("lectures")
    if not isinstance(catalog_entries, list) or not catalog_entries:
        raise SystemExit("Lecture catalog has no entries")

    review_css = (ROOT / "review-filter.css").read_text(encoding="utf-8")
    review_js = (ROOT / "review-filter.js").read_text(encoding="utf-8")
    responsive_sidebar_js = (ROOT / "responsive-sidebars.js").read_text(encoding="utf-8")
    mobile_filter_css = (ROOT / "mobile-filters.css").read_text(encoding="utf-8")
    mobile_filter_js = (ROOT / "mobile-filters.js").read_text(encoding="utf-8")
    search_optimization_js = (ROOT / "search-optimization.js").read_text(encoding="utf-8")
    print_css = (ROOT / "src" / "print-manager.css").read_text(encoding="utf-8")
    print_js = (ROOT / "src" / "print-manager.js").read_text(encoding="utf-8")
    back_to_top_css = (ROOT / "back-to-top.css").read_text(encoding="utf-8")
    back_to_top_js = (ROOT / "back-to-top.js").read_text(encoding="utf-8")
    lecture_batch_js = build_lecture_extensions(ROOT)

    text = html_path.read_text(encoding="utf-8")
    app_css = app_css_path.read_text(encoding="utf-8")
    app_js = app_js_path.read_text(encoding="utf-8")
    progress_js = progress_path.read_text(encoding="utf-8")
    pwa_client_js = pwa_client_path.read_text(encoding="utf-8")

    pwa_client_js = replace_regex_required(
        pwa_client_js,
        r"const APP_VERSION = '[^']+';",
        f"const APP_VERSION = '{version}';",
        "PWA APP_VERSION update",
    )

    text = ensure_external_script_after(text, "./app.js", "./progress-resilience.js")
    text = ensure_external_script_after(text, "./progress-resilience.js", "./lecture-loader.js")
    text = ensure_accessibility_attributes(text)
    text = upsert_style(text, "review-filter-styles", review_css)
    text = upsert_style(text, "mobile-filter-styles", mobile_filter_css)
    text = upsert_style(text, "print-manager-styles", print_css)
    text = upsert_style(text, "back-to-top-styles", back_to_top_css)
    text = upsert_script(
        text,
        "responsive-sidebar-extension",
        responsive_sidebar_js,
        before_id="review-filter-extension",
    )
    text = upsert_script(text, "review-filter-extension", review_js)
    text = upsert_script(text, "mobile-filter-extension", mobile_filter_js)
    text = upsert_script(text, "search-optimization-extension", search_optimization_js)
    text = upsert_script(text, "print-manager-extension", print_js)
    text = upsert_script(text, "back-to-top-extension", back_to_top_js)

    html_path.write_text(text, encoding="utf-8")
    app_js_path.write_text(app_js, encoding="utf-8")
    pwa_client_path.write_text(pwa_client_js, encoding="utf-8")
    patch_service_worker(output, catalog_entries)

    offline_path = output / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
    offline_path.parent.mkdir(parents=True, exist_ok=True)
    offline_text = create_offline_copy(
        text,
        app_css=app_css,
        app_js=app_js,
        progress_js=progress_js,
        lecture_batch_js=lecture_batch_js,
        pwa_client_js=pwa_client_js,
    )
    offline_path.write_text(offline_text, encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/build_app.py <output-directory>")
    build(Path(sys.argv[1]))
