#!/usr/bin/env python3
"""One-time final integration for performance, layout and complete-bank actions."""

from __future__ import annotations

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parent.parent


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Could not apply {label} in {path.relative_to(ROOT)}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def integrate_progress_if_needed() -> None:
    builder = (ROOT / "tools" / "build_app.py").read_text(encoding="utf-8")
    if "progress-resilience.js" in builder:
        return
    script = ROOT / "tools" / "integrate_progress_resilience.py"
    if not script.is_file():
        raise SystemExit("Progress resilience was not integrated and its integration script is missing")
    subprocess.run(["python3", str(script)], cwd=ROOT, check=True)


def patch_build() -> None:
    path = ROOT / "build.sh"
    replace_once(
        path,
        "  scripts/validate_runtime_extensions.py\n)",
        "  scripts/validate_runtime_extensions.py\n  scripts/validate_performance_budget.py\n)",
        "performance validator requirement",
    )
    replace_once(
        path,
        "  scripts/validate_runtime_extensions.py\n\nnode --check",
        "  scripts/validate_runtime_extensions.py \\\n  scripts/validate_performance_budget.py\n\nnode --check",
        "performance validator compilation",
    )


def patch_offline_base() -> None:
    path = ROOT / "tools" / "build_app.py"
    text = path.read_text(encoding="utf-8")
    marker = "    offline = html\n"
    replacement = (
        "    offline = html\n"
        "    if '<base href=\"../\">' not in offline:\n"
        "        offline = replace_required(\n"
        "            offline,\n"
        "            '<head>',\n"
        "            '<head>\\n<base href=\"../\">',\n"
        "            \"offline base URL\",\n"
        "        )\n"
    )
    if replacement not in text:
        if marker not in text:
            raise SystemExit("Could not add the standalone offline base URL")
        text = text.replace(marker, replacement, 1)
    path.write_text(text, encoding="utf-8")


def patch_loader() -> None:
    path = ROOT / "src" / "lecture-loader.js"
    text = path.read_text(encoding="utf-8")
    if "const loadAll = async" not in text:
        marker = "  subjectSelector?.addEventListener('change', () => {\n"
        addition = r'''  const loadAll = async () => {
    const catalog = await loadCatalog();
    const subjectKeys = [...new Set(catalog.lectures.map(entry => entry.subjectKey))];
    await Promise.all(subjectKeys.map(subjectKey => loadSubject(subjectKey)));
    refreshApplication();
    return [...loadedLectureIds];
  };

  const allLecturesLoaded = async () => {
    const catalog = await loadCatalog();
    return catalog.lectures.every(entry => loadedLectureIds.has(entry.id));
  };

  // Printing and PDF generation must never silently omit an unloaded subject.
  // Capture likely print/PDF controls, load the complete bank once, then replay
  // the original activation with a one-shot bypass marker.
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('button, a');
    if (!trigger || trigger.dataset.meqCompleteBankReady === '1') return;
    const label = `${trigger.id} ${trigger.className} ${trigger.textContent || ''} ${trigger.getAttribute('aria-label') || ''}`.toLowerCase();
    if (!/(^|\s|[-_])(print|pdf)(\s|$|[-_])/.test(label)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    trigger.setAttribute('aria-busy', 'true');
    loadAll().then(() => {
      trigger.dataset.meqCompleteBankReady = '1';
      trigger.removeAttribute('aria-busy');
      trigger.click();
      window.setTimeout(() => delete trigger.dataset.meqCompleteBankReady, 0);
    }).catch(error => {
      trigger.removeAttribute('aria-busy');
      showLoadError(activeSubject, error);
    });
  }, true);

'''
        if marker not in text:
            raise SystemExit("Could not add loadAll to lecture loader")
        text = text.replace(marker, addition + marker, 1)

    old_api = r'''    loadSubject,
    loadCatalog,
    isLoaded: lectureId => loadedLectureIds.has(lectureId),'''
    new_api = r'''    loadSubject,
    loadAll,
    loadCatalog,
    allLecturesLoaded,
    isLoaded: lectureId => loadedLectureIds.has(lectureId),'''
    if new_api not in text:
        if old_api not in text:
            raise SystemExit("Could not expose complete-bank loader API")
        text = text.replace(old_api, new_api, 1)
    path.write_text(text, encoding="utf-8")


