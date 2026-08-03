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
src/index.html                     Reviewable application shell
lectures/catalog.json              Published lecture registry and expected counts
lectures/data/*.json               Reviewable medical lecture content
lectures/lecture.schema.json       Lecture data contract
lectures/catalog.schema.json       Catalog data contract
icons/                             Installable PWA icons
review-filter.js                   Filtering, Rapid Recall and accessibility behavior
review-filter.css                  Filter interface styling
mobile-filters.js                  Compact mobile filters, chips and reset behavior
mobile-filters.css                 Mobile filter styling
tools/lecture_builder.py           JSON validation and batch insertion
tools/build_app.py                 HTML patching and extension injection
scripts/validate_build.py          Source and generated-site integrity checks
scripts/validate_mobile_filters.py Mobile filter integration checks
tests/app.spec.js                  Chromium end-to-end smoke tests
service-worker.js                  Offline caching and update behavior
build.sh                           Reproducible production build entrypoint
```

`dist/` is generated output and must not be edited or treated as source.

## Build locally

Requirements:

- Bash
- Python 3

Run:

```bash
bash build.sh
python3 scripts/validate_build.py
python3 scripts/validate_mobile_filters.py
```

Serve the generated output through a local HTTP server so the service worker can run:

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`.

The generated standalone copy is available at:

```text
dist/offline/Medical_MEQ_Review_Bank_Offline.html
```

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
6. Confirm both static validation and Chromium browser tests pass before merging.
7. Bump `version.json` and the matching `APP_VERSION` in `service-worker.js` for a release.

Compressed lecture chunks, browser-side decompression and JavaScript lecture payload files are not accepted. The validator rejects legacy `.js`, `.b64`, `.gz` and `.zip` files under `lectures/`.

## Release safety

The `Validate Medical MEQ Bank` workflow runs on pull requests, `main`, and development branches. It checks:

- reproducible application build from reviewable sources
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
- startup recovery from malformed saved progress
- real Chromium workflows through Playwright

The generated `dist/` directory and Playwright diagnostics are retained as short-lived workflow artifacts for inspection.

## Privacy

The repository is private. Deployment access is configured separately from repository visibility. Student progress currently remains in browser storage unless the user explicitly exports a backup.
