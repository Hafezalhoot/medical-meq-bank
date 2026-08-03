#!/usr/bin/env bash
set -euo pipefail

OUTPUT="dist"

required_files=(
  src/index.html
  icons/icon-192.png
  icons/icon-512.png
  icons/apple-touch-icon.png
  review-filter.css
  review-filter.js
  print-manager.v8.css.gz.b64
  print-manager.v8.js.gz.b64
  back-to-top.css
  back-to-top.js
  manifest.webmanifest
  service-worker.js
  version.json
  tools/build_app.py
  tools/lecture_builder.py
)

for required in "${required_files[@]}"; do
  if [ ! -f "$required" ]; then
    echo "Missing $required in repository root."
    exit 1
  fi
done

python3 -m py_compile tools/build_app.py tools/lecture_builder.py

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"
install -m 0644 src/index.html "$OUTPUT/index.html"
cp -R icons "$OUTPUT/icons"

if [ -d assets ]; then
  cp -R assets "$OUTPUT/assets"
fi

python3 tools/build_app.py "$OUTPUT"

# Publish current PWA metadata and the hardened service worker.
install -m 0644 manifest.webmanifest service-worker.js version.json "$OUTPUT/"

echo "Medical MEQ Bank prepared in $OUTPUT from src/index.html"
