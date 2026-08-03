#!/usr/bin/env python3
"""Robust one-time integration of the IndexedDB progress mirror."""

from __future__ import annotations

from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parent.parent


def replace(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Could not apply {label} in {path.relative_to(ROOT)}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_build() -> None:
    path = ROOT / "build.sh"
    replace(path, "  src/app.js\n  src/lecture-loader.js", "  src/app.js\n  src/progress-resilience.js\n  src/lecture-loader.js", "required source")
    replace(path, "node --check src/app.js\nnode --check src/lecture-loader.js", "node --check src/app.js\nnode --check src/progress-resilience.js\nnode --check src/lecture-loader.js", "source syntax")
    replace(path, "  src/app.js \\\n  src/lecture-loader.js", "  src/app.js \\\n  src/progress-resilience.js \\\n  src/lecture-loader.js", "published source")


def patch_builder() -> None:
    path = ROOT / "tools" / "build_app.py"
    operations = (
        ("    app_js: str,\n    lecture_batch_js: str,", "    app_js: str,\n    progress_resilience_js: str,\n    lecture_batch_js: str,", "offline signature"),
        (
            "    offline = replace_required(\n        offline,\n        '<script src=\"./lecture-loader.js\"></script>',",
            "    offline = replace_required(\n        offline,\n        '<script src=\"./progress-resilience.js\"></script>',\n        f'<script id=\"progress-resilience-runtime\">\\n{safe_inline_script(progress_resilience_js)}\\n</script>',\n        \"offline progress resilience runtime\",\n    )\n    offline = replace_required(\n        offline,\n        '<script src=\"./lecture-loader.js\"></script>',",
            "offline runtime",
        ),
        ("    app_js_path = output / \"app.js\"\n    lecture_loader_path = output / \"lecture-loader.js\"", "    app_js_path = output / \"app.js\"\n    progress_resilience_path = output / \"progress-resilience.js\"\n    lecture_loader_path = output / \"lecture-loader.js\"", "output path"),
        ("        app_js_path,\n        lecture_loader_path,", "        app_js_path,\n        progress_resilience_path,\n        lecture_loader_path,", "required output"),
        ("    app_js = app_js_path.read_text(encoding=\"utf-8\")\n    pwa_client_js = pwa_client_path.read_text(encoding=\"utf-8\")", "    app_js = app_js_path.read_text(encoding=\"utf-8\")\n    progress_resilience_js = progress_resilience_path.read_text(encoding=\"utf-8\")\n    pwa_client_js = pwa_client_path.read_text(encoding=\"utf-8\")", "source read"),
        ("    text = ensure_external_script_after(text, \"./app.js\", \"./lecture-loader.js\")", "    text = ensure_external_script_after(text, \"./app.js\", \"./progress-resilience.js\")\n    text = ensure_external_script_after(text, \"./progress-resilience.js\", \"./lecture-loader.js\")", "script order"),
        ("        app_js=app_js,\n        lecture_batch_js=lecture_batch_js,", "        app_js=app_js,\n        progress_resilience_js=progress_resilience_js,\n        lecture_batch_js=lecture_batch_js,", "offline argument"),
    )
    for old, new, label in operations:
        replace(path, old, new, label)


def patch_version_and_worker() -> None:
    path = ROOT / "service-worker.js"
    text = path.read_text(encoding="utf-8")
    text, count = re.subn(r"const APP_VERSION = '[^']+';", "const APP_VERSION = '2026.08.03.13';", text, count=1)
    if count != 1:
        raise SystemExit("Could not update service worker version")
    if "'./progress-resilience.js'" not in text:
        marker = "  './app.js',\n  './lecture-loader.js',"
        if marker not in text:
            raise SystemExit("Could not add progress resilience to required assets")
        text = text.replace(marker, "  './app.js',\n  './progress-resilience.js',\n  './lecture-loader.js',", 1)
    path.write_text(text, encoding="utf-8")
    (ROOT / "version.json").write_text(
        json.dumps({"version": "2026.08.03.13", "updatedAt": "2026-08-03T05:45:00+03:00"}, indent=2) + "\n",
        encoding="utf-8",
    )


def patch_runtime_validator() -> None:
    path = ROOT / "scripts" / "validate_runtime_extensions.py"
    replace(
        path,
        "        '<script src=\"./app.js\"></script>',\n        '<script src=\"./lecture-loader.js\"></script>',",
        "        '<script src=\"./app.js\"></script>',\n        '<script src=\"./progress-resilience.js\"></script>',\n        '<script src=\"./lecture-loader.js\"></script>',",
        "external runtime order",
    )


def patch_build_validator() -> None:
    path = ROOT / "scripts" / "validate_build.py"
    text = path.read_text(encoding="utf-8")

    if '"./progress-resilience.js"' not in text.split("def validate_split_sources", 1)[0]:
        text = text.replace(
            'for asset in ("./app.css", "./app.js", "./lecture-loader.js", "./pwa-client.js"):',
            'for asset in ("./app.css", "./app.js", "./progress-resilience.js", "./lecture-loader.js", "./pwa-client.js"): ',
            1,
        )

    if 'source_progress = read_text(ROOT / "src" / "progress-resilience.js")' not in text:
        marker = '    source_app = read_text(ROOT / "src" / "app.js")\n'
        if marker not in text:
            raise SystemExit("Could not add source progress validation")
        text = text.replace(marker, marker + '    source_progress = read_text(ROOT / "src" / "progress-resilience.js")\n', 1)

    if 'generated_progress = read_text(DIST / "progress-resilience.js")' not in text:
        marker = '    generated_app = read_text(DIST / "app.js")\n'
        if marker not in text:
            raise SystemExit("Could not add generated progress validation")
        text = text.replace(marker, marker + '    generated_progress = read_text(DIST / "progress-resilience.js")\n', 1)

    if 'progress resilience source differs from generated output' not in text:
        marker = '    if generated_css != source_css or generated_loader != source_loader:\n        fail("generated static source differs from reviewable source")\n'
        if marker not in text:
            raise SystemExit("Could not add progress source parity validation")
        addition = marker + (
            '    if generated_progress != source_progress:\n'
            '        fail("progress resilience source differs from generated output")\n'
            '    for progress_marker in ("MEQProgressResilience", "indexedDB", "snapshotNow", "restoreCorruptStatus"):\n'
            '        if progress_marker not in generated_progress:\n'
            '            fail(f"progress resilience runtime is missing: {progress_marker}")\n'
        )
        text = text.replace(marker, addition, 1)

    if 'generated index is missing progress resilience runtime' not in text:
        marker = '    if "const incomingLectures = [" in html:\n'
        if marker not in text:
            raise SystemExit("Could not add online progress marker validation")
        text = text.replace(
            marker,
            '    if \'<script src="./progress-resilience.js"></script>\' not in html:\n'
            '        fail("generated index is missing progress resilience runtime")\n'
            + marker,
            1,
        )

    if 'standalone offline file is missing progress resilience runtime' not in text:
        marker = '    for marker in (\n        \'id="app-source-styles"\', \'id="app-source-runtime"\','
        if marker not in text:
            raise SystemExit("Could not add offline progress marker validation")
        text = text.replace(
            marker,
            '    if \'id="progress-resilience-runtime"\' not in offline:\n'
            '        fail("standalone offline file is missing progress resilience runtime")\n'
            '    if \'<script src="./progress-resilience.js"></script>\' in offline:\n'
            '        fail("standalone offline file depends on external progress resilience")\n\n'
            + marker,
            1,
        )

    path.write_text(text, encoding="utf-8")


def patch_ci() -> None:
    path = ROOT / ".github" / "workflows" / "validate-bank.yml"
    replace(path, "          node --check src/app.js\n          node --check src/lecture-loader.js", "          node --check src/app.js\n          node --check src/progress-resilience.js\n          node --check src/lecture-loader.js", "source syntax CI")
    replace(path, "          node --check dist/app.js\n          node --check dist/lecture-loader.js", "          node --check dist/app.js\n          node --check dist/progress-resilience.js\n          node --check dist/lecture-loader.js", "generated syntax CI")
    replace(path, "          test -s dist/app.js\n          test -s dist/lecture-loader.js", "          test -s dist/app.js\n          test -s dist/progress-resilience.js\n          test -s dist/lecture-loader.js", "generated file CI")


def patch_tests() -> None:
    path = ROOT / "tests" / "app.spec.js"
    text = path.read_text(encoding="utf-8")
    if "corrupt progress is restored from the IndexedDB mirror" in text:
        return
    marker = "test('malformed saved progress cannot prevent startup'"
    index = text.find(marker)
    if index < 0:
        raise SystemExit("Could not insert progress resilience tests")
    tests = r'''test('corrupt progress is restored from the IndexedDB mirror', async ({page}) => {
  await openBank(page);
  await page.evaluate(async () => {
    await globalThis.MEQProgressResilience.ready;
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({'indexed-resilience-test': 'weak'}));
    await globalThis.MEQProgressResilience.snapshotNow();
    localStorage.setItem('medicalBankStatusV2', '{corrupt-json');
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect.poll(() => page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('medicalBankStatusV2'))['indexed-resilience-test'];
    } catch (error) {
      return null;
    }
  }), {timeout: 15_000}).toBe('weak');
  await expect(page.getByRole('heading', {name: headingName})).toBeVisible();
});

test('missing progress is treated as an intentional reset', async ({page}) => {
  await openBank(page);
  await page.evaluate(async () => {
    await globalThis.MEQProgressResilience.ready;
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({'intentional-reset-test': 'mastered'}));
    await globalThis.MEQProgressResilience.snapshotNow();
    localStorage.removeItem('medicalBankStatusV2');
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem('medicalBankStatusV2'))).toBeNull();
});

'''
    path.write_text(text[:index] + tests + text[index:], encoding="utf-8")


def patch_readme() -> None:
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    if "src/progress-resilience.js" not in text:
        text = text.replace("src/app.js                         Core study-bank runtime\n", "src/app.js                         Core study-bank runtime\nsrc/progress-resilience.js          IndexedDB mirror and corruption recovery\n", 1)
    if "IndexedDB corruption recovery" not in text:
        text = text.replace("- startup recovery from malformed saved progress\n", "- startup recovery from malformed saved progress\n- IndexedDB corruption recovery without resurrecting intentional resets\n", 1)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    if "MEQProgressResilience" not in (ROOT / "src" / "progress-resilience.js").read_text(encoding="utf-8"):
        raise SystemExit("Progress resilience source is incomplete")
    patch_build()
    patch_builder()
    patch_version_and_worker()
    patch_runtime_validator()
    patch_build_validator()
    patch_ci()
    patch_tests()
    patch_readme()
    print("Integrated progress resilience v2")


if __name__ == "__main__":
    main()
