#!/usr/bin/env python3
"""Apply checksum-verified transport fixes, then materialize lecture payloads."""

from __future__ import annotations

import hashlib
from pathlib import Path

import materialize_verified_lectures_v2 as base

ROOT = Path(__file__).resolve().parents[1]
FIX_DIR = ROOT / "lectures" / "payload-fixes"
TARGET_PART = (
    ROOT
    / "lectures"
    / "payloads-v2"
    / "urology-urolithiasis.json.gz.b64.part05"
)
EXPECTED_PART_SHA256 = "9a76cf933659d929547431195f2d72ed7efd57d5e4001e63671ce8f7ba9f14a9"
KNOWN_TRANSPORT_SHA256 = "ad326fa6301d4e27bc18642cb47455547e37520ade51c3f62b20f3df6bdde3ce"
FIX_CHUNKS = (
    ("urology-urolithiasis.part05.1", "2a7b85847dcd226f6dfc9d72be2287f1bcffb7d05ca5bdcdabe04662c7c4dbcf"),
    ("urology-urolithiasis.part05.2", "60746ca1349ea869b966ba4be5d5c108b9d91d1e835976783e5a689bf1563d28"),
    ("urology-urolithiasis.part05.3", "06174b5d55a6e6f3580797b9196a7526a77b8032e977b2b4b53a8ce932ab3a79"),
)


def normalized_text(path: Path) -> str:
    return "".join(path.read_text(encoding="ascii").split())


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def restore_part05() -> None:
    current = normalized_text(TARGET_PART)
    current_sha = digest(current)
    if current_sha == EXPECTED_PART_SHA256:
        return
    if current_sha != KNOWN_TRANSPORT_SHA256:
        base.fail(
            "urology-urolithiasis part 05 has an unknown checksum: "
            f"{current_sha}"
        )

    chunks: list[str] = []
    for filename, expected_sha in FIX_CHUNKS:
        path = FIX_DIR / filename
        if not path.is_file():
            base.fail(f"missing verified payload fix: {path.relative_to(ROOT)}")
        value = normalized_text(path)
        actual_sha = digest(value)
        if len(value) != 2000 or actual_sha != expected_sha:
            base.fail(
                f"payload fix {filename} is invalid: length={len(value)} "
                f"sha256={actual_sha}"
            )
        chunks.append(value)

    repaired = "".join(chunks)
    repaired_sha = digest(repaired)
    if len(repaired) != 6000 or repaired_sha != EXPECTED_PART_SHA256:
        base.fail(
            "verified part 05 reconstruction failed: "
            f"length={len(repaired)} sha256={repaired_sha}"
        )

    TARGET_PART.write_text(repaired, encoding="ascii")
    print(
        "Restored Urolithiasis payload part 05 from three verified chunks; "
        f"verified {repaired_sha}"
    )


def main() -> None:
    restore_part05()
    base.main()


if __name__ == "__main__":
    main()
