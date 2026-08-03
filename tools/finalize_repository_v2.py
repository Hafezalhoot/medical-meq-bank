#!/usr/bin/env python3
"""Deterministically finish all repository migrations from any partial state."""

from __future__ import annotations

from pathlib import Path
import json
import re
import subprocess


ROOT = Path(__file__).resolve().parent.parent


def run_script(relative: str) -> None:
    path = ROOT / relative
    if not path.is_file():
        raise SystemExit(f"Required migration script is missing: {relative}")
    subprocess.run(["python3", str(path)], cwd=ROOT, check=True)


def ensure_foundation() -> None:
    builder = (ROOT / "tools" / "build_app.py").read_text(encoding="utf-8")
    if "progress-resilience.js" not in builder:
        run_script("tools/integrate_progress_resilience_v2.py")

    build = (ROOT / "build.sh").read_text(encoding="utf-8")
    if "validate_performance_budget.py" not in build:
        run_script("tools/integrate_final_quality.py")

    builder = (ROOT / "tools" / "build_app.py").read_text(encoding="utf-8")
    if "extensions.css" not in builder:
        run_script("tools/externalize_extensions.py")

    if not (ROOT / "src" / "print-manager.js").is_file():
        run_script("tools/migrate_print_manager_source.py")


def fix_external_extension_validation() -> None:
    validator = ROOT / "scripts" / "validate_build.py"
    text = validator.read_text(encoding="utf-8")
    for literal in (
        "        'id=\"review-filter-extension\"',",
        " 'id=\"review-filter-extension\"',",
        "        'id=\"mobile-filter-extension\"',",
        " 'id=\"mobile-filter-extension\"',",
        "        'id=\"print-manager-extension\"',",
        " 'id=\"print-manager-extension\"',",
        "        'id=\"back-to-top-extension\"',",
        " 'id=\"back-to-top-extension\"',",
    ):
        text = text.replace(literal, "")
    validator.write_text(text, encoding="utf-8")

    mobile_validator = ROOT / "scripts" / "validate_mobile_filters.py"
    mobile_validator.write_text('''#!/usr/bin/env python3
"""Validate mobile filter source and generated external bundles."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise SystemExit(f"MOBILE FILTER VALIDATION FAILED: {message}")


def read(path: Path) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require(source: str, markers: tuple[str, ...], label: str) -> None:
    for marker in markers:
        if marker not in source:
            fail(f"{label} is missing: {marker}")


def main() -> None:
    source_js = read(ROOT / "mobile-filters.js")
    source_css = read(ROOT / "mobile-filters.css")
    generated_js = read(ROOT / "dist" / "extensions.js")
    generated_css = read(ROOT / "dist" / "extensions.css")
    html = read(ROOT / "dist" / "index.html")

    require(source_js, (
        "mobileFiltersToggle", "activeFilterChips", "resetFiltersBtn",
        "aria-expanded", "syncFilterSummary", "applyFilters",
    ), "mobile filter source")
    require(source_css, (
        ".mobile-filter-toggle", ".active-filter-chips", ".filter-chip",
        "@media(max-width:700px)",
    ), "mobile filter styles")
    require(generated_js, (
        "extension: mobile-filters", "mobileFiltersToggle",
        "activeFilterChips", "resetFiltersBtn",
    ), "generated extension runtime")
    require(generated_css, (
        "extension: mobile-filters", ".mobile-filter-toggle",
        ".active-filter-chips", ".filter-chip",
    ), "generated extension stylesheet")

    if '<script src="./extensions.js"></script>' not in html:
        fail("generated HTML does not load extensions.js")
    if '<link rel="stylesheet" href="./extensions.css">' not in html:
        fail("generated HTML does not load extensions.css")
    if 'id="mobile-filter-extension"' in html:
        fail("mobile filters remain inline in generated HTML")

    print("Validated external mobile filter bundles")


if __name__ == "__main__":
    main()
''', encoding="utf-8")


def fix_layout_test() -> None:
    path = ROOT / "tests" / "layout.spec.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "#studyToolbar input:not([hidden]), #studyToolbar select:not([hidden]), #studyToolbar button:not([hidden])",
        ".toolbar input:not([hidden]), .toolbar select:not([hidden]), .toolbar button:not([hidden])",
    )
    marker = "  for (const rectangle of rectangles) {\n"
    addition = "  expect(rectangles.length).toBeGreaterThan(4);\n\n"
    if addition not in text:
        if marker not in text:
            raise SystemExit("Could not strengthen mobile layout regression test")
        text = text.replace(marker, addition + marker, 1)
    path.write_text(text, encoding="utf-8")


