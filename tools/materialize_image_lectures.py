#!/usr/bin/env python3
"""Materialize lecture JSON files that include the original image-question slides."""

from __future__ import annotations

from gzip import decompress
from hashlib import sha256
from json import loads
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAYLOAD_DIR = ROOT / "lectures" / "payloads"
TARGETS = {
    "urology-bladder-cancer.json": "9f3129600ef233a593b260c01745415fb70ade3d35891835616cd84343e52fa6",
    "urology-urolithiasis.json": "1caadb9b563915a1d0557fcbd8ba6596ccfb63cfee9c77a761d80644b77e3785",
}


def materialize(filename: str, expected_sha256: str) -> None:
    parts = sorted(PAYLOAD_DIR.glob(f"{filename}.gz.part*"))
    if not parts:
        raise SystemExit(f"Missing image payload parts for {filename}")

    try:
        raw = decompress(b"".join(part.read_bytes() for part in parts))
    except Exception as error:
        raise SystemExit(f"Could not decode image payload for {filename}: {error}") from error

    actual_sha256 = sha256(raw).hexdigest()
    if actual_sha256 != expected_sha256:
        raise SystemExit(
            f"Image payload checksum mismatch for {filename}: "
            f"expected {expected_sha256}, got {actual_sha256}"
        )

    try:
        lecture = loads(raw.decode("utf-8"))
    except Exception as error:
        raise SystemExit(f"Invalid materialized lecture JSON for {filename}: {error}") from error

    image_questions = lecture.get("imageQuestions")
    if not isinstance(image_questions, list) or not image_questions:
        raise SystemExit(f"Materialized lecture {filename} has no image questions")

    missing = [
        item.get("id", f"item-{index}")
        for index, item in enumerate(image_questions, start=1)
        if not isinstance(item, dict)
        or not isinstance(item.get("image"), str)
        or not item["image"].startswith("data:image/")
    ]
    if missing:
        raise SystemExit(
            f"Materialized lecture {filename} has missing image payloads: {', '.join(missing)}"
        )

    target = ROOT / "lectures" / "data" / filename
    target.write_bytes(raw)
    print(f"Materialized {filename} with {len(image_questions)} image questions")


def main() -> None:
    for filename, expected_sha256 in TARGETS.items():
        materialize(filename, expected_sha256)


if __name__ == "__main__":
    main()
