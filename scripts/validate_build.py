#!/usr/bin/env python3
"""Fail the build when the generated Medical MEQ Bank is incomplete or inconsistent."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
LECTURE_DIR = ROOT / "lectures"

EXPECTED_LECTURES = {
    "neurosurgery-traumatic-brain-injury": {
        "cases": 16,
        "coreShorts": 35,
        "imageQuestions": 10,
        "detailedShorts": 58,
        "rapid": 40,
    },
    "urology-scrotal-swelling": {
        "cases": 15,
        "coreShorts": 35,
        "imageQuestions": 10,
        "detailedShorts": 58,
        "rapid": 40,
    },
    "urology-urinary-tract-infection": {
        "cases": 15,
        "coreShorts": 35,
        "imageQuestions": 10,
        "detailedShorts": 58,
        "rapid": 40,
    },
    "urology-urological-emergencies": {
        "cases": 15,
        "coreShorts": 31,
        "imageQuestions": 10,
        "detailedShorts": 53,
        "rapid": 33,
    },
}


def fail(message: str) -> None:
    raise SystemExit(f"BUILD VALIDATION FAILED: {message}")


def require_file(path: Path, *, minimum_size: int = 1) -> None:
    if not path.is_file():
        fail(f"missing file: {path.relative_to(ROOT)}")
    if path.stat().st_size < minimum_size:
        fail(f"file is unexpectedly small: {path.relative_to(ROOT)}")


def read_text(path: Path) -> str:
    require_file(path)
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        fail(f"file is not valid UTF-8: {path.relative_to(ROOT)} ({error})")


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


def validate_lecture_sources() -> dict[str, dict]:
    require_file(LECTURE_DIR / "catalog.schema.json")
    require_file(LECTURE_DIR / "lecture.schema.json")

    catalog = read_json(LECTURE_DIR / "catalog.json")
    if not isinstance(catalog, dict) or catalog.get("version") != 1:
        fail("lectures/catalog.json must be an object with version 1")

    entries = catalog.get("lectures")
    if not isinstance(entries, list):
        fail("lectures/catalog.json has no lectures array")

    by_id: dict[str, dict] = {}
    referenced_files: set[Path] = set()
    lecture_root = LECTURE_DIR.resolve()
    data_root = (LECTURE_DIR / "data").resolve()

    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            fail(f"lecture catalog entry {index} is not an object")

        lecture_id = entry.get("id")
        relative_file = entry.get("file")
        counts = entry.get("expectedCounts")
        if not isinstance(lecture_id, str) or not lecture_id:
            fail(f"lecture catalog entry {index} has no valid id")
        if lecture_id in by_id:
            fail(f"lecture catalog contains duplicate id: {lecture_id}")
        if lecture_id not in EXPECTED_LECTURES:
            fail(f"lecture catalog contains unexpected lecture: {lecture_id}")
        if counts != EXPECTED_LECTURES[lecture_id]:
            fail(f"lecture catalog counts changed unexpectedly for {lecture_id}")
        if not isinstance(relative_file, str) or not relative_file:
            fail(f"lecture catalog entry {lecture_id} has no source file")

        source_path = (LECTURE_DIR / relative_file).resolve()
        if not source_path.is_relative_to(lecture_root):
            fail(f"lecture source escapes lectures directory: {relative_file}")
        if source_path.parent != data_root or source_path.suffix != ".json":
            fail(f"lecture source must be under lectures/data: {relative_file}")
        if source_path in referenced_files:
            fail(f"lecture source file is reused: {relative_file}")

        lecture = read_json(source_path)
        if not isinstance(lecture, dict):
            fail(f"lecture source is not an object: {relative_file}")
        if lecture.get("id") != lecture_id:
            fail(f"lecture source id does not match catalog: {relative_file}")

        for key, expected in counts.items():
            value = lecture.get(key)
            if not isinstance(value, list):
                fail(f"{lecture_id} is missing list {key}")
            if len(value) != expected:
                fail(f"{lecture_id} has {len(value)} {key}; expected {expected}")

        by_id[lecture_id] = lecture
        referenced_files.add(source_path)

    missing_ids = sorted(set(EXPECTED_LECTURES) - set(by_id))
    if missing_ids:
        fail(f"lecture catalog is missing: {', '.join(missing_ids)}")

    actual_data_files = {path.resolve() for path in (LECTURE_DIR / "data").glob("*.json")}
    if actual_data_files != referenced_files:
        unlisted = sorted(
            path.relative_to(LECTURE_DIR).as_posix()
            for path in actual_data_files - referenced_files
        )
        missing = sorted(
            path.relative_to(LECTURE_DIR).as_posix()
            for path in referenced_files - actual_data_files
        )
        details = []
        if unlisted:
            details.append("unlisted: " + ", ".join(unlisted))
        if missing:
            details.append("missing: " + ", ".join(missing))
        fail("lecture catalog/data mismatch (" + "; ".join(details) + ")")

    legacy_sources = sorted(
        path.relative_to(ROOT).as_posix()
        for path in LECTURE_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in {".js", ".b64", ".gz", ".zip"}
    )
    if legacy_sources:
        fail("legacy compressed lecture sources remain: " + ", ".join(legacy_sources))

    return by_id


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


def validate_cloudflare_config() -> None:
    config = read_json(ROOT / "wrangler.jsonc")
    if not isinstance(config, dict):
        fail("wrangler.jsonc must contain an object")

    assets = config.get("assets")
    if not isinstance(assets, dict):
        fail("wrangler.jsonc is missing assets configuration")
    if assets.get("directory") != "./dist":
        fail("Cloudflare assets directory is not ./dist")
    if assets.get("not_found_handling") != "404-page":
        fail("unknown paths do not use explicit 404 handling")


def validate_security_headers() -> None:
    headers = read_text(DIST / "_headers")
    required = (
        "Content-Security-Policy:",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "Permissions-Policy:",
        "Referrer-Policy: no-referrer",
        "X-Content-Type-Options: nosniff",
        "X-Frame-Options: DENY",
        "/version.json",
        "Cache-Control: no-store",
        "/service-worker.js",
        "Service-Worker-Allowed: /",
    )
    for marker in required:
        if marker not in headers:
            fail(f"security headers are missing marker: {marker}")

    page_404 = read_text(DIST / "404.html")
    if "Page not found" not in page_404 or 'href="./"' not in page_404:
        fail("404 page is incomplete")


def validate_service_worker(version: str) -> None:
    worker = read_text(DIST / "service-worker.js")
    if f"const APP_VERSION = '{version}';" not in worker:
        fail("service-worker APP_VERSION does not match version.json")
    if "version.json" not in worker or "cache: 'no-store'" not in worker:
        fail("service worker does not use a network-only version check")
    if "Promise.allSettled" not in worker:
        fail("optional PWA assets can still abort installation")
    if "Medical_MEQ_Review_Bank_Offline.html" not in worker:
        fail("service worker does not reference the generated offline page")


def extract_generated_lectures(html: str) -> dict[str, dict]:
    match = re.search(
        r"const incomingLectures = (\[.*?\]);\n\s*const existingIds",
        html,
        flags=re.S,
    )
    if not match:
        fail("generated HTML does not contain the lecture batch")

    try:
        lectures = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        fail(f"generated lecture batch is not valid JSON: {error}")

    if not isinstance(lectures, list):
        fail("generated lecture batch is not a list")

    by_id: dict[str, dict] = {}
    for lecture in lectures:
        if not isinstance(lecture, dict):
            fail("generated lecture batch contains a non-object item")
        lecture_id = lecture.get("id")
        if not isinstance(lecture_id, str) or not lecture_id:
            fail("generated lecture is missing an id")
        if lecture_id in by_id:
            fail(f"generated lecture id is duplicated: {lecture_id}")
        by_id[lecture_id] = lecture
    return by_id


def validate_generated_lectures(html: str, source_lectures: dict[str, dict]) -> None:
    generated = extract_generated_lectures(html)
    if set(generated) != set(source_lectures):
        fail("generated lecture IDs do not exactly match lectures/catalog.json")

    for lecture_id, source in source_lectures.items():
        if generated[lecture_id] != source:
            fail(f"generated lecture content differs from JSON source: {lecture_id}")


def validate_filter_source() -> None:
    source = read_text(ROOT / "review-filter.js")
    if "tf === 'all' && !q" in source:
        fail("Rapid Recall is still excluded from All-types search")
    if 'data-rapid-prepared="1"' not in source:
        fail("Rapid Recall metadata is recalculated on every filter pass")
    if "reduceMotion?.matches" not in source:
        fail("random Rapid Recall navigation ignores reduced-motion preferences")


def validate_html(version: str, source_lectures: dict[str, dict]) -> None:
    index_path = DIST / "index.html"
    offline_path = DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
    require_file(index_path, minimum_size=10_000)
    require_file(offline_path, minimum_size=10_000)

    html = read_text(index_path)
    offline_html = read_text(offline_path)

    required_markers = (
        "Medical MEQ",
        "id=\"lectureFilter\"",
        "id=\"typeFilter\"",
        "id=\"search\"",
        "id=\"review-filter-extension\"",
        "id=\"mobile-filter-extension\"",
        "id=\"print-manager-extension\"",
        "id=\"back-to-top-extension\"",
    )
    for marker in required_markers:
        if marker not in html:
            fail(f"generated index is missing marker: {marker}")

    forbidden_markers = (
        "globalThis.__urolScrotalCompactGzip",
        "globalThis.__neuroTbiGzip",
        "globalThis.__urolUtiGzip",
        "globalThis.__urolEmergGzip",
        "DecompressionStream",
    )
    for marker in forbidden_markers:
        if marker in html:
            fail(f"runtime compressed loader leaked into generated HTML: {marker}")

    validate_generated_lectures(html, source_lectures)

    if f"const APP_VERSION = '{version}';" not in html:
        fail("generated application version does not match version.json")
    if "<base href=\"../\">" not in offline_html:
        fail("standalone offline page has no stable base URL")

    script_ids = re.findall(r"<script\s+id=\"([^\"]+)\"", html)
    duplicate_script_ids = sorted({value for value in script_ids if script_ids.count(value) > 1})
    if duplicate_script_ids:
        fail(f"duplicate generated script ids: {', '.join(duplicate_script_ids)}")

    element_ids = re.findall(r"\sid=\"([^\"]+)\"", html)
    invalid_critical_ids = sorted(
        value
        for value in {"search", "lectureFilter", "typeFilter", "emptyMessage", "appToast"}
        if element_ids.count(value) != 1
    )
    if invalid_critical_ids:
        fail(f"critical element ids are missing or duplicated: {', '.join(invalid_critical_ids)}")


def main() -> int:
    require_file(DIST / "version.json")
    version = validate_metadata()
    source_lectures = validate_lecture_sources()

    generated_metadata = read_json(DIST / "version.json")
    if not isinstance(generated_metadata, dict) or generated_metadata.get("version") != version:
        fail("generated version.json differs from repository metadata")

    validate_manifest()
    validate_cloudflare_config()
    validate_security_headers()
    validate_service_worker(version)
    validate_filter_source()
    validate_html(version, source_lectures)
    print(f"Validated Medical MEQ Bank {version} with {len(source_lectures)} JSON lectures")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
