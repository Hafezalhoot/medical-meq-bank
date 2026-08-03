#!/usr/bin/env python3
"""One-time integration of the IndexedDB progress resilience runtime."""

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


def require_marker(path: Path, marker: str) -> None:
    if marker not in path.read_text(encoding="utf-8"):
        raise SystemExit(f"Missing marker {marker!r} in {path.relative_to(ROOT)}")


def patch_build_script() -> None:
    path = ROOT / "build.sh"
    replace_once(path, "  src/app.js\n  src/lecture-loader.js", "  src/app.js\n  src/progress-resilience.js\n  src/lecture-loader.js", "progress source requirement")
    replace_once(path, "node --check src/app.js\nnode --check src/lecture-loader.js", "node --check src/app.js\nnode --check src/progress-resilience.js\nnode --check src/lecture-loader.js", "progress syntax check")
    replace_once(path, "  src/app.js \\\n  src/lecture-loader.js", "  src/app.js \\\n  src/progress-resilience.js \\\n  src/lecture-loader.js", "progress source publication")


def patch_builder() -> None:
    path = ROOT / "tools" / "build_app.py"
    text = path.read_text(encoding="utf-8")

    substitutions = (
        (
            "    app_js: str,\n    lecture_batch_js: str,",
            "    app_js: str,\n    progress_resilience_js: str,\n    lecture_batch_js: str,",
            "offline builder signature",
        ),
        (
            "    offline = replace_required(\n        offline,\n        '<script src=\"./lecture-loader.js\"></script>',",
            "    offline = replace_required(\n        offline,\n        '<script src=\"./progress-resilience.js\"></script>',\n        f'<script id=\"progress-resilience-runtime\">\\n{safe_inline_script(progress_resilience_js)}\\n</script>',\n        \"offline progress resilience runtime\",\n    )\n    offline = replace_required(\n        offline,\n        '<script src=\"./lecture-loader.js\"></script>',",
            "offline progress runtime",
        ),
        (
            "    app_js_path = output / \"app.js\"\n    lecture_loader_path = output / \"lecture-loader.js\"",
            "    app_js_path = output / \"app.js\"\n    progress_resilience_path = output / \"progress-resilience.js\"\n    lecture_loader_path = output / \"lecture-loader.js\"",
            "progress output path",
        ),
        (
            "        app_js_path,\n        lecture_loader_path,",
            "        app_js_path,\n        progress_resilience_path,\n        lecture_loader_path,",
            "progress required output",
        ),
        (
            "    app_js = app_js_path.read_text(encoding=\"utf-8\")\n    pwa_client_js = pwa_client_path.read_text(encoding=\"utf-8\")",
            "    app_js = app_js_path.read_text(encoding=\"utf-8\")\n    progress_resilience_js = progress_resilience_path.read_text(encoding=\"utf-8\")\n    pwa_client_js = pwa_client_path.read_text(encoding=\"utf-8\")",
            "progress source read",
        ),
        (
            "    text = ensure_external_script_after(text, \"./app.js\", \"./lecture-loader.js\")",
            "    text = ensure_external_script_after(text, \"./app.js\", \"./progress-resilience.js\")\n    text = ensure_external_script_after(text, \"./progress-resilience.js\", \"./lecture-loader.js\")",
            "progress script order",
        ),
        (
            "        app_js=app_js,\n        lecture_batch_js=lecture_batch_js,",
            "        app_js=app_js,\n        progress_resilience_js=progress_resilience_js,\n        lecture_batch_js=lecture_batch_js,",
            "offline progress argument",
        ),
    )

    for old, new, label in substitutions:
        if new in text:
            continue
        if old not in text:
            raise SystemExit(f"Could not apply {label} in tools/build_app.py")
        text = text.replace(old, new, 1)

    path.write_text(text, encoding="utf-8")


