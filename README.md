# Medical MEQ Review Bank

Private source repository for the Medical MEQ & Short Question Review Bank.

The project is an offline-first Progressive Web App containing lecture-based MEQ cases, high-yield short questions, image/spot questions, detailed practice, Rapid Recall, saved progress, dark mode, printing, and lecture/subtopic navigation.

## Current lecture content

### Urology

1. Congenital Anomalies
2. BPH & Prostate Carcinoma
3. Urological Emergencies
4. Urinary Tract Infection
5. Scrotal Swelling
6. Bladder Cancer
7. Urolithiasis

### Neurosurgery

1. Traumatic Brain Injury

The uploaded lecture remains the exam-content authority. The application build verifies every reviewable lecture source and confirms that the published and standalone study banks are identical to the committed JSON.

## Repository structure

```text
AGENTS.md                           Development, testing and release contract
src/index.html                     Reviewable HTML application shell
src/app.css                        Core visual design and responsive layout
src/app.js                         Core study-bank runtime
src/progress-resilience.js         IndexedDB mirror for corrupted progress recovery
src/lecture-loader.js              Subject-level lazy lecture loading
src/pwa-client.js                  Updates, backup import/export and PWA client
src/print-manager.css              Reviewable print and PDF styles
src/print-manager.js               Reviewable print and PDF runtime
lectures/catalog.json              Published lecture registry and expected counts
lectures/data/*.json               Reviewable medical lecture content
lectures/lecture.schema.json       Lecture data contract
lectures/catalog.schema.json       Catalog data contract
icons/                             Installable PWA icons
review-filter.js                   Filtering, Rapid Recall and accessibility behavior
review-filter.css                  Filter interface styling
responsive-sidebars.js             Responsive navigation defaults
mobile-filters.js                  Compact mobile filters, chips and reset behavior
mobile-filters.css                 Mobile filter styling
search-optimization.js             Debounced text search
tools/lecture_builder.py           JSON validation and offline lecture insertion
tools/build_app.py                 Production and standalone-offline builder
tools/finalize_offline.py          Removes PWA-only links from the standalone file
scripts/validate_build.py          Source and generated-site integrity checks
scripts/audit_repository.py        Final HTML, resource, manifest and worker audit
scripts/validate_repository_hygiene.py  Tracked dependency/cache artifact guard
scripts/validate_mobile_filters.py Mobile filter integration checks
scripts/validate_runtime_extensions.py Runtime ordering checks
scripts/validate_progress_resilience.py IndexedDB integration checks
tests/app.spec.js                  Chromium functional, storage and offline tests
tests/accessibility.spec.js        Automated WCAG A/AA audits
tests/layout.spec.js               Responsive layout regression tests
tests/mobile-filters.spec.js       Mobile active-filter chip regressions
tests/performance.spec.js          Request and interaction performance budgets
tests/print.spec.js                Print/PDF document generation tests
tests/service-worker-assets.spec.js Service-worker installation and 404 guard
tests/webkit-smoke.spec.js         Safari and iPhone WebKit workflows
service-worker.js                  Offline caching and update behavior
build.sh                           Reproducible production build entrypoint
```

`dist/` is generated output and must not be edited or treated as source. Dependencies are restored from `package-lock.json` with `npm ci`; `node_modules/`, browser reports, caches and bytecode are not committed.

## Online and standalone builds

The online application keeps the shell and core runtimes separate so they can be reviewed, cached and updated independently. Lecture JSON is loaded by subject, while the service worker pre-caches the catalog and all lecture files for reliable offline use.

```text
index.html
app.css
app.js
progress-resilience.js
lecture-loader.js
pwa-client.js
lectures/catalog.json
lectures/data/*.json
```

The build also creates one self-contained file for direct offline use. It embeds the application runtimes and the complete validated lecture bank and contains no local file dependencies:

```text
dist/offline/Medical_MEQ_Review_Bank_Offline.html
```

The Chromium test suite opens this file through a real `file://` URL without a web server.

## Build locally

Requirements:

- Bash
- Python 3
- Node.js 22 for browser and accessibility tests

Build and validate the generated application:

```bash
bash build.sh
python3 scripts/validate_build.py
python3 scripts/validate_mobile_filters.py
python3 scripts/validate_runtime_extensions.py
python3 scripts/validate_progress_resilience.py
python3 scripts/audit_repository.py
python3 scripts/validate_repository_hygiene.py
```

Run the locked Chromium and axe suite:

```bash
npm ci --no-audit --no-fund
npx playwright install chromium
npm run test:e2e
```

Run Safari desktop and iPhone WebKit smoke tests:

```bash
npx playwright install webkit
npx playwright test --config=playwright.webkit.config.js
```

GitHub Actions uses the exact Playwright container version matching `@playwright/test`, so CI does not repeatedly install browser and operating-system packages.

Serve the generated online output so the service worker can run:

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`.

## Adding a lecture

1. Create one readable JSON file under `lectures/data/` using `lectures/lecture.schema.json`.
2. Add one entry to `lectures/catalog.json` containing the same lecture ID, its JSON path, and the expected counts for:
   - `cases`
   - `coreShorts`
   - `imageQuestions`
   - `detailedShorts`
   - `rapid`
3. Keep every study-item ID unique within the lecture.
4. Reference only subtopic IDs declared in that lecture.
5. Run the full build and validators.
6. Confirm static validation, Chromium, WebKit and WCAG checks pass before merging.
7. Bump `version.json` and the matching `APP_VERSION` in `service-worker.js` and `src/pwa-client.js` for a release.

Compressed lecture chunks, browser-side decompression and JavaScript lecture payload files are not accepted. The validator rejects legacy `.js`, `.b64`, `.gz` and `.zip` files under `lectures/`.

## Release safety

The `Validate Medical MEQ Bank` workflow runs once for each pull request and once after merge to `main`. Superseded runs for the same pull request are cancelled. It checks:

- reproducible application build from reviewable sources
- split HTML, CSS and JavaScript runtime integrity
- subject-level online lazy loading
- a complete directly openable standalone offline file
- Python and JavaScript syntax
- lecture catalog integrity and expected item counts
- exact parity between source JSON, published JSON and offline content
- unique lecture and study-item IDs
- valid subtopic references
- absence of legacy compressed lecture sources
- repository hygiene and absence of committed dependencies/reports/caches
- duplicate HTML IDs and broken ID references
- local HTML, manifest and service-worker resource existence
- required PWA files and icons
- version alignment and update detection
- offline fallback and service-worker recovery without internal 404s
- Cloudflare 404 handling and security headers
- Rapid Recall search and reduced-motion behavior
- mobile filter expansion, single/multiple active chips and reset
- responsive sidebar preferences
- debounced text search
- startup recovery from malformed saved progress
- IndexedDB restoration only for corrupted progress, not deliberate resets
- print/PDF center generation, settings and pagination
- responsive layout and interaction budgets
- automated WCAG A/AA audits on desktop and mobile
- Chromium, Safari desktop and iPhone WebKit workflows

Generated `dist/` output and browser diagnostics are retained as short-lived workflow artifacts for inspection. Weekly Dependabot checks maintain npm and GitHub Actions dependencies through reviewable pull requests.

## Privacy

The repository is private. Deployment access is configured separately from repository visibility. Student progress remains on the device in local browser storage with an IndexedDB recovery mirror, unless the user explicitly exports a backup.
