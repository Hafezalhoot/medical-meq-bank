# Medical MEQ Bank Development Contract

This file is the operational guide for any developer or coding agent changing this repository.

## Product boundary

The application is an offline-first medical revision bank. The committed lecture PDFs or reviewed lecture JSON are the exam-content authority. Do not update, modernize, reinterpret, or supplement medical content from external guidelines unless the task explicitly requests that change.

Never invent missing medical answers, marking schemes, classifications, drugs, doses, procedures, indications, contraindications, exam traps, or memory prompts. Optional fields that are absent from the reviewed source must remain empty and the interface must hide empty optional panels.

## Curriculum hierarchy

The permanent hierarchy is **Course → Subject → Lecture → Subtopic → Study item**.

- A course is an independently declared content pack, such as Surgery or Internal Medicine.
- Subjects belong to exactly one course manifest.
- Lecture IDs are globally unique across all courses.
- Existing lecture and study-item IDs are immutable after publication because progress keys depend on them.
- A new course must not alter the visibility, counts, order, or saved progress of existing courses.

## Source of truth

- `courses/catalog.json`: course registry and default course.
- `courses/<course>/course.json`: independent course manifest, subject list and lecture-catalog pointer.
- `courses/*.schema.json`: course-registry and content-pack contracts.
- `src/`: reviewable application shell and core runtime.
- `lectures/catalog.json`: the Surgery pack's current lecture registry and expected counts.
- `lectures/data/*.json`: reviewable Surgery lecture content. Future course packs may point to their own lecture catalogs and data roots.
- `lectures/*.schema.json`: declared lecture contracts.
- Root extension files such as `mobile-filters.js` and `review-filter.js`: injected into the online and standalone builds.
- `dist/`: generated output only. Never edit it manually.
- `version.json`, `service-worker.js`, and `src/pwa-client.js`: release versions must agree.

## Change routing

Use the smallest relevant validation loop while developing, then run the full quality gate before merging.

- Course/subject configuration change: course-pack validator, legacy baseline, loader regressions and full quality gate.
- Lecture/content or image change: build, lecture validators, image validator, Chromium content regressions.
- HTML/CSS/mobile layout change: build, repository audit, layout, mobile-filter and accessibility tests.
- Search/filter/runtime change: build, syntax checks, functional and performance tests.
- Progress storage/import change: progress-resilience validator plus backup, rollback and IndexedDB tests.
- Print change: print-manager source validation plus `tests/print.spec.js`.
- PWA/service-worker change: static service-worker audit, no-404 installation test and offline reload test.
- Dependency/workflow change: repository-hygiene validation and the complete GitHub Actions workflow.

## Required local commands

```bash
bash build.sh
python3 scripts/validate_course_packs.py
python3 scripts/validate_build.py
python3 scripts/validate_mobile_filters.py
python3 scripts/validate_runtime_extensions.py
python3 scripts/validate_progress_resilience.py
python3 scripts/audit_repository.py
python3 scripts/validate_repository_hygiene.py
npm ci --no-audit --no-fund
npm run test:e2e
npx playwright test --config=playwright.webkit.config.js
```

The final merge gate is the `Validate Medical MEQ Bank` workflow. A change is not ready when only one browser or only the static build has passed.

## Repository hygiene

- Do not commit `node_modules`, generated reports, caches, environment files, OS metadata, or Python bytecode.
- Install JavaScript dependencies through `npm ci` from the committed lockfile.
- Do not add binary or compressed lecture payload formats that bypass review.
- Keep changes focused. Separate medical-content work, infrastructure work, and unrelated interface work into different commits or pull-request sections.
- Prefer one reviewed commit set over repeated speculative commits. Diagnose the root cause before changing tests.

## Test reliability

Most functional, layout, accessibility, performance and print tests block service workers so PWA lifecycle reloads cannot create false failures. Only the dedicated service-worker and offline tests should depend on registration, activation, caching or controllers.

Do not weaken or delete a failing test merely to make CI green. Update a test only when the accepted product behavior changed, and add a replacement assertion for the new behavior.

Every new course or lecture must pass the legacy baseline test proving that previously published lecture IDs, counts and progress keys are unchanged.

## Release safety

Before merging:

1. Confirm all generated/source parity and course-pack validators pass.
2. Confirm the legacy course baseline and global lecture-ID uniqueness checks pass.
3. Confirm every internal resource exists and the standalone HTML has no local dependencies.
4. Confirm Chromium, WCAG, layout, performance, print, backup and offline tests pass.
5. Confirm Safari desktop and iPhone WebKit smoke tests pass.
6. Confirm the pull request contains no unrelated generated files or unsupported medical-content changes.
7. Merge only the exact head commit that passed the final workflow.

No finite automated suite can prove that software has zero future defects. The release standard for this repository is: no known reproducible defects, no failing required checks, and no unresolved high-risk review findings.
