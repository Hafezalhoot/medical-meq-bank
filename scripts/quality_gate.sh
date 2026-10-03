#!/usr/bin/env bash
set -euo pipefail

required_generated=(
  package-lock.json
  dist/index.html
  dist/app.css
  dist/app.js
  dist/course-packs.css
  dist/course-packs.js
  dist/progress-resilience.js
  dist/lecture-loader.js
  dist/pwa-client.js
  dist/print-manager.js
  dist/courses/catalog.json
  dist/lectures/catalog.json
  dist/lectures/data/urology-renal-tumors.json
  dist/404.html
  dist/_headers
  dist/offline/Medical_MEQ_Review_Bank_Offline.html
  dist/manifest.webmanifest
  dist/service-worker.js
  dist/version.json
)

for required in "${required_generated[@]}"; do
  test -s "$required" || {
    echo "STATIC QUALITY GATE FAILED: missing or empty $required"
    exit 1
  }
done

python3 scripts/validate_build.py
python3 scripts/validate_mobile_filters.py
python3 scripts/validate_runtime_extensions.py
python3 scripts/validate_progress_resilience.py
python3 scripts/validate_course_packs.py
python3 scripts/validate_lecture_images.py
python3 scripts/audit_repository.py
python3 scripts/validate_performance_budget.py

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  python3 scripts/validate_repository_hygiene.py
else
  echo "Repository hygiene check skipped: no Git worktree is available in this build environment."
fi

javascript_files=(
  src/app.js
  src/course-packs.template.js
  src/progress-resilience.js
  src/lecture-loader.js
  src/pwa-client.js
  src/print-manager.js
  service-worker.js
  review-filter.js
  responsive-sidebars.js
  mobile-filters.js
  search-optimization.js
  back-to-top.js
  dist/app.js
  dist/course-packs.js
  dist/progress-resilience.js
  dist/lecture-loader.js
  dist/pwa-client.js
  dist/print-manager.js
  dist/service-worker.js
  tests/app.spec.js
  tests/accessibility.spec.js
  tests/course-packs.spec.js
  tests/hardening.spec.js
  tests/layout.spec.js
  tests/mobile-filters.spec.js
  tests/performance.spec.js
  tests/print.spec.js
  tests/service-worker-assets.spec.js
  tests/webkit-smoke.spec.js
  playwright.config.js
  playwright.webkit.config.js
)

for source in "${javascript_files[@]}"; do
  node --check "$source"
done

echo "Static quality gate passed: generated output, data integrity, repository audit, performance budgets and JavaScript syntax are valid."
