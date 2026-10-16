#!/usr/bin/env python3
"""Validate embedded AVIF image-question payloads without lecture-specific rules."""

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

            if not (isinstance(source, str) and source.startswith(AVIF_PREFIX)):
                if item.get("imageBytes") is not None or item.get("imageSha256") is not None:
                    fail(f"AVIF integrity metadata exists without an embedded AVIF for {global_id}")
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

    print(f"Validated {total_images} embedded AVIF lecture images ({total_bytes} decoded bytes)")


if __name__ == "__main__":
    main()
