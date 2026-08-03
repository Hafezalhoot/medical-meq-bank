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
        "raw_bytes": 104_884,
        "sha256": "b730a37eee703b78cb68d87361fbb24aa6314983042cbd2bda8df89d5bbffb79",
        "images": 8,
        "part_sha256": [
            "61759f70f5c12fc81b20fbc90edb5d957afce04bc3155343c7c6d5f6c8c021db",
            "675de45d7b4274f6783482a6e1a39dcfeb20946ed8e9545aae1c380d0ee238ea",
            "10e46dae126e0a6b6d8da6c79aaac45675a9e829fe5360e032aa78b29db545c7",
            "f3a17450bbf3551899cd18c3efa1757b3bdb45acc7ba8d714dafaf867efdbc71",
            "10a2e4e90543338e8e58ecc7406b87a6a2a4a90871734a8f0196ba66289ac8ae",
            "46e414e8524f256003cbb7dc899d0c8a2525631224ca8a556119fe710c286a8c",
            "650f99cfb1eb26913319a87bde805912b165ff79274ea5923363012089f5273f",
            "f0d6a86658ceedbe1cde3ee0fc4395d08e05b1858ee7cbfaf96840f46b37f012",
            "415e7a49350fc4b5c974fd5a7f482d415ce59aa8d274481d6c77b31fd95e03d2",
            "82e3da409d3ac1bbfd1a6ac3431b3a6b9710d6ff0abe8fb0559da74faa79ae40",
            "9187c1c44f4344016d79c72017bc9a9f32da420f19d0add65a60c339dbd9a281",
        ],
    },
    "urology-urolithiasis.json": {
        "lecture_id": "urology-urolithiasis",
        "raw_bytes": 118_306,
        "sha256": "5c981841001ff37296b3359592e5e530dfbb9fa868ac22738975f6b33ca2ffd6",
        "images": 10,
        "part_sha256": [
            "7844f273f4517a5de5fcb09deb1afd5d2dc724ff40778ac18ad0e790227669d9",
            "adad581784b109c48674777600e81e68a01d387fb245413dc182eec22c59ffd1",
            "37b2c4c3c48d071bf3eec82468b7a2577efde9507f580e75056faea9b6f288d5",
            "58e6d1b2c390900413a0e0fd8dbb388a0e260332475baeab82296a3c967fe6dd",
            "9a76cf933659d929547431195f2d72ed7efd57d5e4001e63671ce8f7ba9f14a9",
            "8b955733ffdaf3d65b1454eda49ebf4d503ebb3f23c146a5320e10689c1b925f",
            "c6485edb77cc08e8bdb7ff2d6fa19883f20570bf44c80e144f2aba83b7b9a730",
            "fb5794d7cd8d8700398852fa0f999e6f9d00b0ae203ec8c642a9fc7cf2aec8bc",
            "6f600a602b72d9ba234f64d305d03b66b0c1fe4f1ded2a16b9b0106ca5f8cf8a",
            "e3c4f909d385b665673e5801f227751ce0494caa86298d49cf35ba6d0f88c5c9",
            "1b3336e3147f7ad79d1d364574292b375bb4a51046d413082080830d1c242a63",
            "82c8203d4a319c42fcfb2beab0cd8961b7145ada2b9f575c559f4acbf7360c1e",
            "e08aa128378cd7d3af012a0ee2d37fa340b6e0de37ae002a3fb1159f3e18953e",
            "00da71f22a30097e22b439c7b0c3f3252333ba2f513847bf44f7b74c2dec20e1",
        ],
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
    expected_hashes = config["part_sha256"]
    expected_parts = [
        PAYLOAD_DIR / f"{filename}.gz.b64.part{index:02d}"
        for index in range(1, len(expected_hashes) + 1)
    ]
    actual_parts = sorted(PAYLOAD_DIR.glob(f"{filename}.gz.b64.part*"))
    if actual_parts != expected_parts:
        actual_names = ", ".join(path.name for path in actual_parts) or "none"
        fail(f"{filename} payload parts are incomplete or unexpected: {actual_names}")

    normalized_parts: list[str] = []
    for index, (part, expected_hash) in enumerate(zip(expected_parts, expected_hashes), start=1):
        normalized = "".join(part.read_text(encoding="ascii").split())
        digest = hashlib.sha256(normalized.encode("ascii")).hexdigest()
        if digest != expected_hash:
            fail(
                f"{filename} part {index:02d} checksum is {digest}; "
                f"expected {expected_hash}; normalized length {len(normalized)}"
            )
        normalized_parts.append(normalized)

    encoded = "".join(normalized_parts)
    if len(encoded) % 4:
        fail(f"{filename} base64 length {len(encoded)} is not divisible by 4")
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
