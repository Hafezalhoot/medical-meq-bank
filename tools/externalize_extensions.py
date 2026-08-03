#!/usr/bin/env python3
"""One-time migration from inline generated extensions to cacheable bundles."""

from __future__ import annotations

from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parent.parent


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Could not apply {label} in {path.relative_to(ROOT)}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_builder() -> None:
    path = ROOT / "tools" / "build_app.py"
    text = path.read_text(encoding="utf-8")

    signature_old = "    app_css: str,\n    app_js: str,\n    progress_resilience_js: str,"
    signature_new = "    app_css: str,\n    extensions_css: str,\n    app_js: str,\n    progress_resilience_js: str,\n    extensions_js: str,"
    if signature_new not in text:
        if signature_old not in text:
            raise SystemExit("Could not extend offline bundle signature")
        text = text.replace(signature_old, signature_new, 1)

    style_marker = (
        "    offline = replace_required(\n"
        "        offline,\n"
        "        '<script src=\"./app.js\"></script>',"
    )
    style_addition = (
        "    offline = replace_required(\n"
        "        offline,\n"
        "        '<link rel=\"stylesheet\" href=\"./extensions.css\">',\n"
        "        f'<style id=\"extension-source-styles\">\\n{safe_inline_style(extensions_css)}\\n</style>',\n"
        "        \"offline extension styles\",\n"
        "    )\n"
        + style_marker
    )
    if "offline extension styles" not in text:
        if style_marker not in text:
            raise SystemExit("Could not inline extension styles for offline output")
        text = text.replace(style_marker, style_addition, 1)

    script_marker = (
        "    offline = replace_required(\n"
        "        offline,\n"
        "        '<script src=\"./pwa-client.js\"></script>',"
    )
    script_addition = (
        "    offline = replace_required(\n"
        "        offline,\n"
        "        '<script src=\"./extensions.js\"></script>',\n"
        "        f'<script id=\"extension-source-runtime\">\\n{safe_inline_script(extensions_js)}\\n</script>',\n"
        "        \"offline extension runtime\",\n"
        "    )\n"
        + script_marker
    )
    if "offline extension runtime" not in text:
        if script_marker not in text:
            raise SystemExit("Could not inline extension JavaScript for offline output")
        text = text.replace(script_marker, script_addition, 1)

    block_pattern = re.compile(
        r"    text = ensure_accessibility_attributes\(text\)\n"
        r"    text = upsert_style\(text, \"review-filter-styles\", review_css\).*?"
        r"    text = upsert_script\(text, \"back-to-top-extension\", back_to_top_js\)\n",
        re.S,
    )
    replacement = '''    text = ensure_accessibility_attributes(text)

    extension_css = "\\n\\n".join((
        "/* extension: review-filter */\\n" + review_css.strip(),
        "/* extension: mobile-filters */\\n" + mobile_filter_css.strip(),
        "/* extension: print-manager */\\n" + print_css.strip(),
        "/* extension: back-to-top */\\n" + back_to_top_css.strip(),
    )) + "\\n"
    extension_js = "\\n\\n".join((
        "/* extension: responsive-sidebars */\\n" + responsive_sidebar_js.strip() + "\\n;",
        "/* extension: review-filter */\\n" + review_js.strip() + "\\n;",
        "/* extension: mobile-filters */\\n" + mobile_filter_js.strip() + "\\n;",
        "/* extension: search-optimization */\\n" + search_optimization_js.strip() + "\\n;",
        "/* extension: print-manager */\\n" + print_js.strip() + "\\n;",
        "/* extension: back-to-top */\\n" + back_to_top_js.strip() + "\\n;",
    )) + "\\n"
    (output / "extensions.css").write_text(extension_css, encoding="utf-8")
    (output / "extensions.js").write_text(extension_js, encoding="utf-8")

    extension_style_tag = '<link rel="stylesheet" href="./extensions.css">'
    if extension_style_tag not in text:
        text = replace_required(
            text,
            '<link rel="stylesheet" href="./app.css">',
            '<link rel="stylesheet" href="./app.css">\\n' + extension_style_tag,
            "extension stylesheet",
        )
    extension_script_tag = '<script src="./extensions.js"></script>'
    if extension_script_tag not in text:
        text = replace_required(
            text,
            '<script src="./pwa-client.js"></script>',
            '<script src="./pwa-client.js"></script>\\n' + extension_script_tag,
            "extension runtime",
        )
'''
    if "extension: responsive-sidebars" not in text:
        text, count = block_pattern.subn(replacement, text, count=1)
        if count != 1:
            raise SystemExit("Could not replace inline extension injection block")

    call_old = (
        "        app_css=app_css,\n"
        "        app_js=app_js,\n"
        "        progress_resilience_js=progress_resilience_js,"
    )
    call_new = (
        "        app_css=app_css,\n"
        "        extensions_css=extension_css,\n"
        "        app_js=app_js,\n"
        "        progress_resilience_js=progress_resilience_js,\n"
        "        extensions_js=extension_js,"
    )
    if call_new not in text:
        if call_old not in text:
            raise SystemExit("Could not pass extension bundles to offline builder")
        text = text.replace(call_old, call_new, 1)

    path.write_text(text, encoding="utf-8")


