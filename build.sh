#!/usr/bin/env bash
set -euo pipefail

PACKAGE="Medical_MEQ_Bank_PWA_GitHub_Pages.zip"
OUTPUT="dist"

if [ ! -f "$PACKAGE" ]; then
  echo "Missing $PACKAGE in repository root."
  exit 1
fi

for required in review-filter.css review-filter.js print-manager.v8.css.gz.b64 print-manager.v8.js.gz.b64 back-to-top.css back-to-top.js manifest.webmanifest service-worker.js version.json; do
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

# Inject the review-level filter, accessibility refinements and defensive
# persistence patches while keeping the deployed and standalone copies intact.
python3 - "$OUTPUT" <<'PY'
from pathlib import Path
import base64
import gzip
import json
import re
import sys

output = Path(sys.argv[1])
html = output / "index.html"
css = Path("review-filter.css").read_text(encoding="utf-8")
js = Path("review-filter.js").read_text(encoding="utf-8")
def decode_gzip_b64(path):
    encoded = Path(path).read_text(encoding="ascii").strip()
    return gzip.decompress(base64.b64decode(encoded)).decode("utf-8")

print_css = decode_gzip_b64("print-manager.v8.css.gz.b64")
print_js = decode_gzip_b64("print-manager.v8.js.gz.b64")
back_to_top_css = Path("back-to-top.css").read_text(encoding="utf-8")
back_to_top_js = Path("back-to-top.js").read_text(encoding="utf-8")
version = json.loads(Path("version.json").read_text(encoding="utf-8"))["version"]
def build_lecture_extensions():
    lecture_dir = Path("lectures")
    if not lecture_dir.is_dir():
        return ""

    lecture_files = sorted(lecture_dir.glob("*.js"))
    tbi_data_files = sorted(lecture_dir.glob("neuro-tbi-data-*.b64"))
    scrotal_data_files = sorted(lecture_dir.glob("urology-scrotal-data-*.b64"))
    legacy_tbi_chunks = [
        path for path in lecture_files
        if re.fullmatch(r"neuro-tbi-(?!99)[0-9]{2}\.js", path.name)
    ]
    excluded = {path.name for path in legacy_tbi_chunks}
    excluded.add("neuro-tbi-99.js")

    parts = [
        path.read_text(encoding="utf-8")
        for path in lecture_files
        if path.name not in excluded
    ]

    def read_b64_chunks(paths, label):
        encoded_parts = []
        for path in paths:
            chunk = "".join(path.read_text(encoding="ascii").split())
            if not chunk or re.fullmatch(r"[A-Za-z0-9+/=]+", chunk) is None:
                raise SystemExit(f"Invalid compressed {label} data chunk: {path}")
            encoded_parts.append(chunk)
        return "".join(encoded_parts)

    def decode_lecture(encoded, label, expected_id, expected_counts, chunk_count):
        if not encoded:
            return None
        try:
            compressed = base64.b64decode(encoded, validate=True)
            payload = gzip.decompress(compressed).decode("utf-8")
            lecture = json.loads(payload)
        except Exception as error:
            raise SystemExit(
                f"Could not decode compressed {label} lecture during build: {error}; "
                f"chunks={chunk_count}, base64_chars={len(encoded)}, "
                f"mod4={len(encoded) % 4}"
            ) from error

        if lecture.get("id") != expected_id:
            raise SystemExit(
                f"Decoded {label} lecture has unexpected id: {lecture.get('id')!r}"
            )
        for key, expected in expected_counts.items():
            actual = len(lecture.get(key, []))
            if actual != expected:
                raise SystemExit(
                    f"Decoded {label} lecture has {actual} {key}; expected {expected}"
                )
        return lecture

    def lecture_extension(lecture):
        lecture_json = json.dumps(
            lecture,
            ensure_ascii=False,
            separators=(",", ":"),
        ).replace("</", "<\\/")
        return (
            "(() => {\n"
            f"  const lecture = {lecture_json};\n"
            "  if (lectures.some(item => item.id === lecture.id)) return;\n"
            "  lectures.push(lecture);\n"
            "  lectures.sort((a,b) => a.subjectKey.localeCompare(b.subjectKey) || a.order - b.order);\n"
            "  populateLectureFilter();\n"
            "  updateTopicOptions();\n"
            "  render();\n"
            "  validateBank();\n"
            "  setSidebarState();\n"
            "})();"
        )

    if tbi_data_files:
        tbi_encoded = read_b64_chunks(tbi_data_files, "TBI")
    elif legacy_tbi_chunks:
        encoded_parts = []
        chunk_pattern = re.compile(r"\+\s*'([^']+)'\s*;?\s*$", re.S)
        for path in legacy_tbi_chunks:
            source = path.read_text(encoding="utf-8").strip()
            match = chunk_pattern.search(source)
            if not match:
                raise SystemExit(f"Could not parse compressed TBI chunk: {path}")
            encoded_parts.append(match.group(1))
        tbi_encoded = "".join(encoded_parts)
    else:
        tbi_encoded = ""

    tbi = decode_lecture(
        tbi_encoded,
        "TBI",
        "neurosurgery-traumatic-brain-injury",
        {"cases": 16, "coreShorts": 35, "imageQuestions": 10,
         "detailedShorts": 58, "rapid": 40},
        len(tbi_data_files) or len(legacy_tbi_chunks),
    )
    if tbi:
        parts.append(lecture_extension(tbi))

    scrotal_encoded = read_b64_chunks(scrotal_data_files, "Scrotal Swelling") if scrotal_data_files else ""
    scrotal = decode_lecture(
        scrotal_encoded,
        "Scrotal Swelling",
        "urology-scrotal-swelling",
        {"cases": 15, "coreShorts": 35, "imageQuestions": 10,
         "detailedShorts": 58, "rapid": 40},
        len(scrotal_data_files),
    )
    if scrotal:
        parts.append(lecture_extension(scrotal))

    return "\n\n".join(part for part in parts if part.strip())

