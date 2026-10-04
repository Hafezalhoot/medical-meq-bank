# Medical MEQ Review Bank

Public source repository for the Medical MEQ Review Bank.

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
8. Renal Tumors

### Neurosurgery

1. Traumatic Brain Injury

The uploaded lecture remains the exam-content authority. The application build verifies every reviewable lecture source and confirms that the published and standalone study banks are identical to the committed JSON.

## Repository structure

```text
AGENTS.md                           Development, testing and release contract
src/index.html                     Reviewable HTML application shell
src/app.css                        Core visual design and responsive layout
src/app.js                         Core study-bank runtime
src/progress-resilience.js         Primary per-item IndexedDB progress storage, migration and recovery
src/lecture-loader.js              Metadata-first, lecture-level catalog loading
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
search-optimization.js             Course-scoped search over unloaded lecture indexes
tools/lecture_builder.py           Shared lecture validation and publishing helpers
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

The online application keeps the shell and core runtimes separate so they can be reviewed, cached and updated independently. Lecture delivery is metadata-first and lecture-level; service-worker installation caches the shell/catalog while lecture payloads are cached on use or by explicit offline download, so corpus growth does not increase mandatory first-load cost linearly.

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

The build also keeps a **bounded legacy** self-contained export for direct `file://` use. It embeds the complete validated lecture bank and has no local file dependencies:

```text
dist/offline/Medical_MEQ_Review_Bank_Offline.html
```

This legacy export has an 8 MB hard ceiling so it cannot become an unbounded delivery path as the bank grows. The scalable offline path is the installed PWA: the shell/catalog are installed once, then learners explicitly save individual lectures or an entire subject for offline use. The Chromium suite still opens the legacy file directly to preserve backward compatibility.

## Build locally

Requirements:

- Bash
- Python 3
- Node.js 22 for browser and accessibility tests

Build and run the complete static quality gate:

```bash
npm run quality:static
```

This command runs the reproducible build and the single canonical `scripts/quality_gate.sh`: generated-file checks, data/build validators, repository/CSP audit, performance budgets, repository hygiene (when Git metadata is available), and JavaScript syntax checks.

Run the locked Chromium and axe suite:

```bash
npm ci --no-audit --no-fund
npx playwright install chromium
npm run test:e2e
```

Run Safari desktop and iPhone WebKit smoke tests:

```bash
npx playwright install webkit
npm run test:webkit
```

GitHub Actions uses the exact Playwright container version matching `@playwright/test`, so CI does not repeatedly install browser and operating-system packages.

Serve the generated online output so the service worker can run:

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`.

## Adding a lecture

Use the canonical authoring tool; do not hand-edit multiple registries for a normal lecture addition.

Dry-run validation:

```bash
python3 tools/add_lecture.py /path/to/new-lecture.json --course surgery
```

If the dry run is correct, register it:

```bash
python3 tools/add_lecture.py /path/to/new-lecture.json --course surgery --write
```

Then run the static release gate:

```bash
npm run quality:static
```

The authoring command validates the lecture structure, item IDs, subtopics, course/subject membership and duplicate ordering, derives expected counts, writes the canonical reviewable source, updates the catalog, and updates the Surgery compatibility baseline when applicable.

See [CONTENT_AUTHORING.md](./CONTENT_AUTHORING.md) for the complete content-ingestion contract.

Compressed lecture chunks and repair transports are legacy compatibility inputs only for already-migrated materialized lectures. Do not create new lecture-specific materializers, browser-side decompression paths, or ad-hoc payload files for new content.

## Release safety

The `Validate Medical MEQ Bank` workflow is the intended quality gate for pull requests and merges to `main`. Superseded runs for the same pull request are cancelled. If GitHub Actions is unavailable at the platform/control-plane level, releases must remain unpromoted until the same validation matrix can be executed successfully. It checks:

- reproducible application build from reviewable sources
- split HTML, CSS and JavaScript runtime integrity
- lecture-level online lazy loading and metadata-first subject navigation
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

The source repository is public, so tracked code and medical content can be viewed or cloned by anyone. Deployment access is configured separately from repository visibility. Student progress remains on the device in per-item IndexedDB records; localStorage is reserved for small UI preferences and a legacy fallback if IndexedDB is unavailable. Progress leaves the device only when the user explicitly exports a backup.


## Modernization program

The active scalability and reliability work is tracked in [PROJECT_PROGRESS.md](./PROJECT_PROGRESS.md). That file is the source of truth for completed work, current blockers, remaining phases, acceptance criteria, and release decisions.

Deployment is currently based on Cloudflare Workers static assets; see [DEPLOYMENT.md](./DEPLOYMENT.md).


## Project operations

- [Scalability modernization and live progress](PROJECT_PROGRESS.md)
- [Canonical lecture authoring workflow](CONTENT_AUTHORING.md)
- [Release, versioning, cache and rollback policy](RELEASE_PROCESS.md)
- [GitHub Actions incident record and recovery runbook](ACTIONS_RECOVERY.md)
- [UI design system](UI_DESIGN_SYSTEM.md)
- [Full UI/UX audit](UI_UX_AUDIT.md)
- [Cloudflare deployment guidance](DEPLOYMENT.md)