def patch_service_worker_and_version() -> None:
    worker_path = ROOT / "service-worker.js"
    worker = worker_path.read_text(encoding="utf-8")
    worker, count = re.subn(
        r"const APP_VERSION = '[^']+';",
        "const APP_VERSION = '2026.08.03.13';",
        worker,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not update service-worker version")
    if "'./progress-resilience.js'" not in worker:
        marker = "  './app.js',\n  './lecture-loader.js',"
        if marker not in worker:
            raise SystemExit("Could not add progress resilience to service-worker assets")
        worker = worker.replace(
            marker,
            "  './app.js',\n  './progress-resilience.js',\n  './lecture-loader.js',",
            1,
        )
    worker_path.write_text(worker, encoding="utf-8")

    version_path = ROOT / "version.json"
    version_path.write_text(
        json.dumps(
            {
                "version": "2026.08.03.13",
                "updatedAt": "2026-08-03T05:45:00+03:00",
            },
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


def patch_runtime_validator() -> None:
    path = ROOT / "scripts" / "validate_runtime_extensions.py"
    replace_once(
        path,
        "        '<script src=\"./app.js\"></script>',\n        '<script src=\"./lecture-loader.js\"></script>',",
        "        '<script src=\"./app.js\"></script>',\n        '<script src=\"./progress-resilience.js\"></script>',\n        '<script src=\"./lecture-loader.js\"></script>',",
        "runtime external order",
    )
    replace_once(
        path,
        "        fail(\"core application, lecture loader and PWA client are in the wrong order\")",
        "        fail(\"core application, progress resilience, lecture loader and PWA client are in the wrong order\")",
        "runtime order message",
    )


def patch_build_validator() -> None:
    path = ROOT / "scripts" / "validate_build.py"
    text = path.read_text(encoding="utf-8")
    replacements = (
        (
            "    for asset in (\"./app.css\", \"./app.js\", \"./lecture-loader.js\", \"./pwa-client.js\"):",
            "    for asset in (\"./app.css\", \"./app.js\", \"./progress-resilience.js\", \"./lecture-loader.js\", \"./pwa-client.js\"):",
            "service-worker progress asset validation",
        ),
        (
            "    source_app = read_text(ROOT / \"src\" / \"app.js\")\n    source_loader = read_text(ROOT / \"src\" / \"lecture-loader.js\")",
            "    source_app = read_text(ROOT / \"src\" / \"app.js\")\n    source_progress = read_text(ROOT / \"src\" / \"progress-resilience.js\")\n    source_loader = read_text(ROOT / \"src\" / \"lecture-loader.js\")",
            "source progress read",
        ),
        (
            "    if len(source_loader) < 3_000 or len(source_pwa) < 1_000:",
            "    if len(source_progress) < 5_000 or len(source_loader) < 3_000 or len(source_pwa) < 1_000:",
            "progress source size",
        ),
        (
            "    generated_app = read_text(DIST / \"app.js\")\n    generated_loader = read_text(DIST / \"lecture-loader.js\")",
            "    generated_app = read_text(DIST / \"app.js\")\n    generated_progress = read_text(DIST / \"progress-resilience.js\")\n    generated_loader = read_text(DIST / \"lecture-loader.js\")",
            "generated progress read",
        ),
        (
            "    if generated_css != source_css or generated_loader != source_loader:\n        fail(\"generated static source differs from reviewable source\")",
            "    if generated_css != source_css or generated_progress != source_progress or generated_loader != source_loader:\n        fail(\"generated static source differs from reviewable source\")\n    for marker in (\"MEQProgressResilience\", \"indexedDB\", \"snapshotNow\", \"restoreCorruptStatus\"):\n        if marker not in generated_progress:\n            fail(f\"progress resilience runtime is missing: {marker}\")",
            "progress source parity",
        ),
        (
            "        '<script src=\"./app.js\"></script>', '<script src=\"./lecture-loader.js\"></script>',",
            "        '<script src=\"./app.js\"></script>', '<script src=\"./progress-resilience.js\"></script>',\n        '<script src=\"./lecture-loader.js\"></script>',",
            "online progress marker",
        ),
        (
            "        'id=\"app-source-styles\"', 'id=\"app-source-runtime\"',\n        'id=\"lecture-extensions\"',",
            "        'id=\"app-source-styles\"', 'id=\"app-source-runtime\"',\n        'id=\"progress-resilience-runtime\"', 'id=\"lecture-extensions\"',",
            "offline progress marker",
        ),
        (
            "        '<link rel=\"stylesheet\" href=\"./app.css\">', '<script src=\"./app.js\"></script>',\n        '<script src=\"./lecture-loader.js\"></script>',",
            "        '<link rel=\"stylesheet\" href=\"./app.css\">', '<script src=\"./app.js\"></script>',\n        '<script src=\"./progress-resilience.js\"></script>', '<script src=\"./lecture-loader.js\"></script>',",
            "offline external progress prohibition",
        ),
    )
    for old, new, label in replacements:
        if new in text:
            continue
        if old not in text:
            raise SystemExit(f"Could not apply {label} in scripts/validate_build.py")
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")


def patch_ci() -> None:
    path = ROOT / ".github" / "workflows" / "validate-bank.yml"
    replace_once(
        path,
        "          node --check src/app.js\n          node --check src/lecture-loader.js",
        "          node --check src/app.js\n          node --check src/progress-resilience.js\n          node --check src/lecture-loader.js",
        "source progress syntax",
    )
    replace_once(
        path,
        "          node --check dist/app.js\n          node --check dist/lecture-loader.js",
        "          node --check dist/app.js\n          node --check dist/progress-resilience.js\n          node --check dist/lecture-loader.js",
        "generated progress syntax",
    )
    replace_once(
        path,
        "          test -s dist/app.js\n          test -s dist/lecture-loader.js",
        "          test -s dist/app.js\n          test -s dist/progress-resilience.js\n          test -s dist/lecture-loader.js",
        "generated progress file",
    )


def patch_tests() -> None:
    path = ROOT / "tests" / "app.spec.js"
    text = path.read_text(encoding="utf-8")
    marker = "test('malformed saved progress cannot prevent startup'"
    if "corrupt progress is restored from the IndexedDB mirror" not in text:
        index = text.find(marker)
        if index < 0:
            raise SystemExit("Could not find progress test insertion point")
        tests = r'''test('corrupt progress is restored from the IndexedDB mirror', async ({page}) => {
  await openBank(page);

  await page.evaluate(async () => {
    await globalThis.MEQProgressResilience.ready;
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({
      'indexed-resilience-test': 'weak'
    }));
    await globalThis.MEQProgressResilience.snapshotNow();
    localStorage.setItem('medicalBankStatusV2', '{corrupt-json');
  });

  await page.reload({waitUntil: 'domcontentloaded'});
  await expect.poll(async () => page.evaluate(() => {
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
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({
      'intentional-reset-test': 'mastered'
    }));
    await globalThis.MEQProgressResilience.snapshotNow();
    localStorage.removeItem('medicalBankStatusV2');
  });

  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem('medicalBankStatusV2'))).toBeNull();
});

'''
        text = text[:index] + tests + text[index:]
    path.write_text(text, encoding="utf-8")


def patch_readme() -> None:
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    if "src/progress-resilience.js" not in text:
        text = text.replace(
            "src/app.js                         Core study-bank runtime\n",
            "src/app.js                         Core study-bank runtime\nsrc/progress-resilience.js          IndexedDB mirror and corruption recovery\n",
            1,
        )
    if "IndexedDB corruption recovery" not in text:
        text = text.replace(
            "- startup recovery from malformed saved progress\n",
            "- startup recovery from malformed saved progress\n- IndexedDB corruption recovery without resurrecting intentional resets\n",
            1,
        )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    require_marker(ROOT / "src" / "progress-resilience.js", "MEQProgressResilience")
    patch_build_script()
    patch_builder()
    patch_service_worker_and_version()
    patch_runtime_validator()
    patch_build_validator()
    patch_ci()
    patch_tests()
    patch_readme()
    print("Integrated IndexedDB progress resilience")


if __name__ == "__main__":
    main()
