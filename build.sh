#!/usr/bin/env bash
set -euo pipefail

PACKAGE="Medical_MEQ_Bank_PWA_GitHub_Pages.zip"
OUTPUT="dist"

if [ ! -f "$PACKAGE" ]; then
  echo "Missing $PACKAGE in repository root."
  exit 1
fi

for required in review-filter.css review-filter.js manifest.webmanifest service-worker.js version.json; do
  if [ ! -f "$required" ]; then
    echo "Missing $required in repository root."
    exit 1
  fi
done

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"
unzip -q "$PACKAGE" -d "$OUTPUT"

# Inject the review-level filter as an inline extension so the main site and
# the standalone offline copy stay self-contained.
python3 - "$OUTPUT" <<'PY'
from pathlib import Path
import sys

output = Path(sys.argv[1])
html = output / "index.html"
css = Path("review-filter.css").read_text(encoding="utf-8")
js = Path("review-filter.js").read_text(encoding="utf-8")
text = html.read_text(encoding="utf-8")

if 'id="review-filter-extension"' not in text:
    text = text.replace(
        "</head>",
        f'<style id="review-filter-styles">\n{css}\n</style>\n</head>',
        1,
    )
    text = text.replace(
        "</body>",
        f'<script id="review-filter-extension">\n{js}\n</script>\n</body>',
        1,
    )

html.write_text(text, encoding="utf-8")
offline = output / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
offline.parent.mkdir(parents=True, exist_ok=True)
offline.write_text(text, encoding="utf-8")
PY

# Use the latest PWA metadata and service worker from the repository root.
install -m 0644 manifest.webmanifest service-worker.js version.json "$OUTPUT/"

# The source package contains a GitHub Pages workflow that is not needed
# inside the deployed website.
rm -rf "$OUTPUT/.github"

# Avoid exposing repository documentation as a site page.
rm -f "$OUTPUT/README.md"

echo "Medical MEQ Bank prepared in $OUTPUT"
