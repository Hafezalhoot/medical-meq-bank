#!/usr/bin/env python3
"""Materialize checksum-verified lecture JSON payloads before validation/build."""

from __future__ import annotations

import base64
import binascii
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD_DIR = ROOT / "lectures" / "payloads-v2"
DATA_DIR = ROOT / "lectures" / "data"

TARGETS = {
    "urology-bladder-cancer.json": {
        "lecture_id": "urology-bladder-cancer",
        "parts": 11,
        "raw_bytes": 104_884,
        "sha256": "b730a37eee703b78cb68d87361fbb24aa6314983042cbd2bda8df89d5bbffb79",
        "images": 8,
    },
    "urology-urolithiasis.json": {
        "lecture_id": "urology-urolithiasis",
        "parts": 14,
        "raw_bytes": 118_306,
        "sha256": "5c981841001ff37296b3359592e5e530dfbb9fa868ac22738975f6b33ca2ffd6",
        "images": 10,
    },
}


def fail(message: str) -> None:
    raise SystemExit(f"LECTURE PAYLOAD MATERIALIZATION FAILED: {message}")


def decode_avif(source: object, *, label: str) -> bytes:
    prefix = "data:image/avif;base64,"
    if not isinstance(source, str) or not source.startswith(prefix):
        fail(f"{label} does not use an embedded AVIF data URI")
    try:
        raw = base64.b64decode(source[len(prefix):], validate=True)
    except (binascii.Error, ValueError) as error:
        fail(f"{label} contains invalid image base64: {error}")
    brands = {raw[index:index + 4] for index in range(8, min(len(raw), 32), 4)}
    if len(raw) < 16 or raw[4:8] != b"ftyp" or not ({b"avif", b"avis"} & brands):
        fail(f"{label} is not a valid AVIF payload")
    return raw


def validate_lecture(raw: bytes, config: dict[str, object], *, filename: str) -> None:
    if len(raw) != config["raw_bytes"]:
        fail(f"{filename} decoded length is {len(raw)}; expected {config['raw_bytes']}")
    digest = hashlib.sha256(raw).hexdigest()
    if digest != config["sha256"]:
        fail(f"{filename} checksum is {digest}; expected {config['sha256']}")
    try:
        lecture = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"{filename} is not valid UTF-8 JSON: {error}")
    if not isinstance(lecture, dict) or lecture.get("id") != config["lecture_id"]:
        fail(f"{filename} has an unexpected lecture id")
    questions = lecture.get("imageQuestions")
    if not isinstance(questions, list) or len(questions) != config["images"]:
        fail(f"{filename} must contain {config['images']} image questions")

    seen: set[str] = set()
    for item in questions:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            fail(f"{filename} contains an invalid image question")
        question_id = item["id"]
        if question_id in seen:
            fail(f"{filename} contains duplicate image question {question_id}")
        image = decode_avif(item.get("image"), label=f"{filename} {question_id}")
        if item.get("imageBytes") != len(image):
            fail(f"{filename} {question_id} imageBytes mismatch")
        if item.get("imageSha256") != hashlib.sha256(image).hexdigest():
            fail(f"{filename} {question_id} imageSha256 mismatch")
        if item.get("page") in (None, ""):
            fail(f"{filename} {question_id} is missing its lecture-page reference")
        if not isinstance(item.get("prompt"), str) or not item["prompt"].strip():
            fail(f"{filename} {question_id} is missing its visual prompt")
        seen.add(question_id)


def materialize(filename: str, config: dict[str, object]) -> None:
    expected_parts = [
        PAYLOAD_DIR / f"{filename}.gz.b64.part{index:02d}"
        for index in range(1, int(config["parts"]) + 1)
    ]
    actual_parts = sorted(PAYLOAD_DIR.glob(f"{filename}.gz.b64.part*"))
    if actual_parts != expected_parts:
        actual_names = ", ".join(path.name for path in actual_parts) or "none"
        fail(f"{filename} payload parts are incomplete or unexpected: {actual_names}")

    encoded = "".join(
        "".join(part.read_text(encoding="ascii").split())
        for part in expected_parts
    )
    try:
        compressed = base64.b64decode(encoded, validate=True)
        raw = gzip.decompress(compressed)
    except (UnicodeDecodeError, binascii.Error, ValueError, OSError, EOFError) as error:
        fail(f"could not decode {filename}: {error}")

    validate_lecture(raw, config, filename=filename)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    destination = DATA_DIR / filename
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_bytes(raw)
    temporary.replace(destination)
    print(f"Materialized {filename}: {len(raw)} bytes, {config['images']} verified images")


def main() -> None:
    if not PAYLOAD_DIR.is_dir():
        fail(f"missing payload directory: {PAYLOAD_DIR.relative_to(ROOT)}")
    for filename, config in TARGETS.items():
        materialize(filename, config)


if __name__ == "__main__":
    main()
