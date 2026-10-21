#!/usr/bin/env python3
"""Validate embedded AVIFs, original printed-PDF JPEG assets and private media metadata."""

from __future__ import annotations

from pathlib import Path
import base64
import binascii
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
LECTURES = ROOT / "lectures"
AVIF_PREFIX = "data:image/avif;base64,"


def fail(message: str) -> None:
    raise SystemExit(f"LECTURE IMAGE VALIDATION FAILED: {message}")


def load_json(path: Path) -> object:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing or empty file: {path.relative_to(ROOT)}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {error}")


def decode_avif(source: object, *, label: str) -> bytes:
    if not isinstance(source, str) or not source.startswith(AVIF_PREFIX):
        fail(f"{label} does not use an embedded AVIF data URI")
    try:
        raw = base64.b64decode(source[len(AVIF_PREFIX):], validate=True)
    except (binascii.Error, ValueError) as error:
        fail(f"{label} contains invalid base64: {error}")
    if len(raw) < 16 or raw[4:8] != b"ftyp" or not (b"avif" in raw[8:32] or b"avis" in raw[8:32]):
        fail(f"{label} is not a valid AVIF payload")
    return raw


def expected_materialized_image_counts() -> dict[str, int]:
    manifest = load_json(LECTURES / "materialization.json")
    if not isinstance(manifest, dict) or manifest.get("version") != 1:
        fail("invalid lecture materialization manifest")
    targets = manifest.get("targets")
    if not isinstance(targets, list):
        fail("lecture materialization manifest has no targets")

    expected: dict[str, int] = {}
    for target in targets:
        if not isinstance(target, dict):
            fail("invalid lecture materialization target")
        lecture_id = target.get("lectureId")
        if not isinstance(lecture_id, str) or not lecture_id:
            fail("materialization target has no lectureId")

        image_count = target.get("imageCount")
        if isinstance(image_count, int) and not isinstance(image_count, bool) and image_count >= 0:
            expected[lecture_id] = image_count
            continue

        asset_manifest = target.get("assetManifest")
        if isinstance(asset_manifest, str) and asset_manifest:
            path = (ROOT / asset_manifest).resolve()
            if not path.is_relative_to(ROOT):
                fail(f"asset manifest escapes repository root for {lecture_id}")
            data = load_json(path)
            assets = data.get("assets") if isinstance(data, dict) else None
            if not isinstance(assets, list):
                fail(f"asset manifest has no assets list for {lecture_id}")
            expected[lecture_id] = len(assets)

    return expected


def main() -> None:
    catalog = load_json(LECTURES / "catalog.json")
    if not isinstance(catalog, dict) or not isinstance(catalog.get("lectures"), list):
        fail("invalid lecture catalog")

    expected_counts = expected_materialized_image_counts()
    catalog_ids: set[str] = set()
    total_images = 0
    total_bytes = 0
    original_source_slots = 0

    for entry in catalog["lectures"]:
        if not isinstance(entry, dict):
            fail("invalid lecture catalog entry")
        lecture_id = entry.get("id")
        relative_file = entry.get("file")
        if not isinstance(lecture_id, str) or not lecture_id:
            fail("catalog entry has no lecture id")
        if not isinstance(relative_file, str) or not relative_file:
            fail(f"catalog entry {lecture_id} has no lecture file")
        catalog_ids.add(lecture_id)

        lecture = load_json(LECTURES / relative_file)
        questions = lecture.get("imageQuestions") if isinstance(lecture, dict) else None
        if not isinstance(questions, list):
            fail(f"invalid imageQuestions for {lecture_id}")

        embedded_count = 0
        for item in questions:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                fail(f"invalid image question in {lecture_id}")
            question_id = item["id"]
            global_id = f"{lecture_id}/{question_id}"
            source = item.get("image")

            # Original printed PDF photograph made available as a local JPEG.
            # Validate bytes, MIME signature and source hash from the repo asset;
            # external URLs and fabricated image replacements are not allowed.
            if isinstance(source, str) and source.startswith("./assets/lectures/") and source.endswith(".jpg"):
                relative = source[2:]
                resolved = (ROOT / relative).resolve()
                allowed_root = (ROOT / "assets" / "lectures").resolve()
                if not resolved.is_relative_to(allowed_root) or not resolved.is_file():
                    fail(f"missing or unsafe source PDF JPEG for {global_id}")
                raw = resolved.read_bytes()
                if len(raw) < 300 or len(raw) > 5 * 1024 * 1024 or raw[:3] != b"\\xff\\xd8\\xff":
                    fail(f"source PDF JPEG is invalid for {global_id}")
                digest = hashlib.sha256(raw).hexdigest()
                if item.get("imageSha256") != digest or item.get("imageBytes") != len(raw):
                    fail(f"hosted original JPEG integrity mismatch for {global_id}")
                if not item.get("page") or not isinstance(item.get("prompt"), str) or not item["prompt"].strip():
                    fail(f"hosted original JPEG requires a printed page and prompt for {global_id}")
                total_images += 1
                total_bytes += len(raw)
                continue

            if not (isinstance(source, str) and source.startswith(AVIF_PREFIX)):
                fingerprint = item.get("imageSha256")
                declared_bytes = item.get("imageBytes")
                if not source and isinstance(fingerprint, str):
                    # Source-photograph metadata only. JPEG bytes intentionally
                    # remain outside this public repository until licensed.
                    if len(fingerprint) != 64 or any(ch not in "0123456789abcdef" for ch in fingerprint):
                        fail(f"invalid private original-photo SHA-256 for {global_id}")
                    if item.get("page") in (None, ""):
                        fail(f"source JPEG requires a printed PDF page for {global_id}")
                    if not isinstance(item.get("prompt"), str) or not item["prompt"].strip():
                        fail(f"source JPEG requires a lecture-grounded prompt for {global_id}")
                    if declared_bytes is not None and (
                        not isinstance(declared_bytes, int) or isinstance(declared_bytes, bool)
                        or declared_bytes < 300 or declared_bytes > 5 * 1024 * 1024
                    ):
                        fail(f"invalid private original-photo size for {global_id}")
                    original_source_slots += 1
                    continue
                if fingerprint is not None or declared_bytes is not None:
                    fail(f"image integrity metadata has no supported source for {global_id}")
                continue

            raw = decode_avif(source, label=global_id)
            digest = hashlib.sha256(raw).hexdigest()
            if item.get("imageBytes") != len(raw):
                fail(f"imageBytes mismatch for {global_id}")
            if item.get("imageSha256") != digest:
                fail(f"imageSha256 mismatch for {global_id}")
            if item.get("page") in (None, ""):
                fail(f"missing source page for {global_id}")
            if not isinstance(item.get("prompt"), str) or not item["prompt"].strip():
                fail(f"missing visual prompt for {global_id}")

            embedded_count += 1
            total_images += 1
            total_bytes += len(raw)

        expected = expected_counts.get(lecture_id)
        if expected is not None and embedded_count != expected:
            fail(f"{lecture_id} has {embedded_count} embedded AVIF images; expected {expected}")

    missing_targets = sorted(set(expected_counts) - catalog_ids)
    if missing_targets:
        fail("materialized lectures are missing from catalog: " + ", ".join(missing_targets))

    print(f"Validated {total_images} embedded AVIF images ({total_bytes} decoded bytes) and {original_source_slots} private original-PDF photo slots")


if __name__ == "__main__":
    main()
