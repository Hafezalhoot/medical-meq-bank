#!/usr/bin/env bash
set -euo pipefail

PACKAGE="Medical_MEQ_Bank_PWA_GitHub_Pages.zip"
OUTPUT="dist"

if [ ! -f "$PACKAGE" ]; then
  echo "Missing $PACKAGE in repository root."
  exit 1
fi

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"
unzip -q "$PACKAGE" -d "$OUTPUT"

# The source package contains a GitHub Pages workflow that is not needed
# inside the deployed website.
rm -rf "$OUTPUT/.github"

# Avoid exposing repository documentation as a site page.
rm -f "$OUTPUT/README.md"

echo "Medical MEQ Bank prepared in $OUTPUT"
