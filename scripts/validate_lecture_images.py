#!/usr/bin/env python3
"""Validate the 18 embedded Bladder Cancer and Urolithiasis AVIF question images."""

from __future__ import annotations

from pathlib import Path
import base64
import binascii
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
TARGET_LECTURES = {
    "urology-bladder-cancer": 8,
    "urology-urolithiasis": 10,
}


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
    prefix = "data:image/avif;base64,"
    if not isinstance(source, str) or not source.startswith(prefix):
        fail(f"{label} does not use an embedded AVIF data URI")
    try:
        raw = base64.b64decode(source[len(prefix):], validate=True)
    except (binascii.Error, ValueError) as error:
        fail(f"{label} contains invalid base64: {error}")
    if len(raw) < 16 or raw[4:8] != b"ftyp" or not (b"avif" in raw[8:32] or b"avis" in raw[8:32]):
        fail(f"{label} is not a valid AVIF payload")
    return raw


def main() -> None:
    catalog = load_json(ROOT / "lectures" / "catalog.json")
    if not isinstance(catalog, dict) or not isinstance(catalog.get("lectures"), list):
        fail("invalid lecture catalog")

    seen: set[str] = set()
    total_bytes = 0
    for entry in catalog["lectures"]:
        if not isinstance(entry, dict) or entry.get("id") not in TARGET_LECTURES:
            continue
        lecture_id = entry["id"]
        lecture = load_json(ROOT / "lectures" / str(entry.get("file")))
        if not isinstance(lecture, dict) or not isinstance(lecture.get("imageQuestions"), list):
            fail(f"invalid imageQuestions for {lecture_id}")
        questions = lecture["imageQuestions"]
        if len(questions) != TARGET_LECTURES[lecture_id]:
            fail(f"{lecture_id} has {len(questions)} images; expected {TARGET_LECTURES[lecture_id]}")

        for item in questions:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                fail(f"invalid image question in {lecture_id}")
            question_id = item["id"]
            if question_id in seen:
                fail(f"duplicate image question id: {question_id}")
            raw = decode_avif(item.get("image"), label=f"{lecture_id} {question_id}")
            digest = hashlib.sha256(raw).hexdigest()
            if item.get("imageBytes") != len(raw):
                fail(f"imageBytes mismatch for {question_id}")
            if item.get("imageSha256") != digest:
                fail(f"imageSha256 mismatch for {question_id}")
            if item.get("page") in (None, ""):
                fail(f"missing source page for {question_id}")
            if not isinstance(item.get("prompt"), str) or not item["prompt"].strip():
                fail(f"missing visual prompt for {question_id}")
            seen.add(question_id)
            total_bytes += len(raw)

    if len(seen) != 18:
        fail(f"expected 18 embedded images, found {len(seen)}")
    print(f"Validated 18 embedded AVIF lecture images ({total_bytes} decoded bytes)")


if __name__ == "__main__":
    main()
