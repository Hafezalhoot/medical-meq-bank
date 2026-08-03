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

The uploaded lecture remains the exam-content authority. Build validation verifies the expected question counts for compressed lecture payloads before they can be published.

## Repository structure

```text
src/index.html                 Reviewable application shell
lectures/                      Lecture payload sources
icons/                         Installable PWA icons
review-filter.js               Filtering, Rapid Recall and accessibility behavior
review-filter.css              Filter interface styling
tools/lecture_builder.py       Lecture decoding, validation and batch insertion
tools/build_app.py             HTML patching and extension injection
scripts/validate_build.py      Generated-site integrity checks
service-worker.js              Offline caching and update behavior
build.sh                       Reproducible production build entrypoint
```

`dist/` is generated output and should not be treated as source.

## Build locally

Requirements:

- Bash
- Python 3
- `unzip` is no longer required for normal builds

Run:

```bash
bash build.sh
python3 scripts/validate_build.py
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

1. Add the lecture source under `lectures/`.
2. Register compressed legacy payloads in `tools/lecture_builder.py` with the expected lecture ID and item counts.
3. Run the complete build and validator.
4. Confirm the GitHub Actions workflow passes before merging.
5. Bump both `version.json` and `service-worker.js` together for a release.

Browser-side gzip decompression is not used for validated compressed lectures. Payloads are decoded during the build and inserted in one batch to avoid compatibility failures and repeated startup renders.

## Release safety

The `Validate Medical MEQ Bank` workflow runs on pull requests, `main`, and development branches. It checks:

- reproducible application build
- Python and JavaScript syntax
- required PWA files and icons
- version alignment
- offline fallback
- lecture IDs and expected item counts
- duplicate critical element IDs
- leaked compressed runtime loaders
- Rapid Recall search and reduced-motion safeguards

The generated `dist/` directory is retained as a short-lived workflow artifact for inspection.

## Privacy

The repository is private. Deployment access is configured separately from repository visibility. Student progress currently remains in browser storage unless the user explicitly exports a backup.
