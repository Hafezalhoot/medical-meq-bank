#!/usr/bin/env python3
"""Fail the build when the generated Medical MEQ Bank is incomplete or inconsistent."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


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


def validate_metadata() -> str:
    version_path = ROOT / "version.json"
    require_file(version_path)
    try:
        metadata = json.loads(version_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        fail(f"invalid version.json: {error}")

    version = metadata.get("version")
    updated_at = metadata.get("updatedAt")
    if not isinstance(version, str) or not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version):
        fail("version.json has an invalid version")
    if not isinstance(updated_at, str) or "T" not in updated_at:
        fail("version.json has an invalid updatedAt value")
    return version


def validate_manifest() -> None:
    manifest_path = DIST / "manifest.webmanifest"
    manifest_text = read_text(manifest_path)
    try:
        manifest = json.loads(manifest_text)
    except json.JSONDecodeError as error:
        fail(f"invalid generated manifest: {error}")

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


def validate_html(version: str) -> None:
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
        "id=\"print-manager-extension\"",
        "id=\"back-to-top-extension\"",
        "urology-urinary-tract-infection",
        "urology-scrotal-swelling",
        "neurosurgery-traumatic-brain-injury",
    )
    for marker in required_markers:
        if marker not in html:
            fail(f"generated index is missing marker: {marker}")

    forbidden_markers = (
        "globalThis.__urolScrotalCompactGzip",
        "globalThis.__neuroTbiGzip",
    )
    for marker in forbidden_markers:
        if marker in html:
            fail(f"compressed loader leaked into generated HTML: {marker}")

    if f"const APP_VERSION = '{version}';" not in html:
        fail("generated application version does not match version.json")
    if "<base href=\"../\">" not in offline_html:
        fail("standalone offline page has no stable base URL")

    script_ids = re.findall(r"<script\s+id=\"([^\"]+)\"", html)
    duplicate_script_ids = sorted({value for value in script_ids if script_ids.count(value) > 1})
    if duplicate_script_ids:
        fail(f"duplicate generated script ids: {', '.join(duplicate_script_ids)}")

    element_ids = re.findall(r"\sid=\"([^\"]+)\"", html)
    duplicate_critical_ids = sorted(
        value for value in {"search", "lectureFilter", "typeFilter", "emptyMessage", "appToast"}
        if element_ids.count(value) != 1
    )
    if duplicate_critical_ids:
        fail(f"critical element ids are missing or duplicated: {', '.join(duplicate_critical_ids)}")


def main() -> int:
    require_file(DIST / "version.json")
    version = validate_metadata()

    generated_metadata = json.loads(read_text(DIST / "version.json"))
    if generated_metadata.get("version") != version:
        fail("generated version.json differs from repository metadata")

    validate_manifest()
    validate_service_worker(version)
    validate_html(version)
    print(f"Validated Medical MEQ Bank {version}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
