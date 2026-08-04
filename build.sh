#!/usr/bin/env bash
set -euo pipefail

OUTPUT="dist"

required_files=(
  src/index.html
  src/app.css
  src/app.js
  src/progress-resilience.js
  src/lecture-loader.js
  src/pwa-client.js
  icons/icon-192.png
  icons/icon-512.png
  icons/apple-touch-icon.png
  404.html
  _headers
  review-filter.css
  review-filter.js
  responsive-sidebars.js
  mobile-filters.css
  mobile-filters.js
  search-optimization.js
  src/print-manager.css
  src/print-manager.js
  back-to-top.css
  back-to-top.js
  manifest.webmanifest
  service-worker.js
  version.json
  lectures/catalog.json
  lectures/catalog.schema.json
  lectures/lecture.schema.json
  lectures/payload-fixes/urology-urolithiasis.part05.1
  lectures/payload-fixes/urology-urolithiasis.part05.2
  lectures/payload-fixes/urology-urolithiasis.part05.3
  tools/build_app.py
  tools/finalize_offline.py
  tools/lecture_builder.py
  tools/materialize_verified_lectures_v2.py
  tools/materialize_verified_lectures_v3.py
  scripts/audit_repository.py
  scripts/validate_build.py
  scripts/validate_mobile_filters.py
  scripts/validate_runtime_extensions.py
  scripts/validate_progress_resilience.py
  scripts/validate_lecture_images.py
)

for required in "${required_files[@]}"; do
  if [ ! -f "$required" ]; then
    echo "Missing $required in repository root."
    exit 1
  fi
done

if ! find lectures/data -maxdepth 1 -type f -name '*.json' -print -quit | grep -q .; then
  echo "No reviewable lecture JSON files were found in lectures/data."
  exit 1
fi

python3 -m py_compile \
  tools/build_app.py \
  tools/finalize_offline.py \
  tools/lecture_builder.py \
  tools/materialize_verified_lectures_v2.py \
  tools/materialize_verified_lectures_v3.py \
  scripts/audit_repository.py \
  scripts/validate_build.py \
  scripts/validate_mobile_filters.py \
  scripts/validate_runtime_extensions.py \
  scripts/validate_progress_resilience.py \
  scripts/validate_lecture_images.py

python3 tools/materialize_verified_lectures_v3.py
python3 scripts/validate_lecture_images.py

node --check src/app.js
node --check src/progress-resilience.js
node --check src/lecture-loader.js
node --check src/pwa-client.js
node --check src/print-manager.js

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT/lectures/data"

install -m 0644 \
  src/index.html \
  src/app.css \
  src/app.js \
  src/progress-resilience.js \
  src/lecture-loader.js \
  src/pwa-client.js \
  "$OUTPUT/"
install -m 0644 404.html _headers service-worker.js "$OUTPUT/"
install -m 0644 lectures/catalog.json "$OUTPUT/lectures/"
cp lectures/data/*.json "$OUTPUT/lectures/data/"
cp -R icons "$OUTPUT/icons"

if [ -d assets ]; then
  cp -R assets "$OUTPUT/assets"
fi

python3 tools/build_app.py "$OUTPUT"

# Publish metadata after the builder has patched the service worker.
install -m 0644 manifest.webmanifest version.json "$OUTPUT/"
python3 tools/finalize_offline.py

echo "Medical MEQ Bank prepared in $OUTPUT from split reviewable source files"
