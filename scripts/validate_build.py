#!/usr/bin/env python3
"""Validate reviewable source files and the generated Medical MEQ Bank."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
LECTURE_DIR = ROOT / "lectures"
COUNT_KEYS = ("cases", "coreShorts", "imageQuestions", "detailedShorts", "rapid")


def fail(message: str) -> None:
    raise SystemExit(f"BUILD VALIDATION FAILED: {message}")


def require_file(path: Path, minimum_size: int = 1) -> None:
    if not path.is_file():
        fail(f"missing file: {path.relative_to(ROOT)}")
    if path.stat().st_size < minimum_size:
        fail(f"file is unexpectedly small: {path.relative_to(ROOT)}")


def read_text(path: Path) -> str:
    require_file(path)
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        fail(f"file is not UTF-8: {path.relative_to(ROOT)} ({error})")


def read_json(path: Path) -> object:
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError as error:
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {error}")


def validate_metadata() -> str:
    metadata = read_json(ROOT / "version.json")
    if not isinstance(metadata, dict):
        fail("version.json must contain an object")
    version = metadata.get("version")
    updated_at = metadata.get("updatedAt")
    if not isinstance(version, str) or not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version):
        fail("version.json has an invalid version")
    if not isinstance(updated_at, str) or "T" not in updated_at:
        fail("version.json has an invalid updatedAt value")
    return version


def validate_lecture_sources() -> tuple[dict[str, dict], list[dict]]:
    require_file(LECTURE_DIR / "catalog.schema.json")
    require_file(LECTURE_DIR / "lecture.schema.json")
    catalog = read_json(LECTURE_DIR / "catalog.json")
    if not isinstance(catalog, dict) or catalog.get("version") != 1:
        fail("lectures/catalog.json must be an object with version 1")
    entries = catalog.get("lectures")
    if not isinstance(entries, list) or not entries:
        fail("lecture catalog has no lectures")

    lecture_root = LECTURE_DIR.resolve()
    data_root = (LECTURE_DIR / "data").resolve()
    by_id: dict[str, dict] = {}
    referenced: set[Path] = set()
    subject_orders: set[tuple[str, float]] = set()

    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            fail(f"catalog entry {index} is not an object")
        lecture_id = entry.get("id")
        title = entry.get("title")
        subject_key = entry.get("subjectKey")
        order = entry.get("order")
        relative_file = entry.get("file")
        counts = entry.get("expectedCounts")

        if not isinstance(lecture_id, str) or not lecture_id.strip():
            fail(f"catalog entry {index} has no valid id")
        if lecture_id in by_id:
            fail(f"duplicate catalog lecture id: {lecture_id}")
        if not isinstance(title, str) or not title.strip():
            fail(f"catalog entry {lecture_id} has no title")
        if not isinstance(subject_key, str) or not subject_key.strip():
            fail(f"catalog entry {lecture_id} has no subjectKey")
        if not isinstance(order, (int, float)) or isinstance(order, bool):
            fail(f"catalog entry {lecture_id} has invalid order")
        order_key = (subject_key, float(order))
        if order_key in subject_orders:
            fail(f"duplicate lecture order {order} in subject {subject_key}")
        subject_orders.add(order_key)
        if not isinstance(relative_file, str) or not relative_file:
            fail(f"catalog entry {lecture_id} has no source file")
        if not isinstance(counts, dict) or set(counts) != set(COUNT_KEYS):
            fail(f"catalog entry {lecture_id} must define all expected counts")
        if any(not isinstance(value, int) or isinstance(value, bool) or value < 0 for value in counts.values()):
            fail(f"catalog entry {lecture_id} has invalid expected counts")

        source_path = (LECTURE_DIR / relative_file).resolve()
        if not source_path.is_relative_to(lecture_root):
            fail(f"lecture path escapes lectures directory: {relative_file}")
        if source_path.parent != data_root or source_path.suffix != ".json":
            fail(f"lecture source must be a JSON file under lectures/data: {relative_file}")
        if source_path in referenced:
            fail(f"lecture source is referenced more than once: {relative_file}")

        lecture = read_json(source_path)
        if not isinstance(lecture, dict):
            fail(f"lecture source is not an object: {relative_file}")
        for field, expected in (
            ("id", lecture_id),
            ("title", title),
            ("subjectKey", subject_key),
            ("order", order),
        ):
            if lecture.get(field) != expected:
                fail(f"{relative_file} {field} differs from catalog")
        for key in COUNT_KEYS:
            value = lecture.get(key)
            if not isinstance(value, list):
                fail(f"{lecture_id} is missing list {key}")
            if len(value) != counts[key]:
                fail(f"{lecture_id} has {len(value)} {key}; expected {counts[key]}")

        by_id[lecture_id] = lecture
        referenced.add(source_path)

    actual_files = {path.resolve() for path in (LECTURE_DIR / "data").glob("*.json")}
    if actual_files != referenced:
        unlisted = sorted(path.relative_to(LECTURE_DIR).as_posix() for path in actual_files - referenced)
        missing = sorted(path.relative_to(LECTURE_DIR).as_posix() for path in referenced - actual_files)
        details = []
        if unlisted:
            details.append("unlisted=" + ",".join(unlisted))
        if missing:
            details.append("missing=" + ",".join(missing))
        fail("catalog/data mismatch: " + "; ".join(details))

    legacy = sorted(
        path.relative_to(ROOT).as_posix()
        for path in LECTURE_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in {".js", ".b64", ".gz", ".zip"}
    )
    if legacy:
        fail("legacy lecture sources remain: " + ", ".join(legacy))

    return by_id, entries


def validate_manifest() -> None:
    manifest = read_json(DIST / "manifest.webmanifest")
    if not isinstance(manifest, dict):
        fail("generated manifest must contain an object")
    for key in ("name", "short_name", "start_url", "scope", "display", "icons"):
        if key not in manifest:
            fail(f"manifest is missing {key}")
    icons = manifest.get("icons")
    if not isinstance(icons, list) or len(icons) < 2:
        fail("manifest must define at least two icons")
    for icon in icons:
        src = icon.get("src") if isinstance(icon, dict) else None
        if not isinstance(src, str) or not src.startswith("./"):
            fail("manifest contains an invalid icon path")
        require_file(DIST / src[2:])


def validate_deployment_config() -> None:
    config = read_json(ROOT / "wrangler.jsonc")
    if not isinstance(config, dict):
        fail("wrangler.jsonc must contain an object")
    assets = config.get("assets")
    if not isinstance(assets, dict) or assets.get("directory") != "./dist":
        fail("Cloudflare assets directory is not ./dist")
    if assets.get("not_found_handling") != "404-page":
        fail("Cloudflare does not use explicit 404 handling")

    headers = read_text(DIST / "_headers")
    for marker in (
        "Content-Security-Policy:", "frame-ancestors 'none'", "object-src 'none'",
        "Permissions-Policy:", "Referrer-Policy: no-referrer",
        "X-Content-Type-Options: nosniff", "X-Frame-Options: DENY",
        "/version.json", "Cache-Control: no-store", "/service-worker.js",
        "Service-Worker-Allowed: /",
    ):
        if marker not in headers:
            fail(f"security headers are missing: {marker}")
    page_404 = read_text(DIST / "404.html")
    if "Page not found" not in page_404 or 'href="./"' not in page_404:
        fail("404 page is incomplete")


def validate_service_worker(version: str) -> None:
    worker = read_text(DIST / "service-worker.js")
    if f"const APP_VERSION = '{version}';" not in worker:
        fail("service-worker version differs from version.json")
    if "version.json" not in worker or "cache: 'no-store'" not in worker:
        fail("service worker does not perform a network-only version check")
    if "Promise.allSettled" not in worker:
        fail("optional PWA assets can still abort installation")
    for asset in ("./app.css", "./app.js", "./pwa-client.js"):
        if asset not in worker:
            fail(f"service worker does not pre-cache {asset}")
    if "Medical_MEQ_Review_Bank_Offline.html" not in worker:
        fail("service worker has no standalone fallback")


def validate_split_sources(version: str) -> None:
    source_index = read_text(ROOT / "src" / "index.html")
    source_css = read_text(ROOT / "src" / "app.css")
    source_app = read_text(ROOT / "src" / "app.js")
    source_pwa = read_text(ROOT / "src" / "pwa-client.js")
    if len(source_css) < 10_000 or len(source_app) < 10_000 or len(source_pwa) < 1_000:
        fail("split application source is unexpectedly small")
    for marker in (
        '<link rel="stylesheet" href="./app.css">',
        '<script src="./app.js"></script>',
        '<script src="./pwa-client.js"></script>',
    ):
        if source_index.count(marker) != 1:
            fail(f"source index must contain exactly one {marker}")
    if "medicalBankStatusV2" in source_index or "APP_VERSION" in source_index:
        fail("application JavaScript remains embedded in src/index.html")

    generated_css = read_text(DIST / "app.css")
    generated_app = read_text(DIST / "app.js")
    generated_pwa = read_text(DIST / "pwa-client.js")
    if generated_css != source_css:
        fail("generated app.css differs from source")
    if "const state=(()=>{try{" not in generated_app:
        fail("generated app.js has no safe progress parser")
    if "const state=JSON.parse(storage.get('medicalBankStatusV2')||'{}');" in generated_app:
        fail("unsafe progress parser remains in generated app.js")
    if f"const APP_VERSION = '{version}';" not in generated_pwa:
        fail("generated PWA client version differs from version.json")
    if "serviceWorker" not in generated_pwa:
        fail("generated PWA client does not register the service worker")
    if "localStorage.removeItem(k)" not in generated_pwa:
        fail("backup restore does not remove stale progress keys")


def extract_generated_lectures(html: str) -> dict[str, dict]:
    match = re.search(
        r"const incomingLectures = (\[.*?\]);\n\s*const existingIds",
        html,
        flags=re.S,
    )
    if not match:
        fail("generated HTML has no lecture batch")
    try:
        lectures = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        fail(f"generated lecture batch is invalid JSON: {error}")
    if not isinstance(lectures, list):
        fail("generated lecture batch is not a list")
    result: dict[str, dict] = {}
    for lecture in lectures:
        if not isinstance(lecture, dict) or not isinstance(lecture.get("id"), str):
            fail("generated lecture item is invalid")
        if lecture["id"] in result:
            fail(f"duplicate generated lecture id: {lecture['id']}")
        result[lecture["id"]] = lecture
    return result


def validate_html(source_lectures: dict[str, dict]) -> None:
    index_path = DIST / "index.html"
    offline_path = DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
    require_file(index_path, 2_000)
    require_file(offline_path, 100_000)
    html = read_text(index_path)
    offline = read_text(offline_path)

    for marker in (
        "Medical MEQ", 'id="lectureFilter"', 'id="typeFilter"', 'id="search"',
        '<link rel="stylesheet" href="./app.css">', '<script src="./app.js"></script>',
        '<script src="./pwa-client.js"></script>', 'id="review-filter-extension"',
        'id="mobile-filter-extension"', 'id="print-manager-extension"',
        'id="back-to-top-extension"',
    ):
        if marker not in html:
            fail(f"generated index is missing: {marker}")
    for marker in (
        "globalThis.__urolScrotalCompactGzip", "globalThis.__neuroTbiGzip",
        "globalThis.__urolUtiGzip", "globalThis.__urolEmergGzip", "DecompressionStream",
    ):
        if marker in html:
            fail(f"compressed runtime loader leaked into HTML: {marker}")

    generated = extract_generated_lectures(html)
    if generated != source_lectures:
        fail("generated lecture content differs from cataloged JSON sources")

    for marker in (
        'id="app-source-styles"', 'id="app-source-runtime"',
        'id="pwa-client-runtime"', "medicalBankStatusV2", "APP_VERSION",
    ):
        if marker not in offline:
            fail(f"standalone offline file is missing: {marker}")
    for marker in (
        '<link rel="stylesheet" href="./app.css">', '<script src="./app.js"></script>',
        '<script src="./pwa-client.js"></script>',
    ):
        if marker in offline:
            fail(f"standalone offline file still depends on: {marker}")

    script_ids = re.findall(r'<script\s+id="([^"]+)"', html)
    duplicates = sorted({value for value in script_ids if script_ids.count(value) > 1})
    if duplicates:
        fail("duplicate generated script ids: " + ", ".join(duplicates))
    element_ids = re.findall(r'\sid="([^"]+)"', html)
    for critical in ("search", "lectureFilter", "typeFilter", "emptyMessage", "appToast"):
        if element_ids.count(critical) != 1:
            fail(f"critical id is missing or duplicated: {critical}")


def validate_feature_sources() -> None:
    review = read_text(ROOT / "review-filter.js")
    if "tf === 'all' && !q" in review:
        fail("Rapid Recall is excluded from All-types search")
    if 'data-rapid-prepared="1"' not in review:
        fail("Rapid Recall metadata is recalculated on every filter pass")
    if "reduceMotion?.matches" not in review:
        fail("Rapid Recall random navigation ignores reduced motion")


def main() -> int:
    version = validate_metadata()
    source_lectures, entries = validate_lecture_sources()
    generated_metadata = read_json(DIST / "version.json")
    if not isinstance(generated_metadata, dict) or generated_metadata.get("version") != version:
        fail("generated version metadata differs from source")
    validate_manifest()
    validate_deployment_config()
    validate_service_worker(version)
    validate_split_sources(version)
    validate_feature_sources()
    validate_html(source_lectures)
    subjects = sorted({entry["subjectKey"] for entry in entries})
    print(
        f"Validated Medical MEQ Bank {version}: "
        f"{len(source_lectures)} lectures across {len(subjects)} subjects"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
