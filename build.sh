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

if [ -d assets ]; then
  rm -rf "$OUTPUT/assets"
  cp -R assets "$OUTPUT/assets"
fi

python3 - "$OUTPUT" <<'PY'
from pathlib import Path
import json
import re
import sys

output = Path(sys.argv[1])
html = output / "index.html"
css = Path("review-filter.css").read_text(encoding="utf-8")
js = Path("review-filter.js").read_text(encoding="utf-8")
version = json.loads(Path("version.json").read_text(encoding="utf-8"))["version"]
lecture_files = sorted(Path("lectures").glob("*.js")) if Path("lectures").is_dir() else []
lecture_js = "\n\n".join(path.read_text(encoding="utf-8") for path in lecture_files)
text = html.read_text(encoding="utf-8")

text, count = re.subn(
    r"const APP_VERSION = '[^']+';",
    f"const APP_VERSION = '{version}';",
    text,
    count=1,
)
if count != 1:
    raise SystemExit("Could not update APP_VERSION")

old_state = "const state=JSON.parse(storage.get('medicalBankStatusV2')||'{}');"
new_state = "const state=(()=>{try{const value=JSON.parse(storage.get('medicalBankStatusV2')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(e){return {}}})();"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
elif new_state not in text:
    raise SystemExit("Could not apply safe progress-state parser")

old_restore = "Object.entries(data.storage).forEach(([k,v]) => { if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });"
new_restore = "[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).filter(k=>k&&k.startsWith('medicalBank')).forEach(k=>localStorage.removeItem(k)); Object.entries(data.storage).forEach(([k,v]) => { if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });"
if old_restore in text:
    text = text.replace(old_restore, new_restore, 1)
elif new_restore not in text:
    raise SystemExit("Could not apply clean progress restore")

text = text.replace('<div class="empty-message" id="emptyMessage">', '<div class="empty-message" id="emptyMessage" aria-live="polite">', 1)
text = text.replace('<div class="toast" id="appToast">', '<div class="toast" id="appToast" role="status" aria-live="polite">', 1)

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
else:
    text = re.sub(
        r'<style id="review-filter-styles">.*?</style>',
        lambda _: f'<style id="review-filter-styles">\n{css}\n</style>',
        text,
        count=1,
        flags=re.S,
    )
    text = re.sub(
        r'<script id="review-filter-extension">.*?</script>',
        lambda _: f'<script id="review-filter-extension">\n{js}\n</script>',
        text,
        count=1,
        flags=re.S,
    )

if lecture_js:
    lecture_tag = f'<script id="lecture-extensions">\n{lecture_js}\n</script>'
    if 'id="lecture-extensions"' in text:
        text = re.sub(
            r'<script id="lecture-extensions">.*?</script>',
            lambda _: lecture_tag,
            text,
            count=1,
            flags=re.S,
        )
    elif '<script id="review-filter-extension">' in text:
        text = text.replace('<script id="review-filter-extension">', lecture_tag + '\n<script id="review-filter-extension">', 1)
    else:
        text = text.replace('</body>', lecture_tag + '\n</body>', 1)

html.write_text(text, encoding="utf-8")
offline = output / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
offline.parent.mkdir(parents=True, exist_ok=True)
offline_text = text.replace('./assets/urological-emergencies/', '../assets/urological-emergencies/')
offline.write_text(offline_text, encoding="utf-8")
PY

install -m 0644 manifest.webmanifest service-worker.js version.json "$OUTPUT/"
rm -rf "$OUTPUT/.github"
rm -f "$OUTPUT/README.md"

echo "Medical MEQ Bank prepared in $OUTPUT"