lecture_js = build_lecture_extensions()
text = html.read_text(encoding="utf-8")

# Keep exported progress metadata aligned with the deployed PWA version.
text, count = re.subn(
    r"const APP_VERSION = '[^']+';",
    f"const APP_VERSION = '{version}';",
    text,
    count=1,
)
if count != 1:
    raise SystemExit("Could not update APP_VERSION")

# A malformed or manually edited localStorage value must not prevent the bank
# from opening. Invalid status data falls back to an empty state.
old_state = "const state=JSON.parse(storage.get('medicalBankStatusV2')||'{}');"
new_state = "const state=(()=>{try{const value=JSON.parse(storage.get('medicalBankStatusV2')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(e){return {}}})();"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
elif new_state not in text:
    raise SystemExit("Could not apply safe progress-state parser")

# Restore means a true replacement, not a merge with stale keys from another
# device or a newer session.
old_restore = "Object.entries(data.storage).forEach(([k,v]) => { if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });"
new_restore = "[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).filter(k=>k&&k.startsWith('medicalBank')).forEach(k=>localStorage.removeItem(k)); Object.entries(data.storage).forEach(([k,v]) => { if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });"
if old_restore in text:
    text = text.replace(old_restore, new_restore, 1)
elif new_restore not in text:
    raise SystemExit("Could not apply clean progress restore")

# Improve live announcements without changing the visible layout.
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

print_style_tag = f'<style id="print-manager-styles">\n{print_css}\n</style>'
if 'id="print-manager-styles"' in text:
    text = re.sub(
        r'<style id="print-manager-styles">.*?</style>',
        lambda _: print_style_tag,
        text,
        count=1,
        flags=re.S,
    )
else:
    text = text.replace('</head>', print_style_tag + '\n</head>', 1)

print_script_tag = f'<script id="print-manager-extension">\n{print_js}\n</script>'
if 'id="print-manager-extension"' in text:
    text = re.sub(
        r'<script id="print-manager-extension">.*?</script>',
        lambda _: print_script_tag,
        text,
        count=1,
        flags=re.S,
    )
else:
    text = text.replace('</body>', print_script_tag + '\n</body>', 1)

back_to_top_style_tag = f'<style id="back-to-top-styles">\n{back_to_top_css}\n</style>'
if 'id="back-to-top-styles"' in text:
    text = re.sub(
        r'<style id="back-to-top-styles">.*?</style>',
        lambda _: back_to_top_style_tag,
        text,
        count=1,
        flags=re.S,
    )
else:
    text = text.replace('</head>', back_to_top_style_tag + '\n</head>', 1)

back_to_top_script_tag = f'<script id="back-to-top-extension">\n{back_to_top_js}\n</script>'
if 'id="back-to-top-extension"' in text:
    text = re.sub(
        r'<script id="back-to-top-extension">.*?</script>',
        lambda _: back_to_top_script_tag,
        text,
        count=1,
        flags=re.S,
    )
else:
    if '</body>' not in text:
        raise SystemExit("Could not inject back-to-top script")
    before_body_close, after_body_close = text.rsplit('</body>', 1)
    text = before_body_close + back_to_top_script_tag + '\n</body>' + after_body_close

html.write_text(text, encoding="utf-8")
offline = output / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
offline.parent.mkdir(parents=True, exist_ok=True)
offline_text = text.replace('<head>', '<head>\n<base href="../">', 1)
offline.write_text(offline_text, encoding="utf-8")
PY

# Use the latest PWA metadata and hardened service worker from the repository.
install -m 0644 manifest.webmanifest service-worker.js version.json "$OUTPUT/"

# The source package contains a GitHub Pages workflow that is not needed
# inside the deployed website.
rm -rf "$OUTPUT/.github"

# Avoid exposing repository documentation as a site page.
rm -f "$OUTPUT/README.md"

echo "Medical MEQ Bank prepared in $OUTPUT"
