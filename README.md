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

### Neurosurgery

1. Traumatic Brain Injury

The uploaded lecture remains the exam-content authority. The application build verifies every reviewable lecture source and confirms that the generated study bank is identical to the committed JSON.

## Repository structure

```text
src/index.html                     Reviewable HTML application shell
src/app.css                        Core visual design and responsive layout
src/app.js                         Core study-bank runtime
src/pwa-client.js                  Updates, backup import/export and PWA client
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
search-optimization.js             Debounced full-bank search
tools/lecture_builder.py           JSON validation and lecture insertion
tools/build_app.py                 Production and standalone-offline builder
scripts/validate_build.py          Source and generated-site integrity checks
scripts/validate_mobile_filters.py Mobile filter integration checks
scripts/validate_runtime_extensions.py Runtime ordering checks
tests/app.spec.js                  Chromium end-to-end and offline tests
tests/accessibility.spec.js        Automated WCAG A/AA audits
service-worker.js                  Offline caching and update behavior
build.sh                           Reproducible production build entrypoint
```

`dist/` is generated output and must not be edited or treated as source.

## Online and standalone builds

The online application keeps these assets separate so they can be reviewed, cached and updated independently:

```text
index.html
app.css
app.js
pwa-client.js
```

The build also creates one self-contained file for direct offline use. It inlines the core CSS and both runtime files while keeping all study features and lecture content available:

```text
dist/offline/Medical_MEQ_Review_Bank_Offline.html
```

The browser test suite opens this file through a real `file://` URL, without a web server.

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
```

Run the locked Chromium and axe test suite:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

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
6. Confirm static validation, Chromium workflows and WCAG audits pass before merging.
7. Bump `version.json` and the matching `APP_VERSION` in `service-worker.js` for a release.

Compressed lecture chunks, browser-side decompression and JavaScript lecture payload files are not accepted. The validator rejects legacy `.js`, `.b64`, `.gz` and `.zip` files under `lectures/`.

## Release safety

The `Validate Medical MEQ Bank` workflow runs on pull requests, `main`, and development branches. It checks:

- reproducible application build from reviewable sources
- split HTML, CSS, runtime and PWA-client source integrity
- a self-contained directly openable offline file
- Python and JavaScript syntax
- lecture catalog integrity and expected item counts
- exact parity between source JSON and generated content
- unique lecture and study-item IDs
- valid subtopic references
- absence of legacy compressed lecture sources
- required PWA files and icons
- version alignment and update detection
- offline fallback and service-worker recovery
- Cloudflare 404 handling and security headers
- duplicate critical element IDs
- Rapid Recall search and reduced-motion behavior
- mobile filter expansion, active chips and reset
- responsive sidebar preferences
- debounced full-bank search
- startup recovery from malformed saved progress
- automated WCAG A/AA audits on desktop and mobile
- real Chromium workflows through Playwright

The generated `dist/` directory and Playwright diagnostics are retained as short-lived workflow artifacts for inspection.

## Privacy

The repository is private. Deployment access is configured separately from repository visibility. Student progress currently remains in browser storage unless the user explicitly exports a backup.