def integrate_webkit() -> None:
    package_path = ROOT / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    package.setdefault("scripts", {})["test:webkit"] = "playwright test --config=playwright.webkit.config.js"
    package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

    test_path = ROOT / "tests" / "webkit-smoke.spec.js"
    text = test_path.read_text(encoding="utf-8")
    desktop_old = "test('WebKit opens the active subject and loads another subject on demand', async ({page}) => {"
    desktop_new = desktop_old[:-4] + ", testInfo) => {\n  test.skip(!testInfo.project.name.includes('desktop'), 'Desktop WebKit scenario');"
    if "Desktop WebKit scenario" not in text:
        if desktop_old not in text:
            raise SystemExit("Could not scope desktop WebKit scenario")
        text = text.replace(desktop_old, desktop_new, 1)

    mobile_old = "test('iPhone WebKit can expand, search and reset mobile filters', async ({page}) => {"
    mobile_new = mobile_old[:-4] + ", testInfo) => {\n  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile WebKit scenario');"
    if "Mobile WebKit scenario" not in text:
        if mobile_old not in text:
            raise SystemExit("Could not scope mobile WebKit scenario")
        text = text.replace(mobile_old, mobile_new, 1)
    test_path.write_text(text, encoding="utf-8")

    workflow = ROOT / ".github" / "workflows" / "validate-bank.yml"
    content = workflow.read_text(encoding="utf-8")
    if "tests/webkit-smoke.spec.js" not in content:
        content = content.replace(
            "          node --check tests/layout.spec.js\n",
            "          node --check tests/layout.spec.js\n          node --check tests/webkit-smoke.spec.js\n          node --check playwright.webkit.config.js\n",
            1,
        )
    content = content.replace(
        "run: npx playwright install --with-deps chromium",
        "run: npx playwright install --with-deps chromium webkit",
        1,
    )
    if "Run Safari and iPhone WebKit smoke tests" not in content:
        content = content.replace(
            "      - name: Run browser and accessibility tests\n        run: npm run test:e2e\n",
            "      - name: Run Chromium browser and accessibility tests\n        run: npm run test:e2e\n\n      - name: Run Safari and iPhone WebKit smoke tests\n        run: npm run test:webkit\n",
            1,
        )
        content = content.replace(
            "            playwright-report\n            test-results\n",
            "            playwright-report\n            playwright-report-webkit\n            test-results\n",
            1,
        )
    workflow.write_text(content, encoding="utf-8")


def finalize_version_and_hygiene_validation() -> None:
    worker = ROOT / "service-worker.js"
    text = worker.read_text(encoding="utf-8")
    text, count = re.subn(
        r"const APP_VERSION = '[^']+';",
        "const APP_VERSION = '2026.08.03.16';",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not update final service-worker version")
    worker.write_text(text, encoding="utf-8")
    (ROOT / "version.json").write_text(
        json.dumps(
            {"version": "2026.08.03.16", "updatedAt": "2026-08-03T06:35:00+03:00"},
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    validator = ROOT / "scripts" / "validate_build.py"
    content = validator.read_text(encoding="utf-8")
    if "def validate_repository_hygiene" not in content:
        marker = "def main() -> int:\n"
        addition = '''def validate_repository_hygiene() -> None:
    forbidden = (
        ROOT / "Medical_MEQ_Bank_PWA_GitHub_Pages.zip",
        ROOT / "print-manager.v8.css.gz.b64",
        ROOT / "print-manager.v8.js.gz.b64",
    )
    remaining = [path.name for path in forbidden if path.exists()]
    if remaining:
        fail("legacy root build artifacts remain: " + ", ".join(remaining))


'''
        if marker not in content:
            raise SystemExit("Could not add repository hygiene validator")
        content = content.replace(marker, addition + marker, 1)
        content = content.replace(
            "    version = validate_metadata()\n",
            "    validate_repository_hygiene()\n    version = validate_metadata()\n",
            1,
        )
    validator.write_text(content, encoding="utf-8")


def update_readme() -> None:
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    if "npm run test:webkit" not in text:
        text = text.replace("npm run test:e2e\n```", "npm run test:e2e\nnpm run test:webkit\n```", 1)
    if "Safari and iPhone WebKit smoke tests" not in text:
        text = text.replace("- real Chromium workflows through Playwright\n", "- real Chromium workflows through Playwright\n- Safari and iPhone WebKit smoke tests\n", 1)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    ensure_foundation()
    fix_external_extension_validation()
    fix_layout_test()
    integrate_webkit()
    finalize_version_and_hygiene_validation()
    update_readme()
    print("Repository finalization v2 applied")


if __name__ == "__main__":
    main()
