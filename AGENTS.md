# Medical MEQ Bank Development Contract

This file is the operational guide for any developer or coding agent changing this repository.

## Product boundary

The application is an offline-first medical revision bank. The committed lecture PDFs or reviewed lecture JSON are the exam-content authority. Do not update, modernize, reinterpret, or supplement medical content from external guidelines unless the task explicitly requests that change.

Never invent missing medical answers, marking schemes, classifications, drugs, doses, procedures, indications, contraindications, exam traps, or memory prompts. Optional fields that are absent from the reviewed source must remain empty.

## Source of truth

- `src/`: reviewable application shell and core runtime.
- `lectures/catalog.json`: published lecture registry and expected counts.
- `lectures/data/*.json`: reviewable lecture content.
- `lectures/*.schema.json`: declared content contracts.
- Root extension files such as `mobile-filters.js` and `review-filter.js`: injected into the online and standalone builds. `src/print-manager.*` is the only reviewable Print Center source; do not create root-level duplicates.
- `dist/`: generated output only. Never edit it manually.
- `version.json`, `service-worker.js`, and `src/pwa-client.js`: release versions must agree.

## Change routing

Use the smallest relevant validation loop while developing, then run the full quality gate before merging.

- Lecture/content or image change: build, lecture validators, image validator, Chromium content regressions.
- HTML/CSS/mobile layout change: build, repository audit, layout, mobile-filter and accessibility tests.
- Search/filter/runtime change: build, syntax checks, functional and performance tests.
- Progress storage/import change: progress-resilience validator plus backup, rollback and IndexedDB tests.
- Print change: print-manager source validation plus `tests/print.spec.js`.
- PWA/service-worker change: static service-worker audit, no-404 installation test and offline reload test.
- Dependency/workflow change: repository-hygiene validation and the complete GitHub Actions workflow.

## Required local commands

Static build + complete source/data/repository gate:

```bash
npm run quality:static
```

Browser suites:

```bash
npm ci --no-audit --no-fund
npm run test:e2e
npm run test:webkit
```

For a new lecture, use `tools/add_lecture.py` in dry-run mode first and then `--write`; do not hand-maintain multiple registries for an ordinary content addition. See `CONTENT_AUTHORING.md`.

The final merge gate is the `Validate Medical MEQ Bank` workflow. A change is not ready when only one browser or only the static build has passed. If GitHub Actions cannot provision a job, keep the PR draft and follow `ACTIONS_RECOVERY.md`; do not weaken the workflow to bypass the blocker.

## Repository hygiene

- Do not commit `node_modules`, generated reports, caches, environment files, OS metadata, or Python bytecode.
- Install JavaScript dependencies through `npm ci` from the committed lockfile.
- Do not add binary or compressed lecture payload formats that bypass review.
- Keep changes focused. Separate medical-content work, infrastructure work, and unrelated interface work into different pull requests.
- Prefer one reviewed commit set over repeated speculative commits. Diagnose the root cause before changing tests.

## Test reliability

Most functional, layout, accessibility, performance and print tests block service workers so PWA lifecycle reloads cannot create false failures. Only the dedicated service-worker and offline tests should depend on registration, activation, caching or controllers.

Do not weaken or delete a failing test merely to make CI green. Update a test only when the accepted product behavior changed, and add a replacement assertion for the new behavior.

## Release safety

Before merging:

1. Confirm all generated and source parity validators pass.
2. Confirm every internal resource exists and the standalone HTML has no local dependencies.
3. Confirm Chromium, WCAG, layout, performance, print, backup and offline tests pass.
4. Confirm Safari desktop and iPhone WebKit smoke tests pass.
5. Confirm the pull request contains no unrelated generated files or medical-content changes.
6. Merge only the exact head commit that passed the final workflow.

No finite automated suite can prove that software has zero future defects. The release standard for this repository is: no known reproducible defects, no failing required checks, and no unresolved high-risk review findings.