def patch_runtime_validation() -> None:
    path = ROOT / "scripts" / "validate_runtime_extensions.py"
    replace_once(
        path,
        '            "MEQLectureLoader", "meq:lectures-loaded", "aria-busy",\n',
        '            "MEQLectureLoader", "meq:lectures-loaded", "aria-busy",\n            "loadAll", "allLecturesLoaded", "meqCompleteBankReady",\n',
        "complete-bank loader validation",
    )


def patch_build_validation() -> None:
    path = ROOT / "scripts" / "validate_build.py"
    replace_once(
        path,
        '    for marker in ("CATALOG_URL", "loadSubject", "MEQLectureLoader", "meq:lectures-loaded"):\n',
        '    for marker in (\n        "CATALOG_URL", "loadSubject", "loadAll", "allLecturesLoaded",\n        "MEQLectureLoader", "meq:lectures-loaded", "meqCompleteBankReady",\n    ):\n',
        "complete-bank loader build validation",
    )
    replace_once(
        path,
        "        'id=\"app-source-styles\"', 'id=\"app-source-runtime\"',\n",
        "        '<base href=\"../\">', 'id=\"app-source-styles\"', 'id=\"app-source-runtime\"',\n",
        "offline base validation",
    )


def patch_ci() -> None:
    path = ROOT / ".github" / "workflows" / "validate-bank.yml"
    replace_once(
        path,
        "          python3 scripts/validate_runtime_extensions.py\n",
        "          python3 scripts/validate_runtime_extensions.py\n          python3 scripts/validate_performance_budget.py\n",
        "performance budget execution",
    )
    replace_once(
        path,
        "          node --check tests/accessibility.spec.js\n",
        "          node --check tests/accessibility.spec.js\n          node --check tests/performance.spec.js\n          node --check tests/layout.spec.js\n",
        "quality test syntax checks",
    )


def patch_tests() -> None:
    path = ROOT / "tests" / "app.spec.js"
    text = path.read_text(encoding="utf-8")
    if "print and PDF actions load the complete bank before continuing" not in text:
        marker = "test('All study items search includes matching Rapid Recall cards'"
        index = text.find(marker)
        if index < 0:
            raise SystemExit("Could not insert complete-bank action test")
        test_source = r'''test('print and PDF actions load the complete bank before continuing', async ({page}) => {
  await openBank(page);
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(5);

  const loadedCount = await page.evaluate(() => new Promise(resolve => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Print study bank PDF';
    button.addEventListener('click', () => {
      resolve(globalThis.MEQLectureLoader.loadedLectureIds.size);
      button.remove();
    });
    document.body.appendChild(button);
    button.click();
  }));

  expect(loadedCount).toBe(6);
  expect(await page.evaluate(() => globalThis.MEQLectureLoader.allLecturesLoaded())).toBe(true);
});

'''
        text = text[:index] + test_source + text[index:]
    path.write_text(text, encoding="utf-8")


def patch_readme() -> None:
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    if "scripts/validate_performance_budget.py" not in text:
        text = text.replace(
            "scripts/validate_runtime_extensions.py Runtime ordering checks\n",
            "scripts/validate_runtime_extensions.py Runtime ordering checks\nscripts/validate_performance_budget.py Production size budgets\n",
            1,
        )
    if "subject-level lazy lecture loading" not in text:
        text = text.replace(
            "The online application keeps these assets separate so they can be reviewed, cached and updated independently:\n",
            "The online application uses subject-level lazy lecture loading: it downloads the active subject first and loads another subject only when selected. Printing and PDF actions automatically load the complete bank before continuing.\n\nThe online application keeps these assets separate so they can be reviewed, cached and updated independently:\n",
            1,
        )
    if "performance and responsive-layout regression budgets" not in text:
        text = text.replace(
            "- real Chromium workflows through Playwright\n",
            "- real Chromium workflows through Playwright\n- performance and responsive-layout regression budgets\n",
            1,
        )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    integrate_progress_if_needed()
    patch_build()
    patch_offline_base()
    patch_loader()
    patch_runtime_validation()
    patch_build_validation()
    patch_ci()
    patch_tests()
    patch_readme()
    print("Integrated final performance and complete-bank quality gates")


if __name__ == "__main__":
    main()