def patch_worker_and_version() -> None:
    path = ROOT / "service-worker.js"
    text = path.read_text(encoding="utf-8")
    text, count = re.subn(
        r"const APP_VERSION = '[^']+';",
        "const APP_VERSION = '2026.08.03.14';",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not update service worker version")
    if "'./extensions.css'" not in text:
        marker = "  './app.css',\n  './app.js',"
        if marker not in text:
            raise SystemExit("Could not add extension stylesheet to required assets")
        text = text.replace(marker, "  './app.css',\n  './extensions.css',\n  './app.js',", 1)
    if "'./extensions.js'" not in text:
        marker = "  './pwa-client.js',\n  OFFLINE_PAGE"
        if marker not in text:
            raise SystemExit("Could not add extension runtime to required assets")
        text = text.replace(marker, "  './pwa-client.js',\n  './extensions.js',\n  OFFLINE_PAGE", 1)
    path.write_text(text, encoding="utf-8")
    (ROOT / "version.json").write_text(
        json.dumps(
            {"version": "2026.08.03.14", "updatedAt": "2026-08-03T06:05:00+03:00"},
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


def patch_build_validator() -> None:
    path = ROOT / "scripts" / "validate_build.py"
    text = path.read_text(encoding="utf-8")

    text = text.replace(
        'for asset in ("./app.css", "./app.js", "./progress-resilience.js", "./lecture-loader.js", "./pwa-client.js"): ',
        'for asset in ("./app.css", "./extensions.css", "./app.js", "./progress-resilience.js", "./lecture-loader.js", "./pwa-client.js", "./extensions.js"): ',
        1,
    )
    text = text.replace(
        'for asset in ("./app.css", "./app.js", "./progress-resilience.js", "./lecture-loader.js", "./pwa-client.js"): ',
        'for asset in ("./app.css", "./extensions.css", "./app.js", "./progress-resilience.js", "./lecture-loader.js", "./pwa-client.js", "./extensions.js"): ',
        1,
    )

    if 'generated_extensions_css = read_text(DIST / "extensions.css")' not in text:
        marker = '    generated_css = read_text(DIST / "app.css")\n'
        if marker not in text:
            raise SystemExit("Could not add generated extension validation")
        text = text.replace(
            marker,
            marker
            + '    generated_extensions_css = read_text(DIST / "extensions.css")\n'
            + '    generated_extensions_js = read_text(DIST / "extensions.js")\n',
            1,
        )

    if "generated extension stylesheet is incomplete" not in text:
        marker = '    if generated_css != source_css or generated_progress != source_progress or generated_loader != source_loader:\n'
        if marker not in text:
            marker = '    if generated_css != source_css or generated_loader != source_loader:\n'
        if marker not in text:
            raise SystemExit("Could not add extension bundle marker validation")
        addition = (
            '    for extension_marker in (\n'
            '        "extension: review-filter", "extension: mobile-filters",\n'
            '        "extension: print-manager", "extension: back-to-top",\n'
            '    ):\n'
            '        if extension_marker not in generated_extensions_css:\n'
            '            fail(f"generated extension stylesheet is incomplete: {extension_marker}")\n'
            '    for extension_marker in (\n'
            '        "extension: responsive-sidebars", "extension: review-filter",\n'
            '        "extension: mobile-filters", "extension: search-optimization",\n'
            '        "extension: print-manager", "extension: back-to-top",\n'
            '    ):\n'
            '        if extension_marker not in generated_extensions_js:\n'
            '            fail(f"generated extension runtime is incomplete: {extension_marker}")\n'
        )
        text = text.replace(marker, addition + marker, 1)

    if 'generated index is missing external extension bundles' not in text:
        marker = '    if "const incomingLectures = [" in html:\n'
        if marker not in text:
            raise SystemExit("Could not validate external extension tags")
        text = text.replace(
            marker,
            '    if \'<link rel="stylesheet" href="./extensions.css">\' not in html or \'<script src="./extensions.js"></script>\' not in html:\n'
            '        fail("generated index is missing external extension bundles")\n'
            '    for old_inline_id in (\n'
            '        "review-filter-extension", "mobile-filter-extension",\n'
            '        "print-manager-extension", "back-to-top-extension",\n'
            '    ):\n'
            '        if f\'id="{old_inline_id}"\' in html:\n'
            '            fail(f"generated index still contains inline extension: {old_inline_id}")\n'
            + marker,
            1,
        )

    if 'standalone offline file is missing bundled extensions' not in text:
        marker = '    if \'id="progress-resilience-runtime"\' not in offline:\n'
        if marker not in text:
            raise SystemExit("Could not add offline extension validation")
        text = text.replace(
            marker,
            '    if \'id="extension-source-styles"\' not in offline or \'id="extension-source-runtime"\' not in offline:\n'
            '        fail("standalone offline file is missing bundled extensions")\n'
            '    if \'<link rel="stylesheet" href="./extensions.css">\' in offline or \'<script src="./extensions.js"></script>\' in offline:\n'
            '        fail("standalone offline file depends on external extension bundles")\n'
            + marker,
            1,
        )

    path.write_text(text, encoding="utf-8")


def replace_runtime_validator() -> None:
    path = ROOT / "scripts" / "validate_runtime_extensions.py"
    path.write_text('''#!/usr/bin/env python3
"""Validate generated runtime ordering and extension bundles."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "dist" / "index.html"
EXTENSIONS = ROOT / "dist" / "extensions.js"


def fail(message: str) -> None:
    raise SystemExit(f"RUNTIME EXTENSION VALIDATION FAILED: {message}")


def read(path: Path) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def main() -> None:
    responsive = read(ROOT / "responsive-sidebars.js")
    search = read(ROOT / "search-optimization.js")
    loader = read(ROOT / "src" / "lecture-loader.js")
    html = read(HTML)
    extensions = read(EXTENSIONS)

    for marker in ("originalGet", "compactViewport", "storage.get = function", "aria-pressed"):
        if marker not in responsive:
            fail(f"responsive sidebar source is missing: {marker}")
    for marker in ("FILTER_DELAY_MS = 160", "stopImmediatePropagation", "meq:search-applied"):
        if marker not in search:
            fail(f"search optimization source is missing: {marker}")
    for marker in (
        "CATALOG_URL", "loadSubject", "loadAll", "allLecturesLoaded",
        "MEQLectureLoader", "meq:lectures-loaded", "meqCompleteBankReady",
    ):
        if marker not in loader:
            fail(f"lazy lecture loader source is missing: {marker}")

    external_order = (
        '<script src="./app.js"></script>',
        '<script src="./progress-resilience.js"></script>',
        '<script src="./lecture-loader.js"></script>',
        '<script src="./pwa-client.js"></script>',
        '<script src="./extensions.js"></script>',
    )
    positions = []
    for marker in external_order:
        if html.count(marker) != 1:
            fail(f"generated HTML must contain exactly one {marker}")
        positions.append(html.index(marker))
    if positions != sorted(positions):
        fail("external runtime files are in the wrong order")

    extension_order = (
        "extension: responsive-sidebars",
        "extension: review-filter",
        "extension: mobile-filters",
        "extension: search-optimization",
        "extension: print-manager",
        "extension: back-to-top",
    )
    extension_positions = []
    for marker in extension_order:
        if extensions.count(marker) != 1:
            fail(f"extension bundle must contain exactly one {marker}")
        extension_positions.append(extensions.index(marker))
    if extension_positions != sorted(extension_positions):
        fail("extension bundle is in the wrong execution order")

    if 'id="lecture-extensions"' in html:
        fail("online HTML still contains the full embedded lecture batch")
    for inline_id in (
        "responsive-sidebar-extension", "review-filter-extension",
        "mobile-filter-extension", "search-optimization-extension",
        "print-manager-extension", "back-to-top-extension",
    ):
        if f'id="{inline_id}"' in html:
            fail(f"online HTML still contains inline extension {inline_id}")

    print("Validated external runtime and extension bundle ordering")


if __name__ == "__main__":
    main()
''', encoding="utf-8")


def patch_performance_budget() -> None:
    path = ROOT / "scripts" / "validate_performance_budget.py"
    text = path.read_text(encoding="utf-8")
    if '"extensions.css"' not in text:
        text = text.replace('    "app.css": 500_000,\n', '    "app.css": 500_000,\n    "extensions.css": 1_500_000,\n', 1)
    if '"extensions.js"' not in text:
        text = text.replace('    "pwa-client.js": 150_000,\n', '    "pwa-client.js": 150_000,\n    "extensions.js": 1_500_000,\n', 1)
    path.write_text(text, encoding="utf-8")


def patch_ci() -> None:
    path = ROOT / ".github" / "workflows" / "validate-bank.yml"
    replace_once(path, "          node --check dist/pwa-client.js\n", "          node --check dist/pwa-client.js\n          node --check dist/extensions.js\n", "extension syntax CI")
    replace_once(path, "          test -s dist/app.css\n", "          test -s dist/app.css\n          test -s dist/extensions.css\n", "extension stylesheet CI")
    replace_once(path, "          test -s dist/pwa-client.js\n", "          test -s dist/pwa-client.js\n          test -s dist/extensions.js\n", "extension runtime CI")


def patch_offline_test() -> None:
    path = ROOT / "tests" / "app.spec.js"
    text = path.read_text(encoding="utf-8")
    if "link[href=\"./extensions.css\"]" not in text:
        marker = "  await expect(page.locator('link[href=\"./app.css\"]')).toHaveCount(0);\n"
        if marker not in text:
            raise SystemExit("Could not extend standalone offline test")
        text = text.replace(marker, marker + "  await expect(page.locator('link[href=\"./extensions.css\"]')).toHaveCount(0);\n", 1)
    if "script[src=\"./extensions.js\"]" not in text:
        marker = "  await expect(page.locator('script[src=\"./pwa-client.js\"]')).toHaveCount(0);\n"
        if marker not in text:
            raise SystemExit("Could not extend standalone extension test")
        text = text.replace(marker, marker + "  await expect(page.locator('script[src=\"./extensions.js\"]')).toHaveCount(0);\n", 1)
    path.write_text(text, encoding="utf-8")


def patch_readme() -> None:
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    if "extensions.css" not in text:
        text = text.replace(
            "pwa-client.js\n```",
            "pwa-client.js\nextensions.css\nextensions.js\n```",
            1,
        )
    if "Generated feature extensions are bundled" not in text:
        text = text.replace(
            "The build also creates one self-contained file for direct offline use.",
            "Generated feature extensions are bundled into cacheable `extensions.css` and `extensions.js` files for the online application.\n\nThe build also creates one self-contained file for direct offline use.",
            1,
        )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    if "validate_performance_budget.py" not in (ROOT / "build.sh").read_text(encoding="utf-8"):
        raise SystemExit("Final quality integration must pass before extension externalization")
    patch_builder()
    patch_worker_and_version()
    patch_build_validator()
    replace_runtime_validator()
    patch_performance_budget()
    patch_ci()
    patch_offline_test()
    patch_readme()
    print("Externalized generated extension bundles")


if __name__ == "__main__":
    main()
