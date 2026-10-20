#!/usr/bin/env python3
"""Validate a private original-PDF photo ZIP without extraction or uploads.

The lecture's reviewed source JPEG SHA-256 metadata is the source of truth.
No clinical image or copyrighted scan is checked into this repository.
"""
from __future__ import annotations

from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path
import json
import re
import sys
import zipfile

MAX_ZIP = 32 * 1024 * 1024
MAX_JPEG = 5 * 1024 * 1024
IMAGE_PATH = re.compile(r"^original-figures/([a-z0-9][a-z0-9_-]*)\.jpg$")
HASH = re.compile(r"^[a-f0-9]{64}$")


def reject(reason: str):
    raise ValueError(reason)


def source_contract(lecture: dict) -> dict[str, dict]:
    if not isinstance(lecture.get("imageQuestions"), list):
        reject("lecture is missing imageQuestions")
    expected = {}
    for item in lecture["imageQuestions"]:
        if not isinstance(item, dict):
            reject("invalid image-question record")
        digest = item.get("imageSha256")
        if digest is None:
            continue  # Legacy embedded or text-only image questions are unaffected.
        ident = item.get("id")
        if not isinstance(ident, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", ident):
            reject("unsafe original-image question ID")
        if ident in expected:
            reject("duplicate source-image ID: " + ident)
        if not isinstance(digest, str) or not HASH.fullmatch(digest):
            reject(ident + ": invalid source-image SHA-256")
        if item.get("image"):
            reject(ident + ": private source photo cannot have a public image URL")
        if not str(item.get("page") or "").strip():
            reject(ident + ": source PDF page missing")
        expected[ident] = item
    if not expected:
        reject("lecture has no private original-photo imageSha256 metadata")
    return expected


def audit_zip(lecture: dict, path: Path) -> tuple[int, int]:
    if not path.is_file() or path.stat().st_size > MAX_ZIP:
        reject("private photo ZIP missing or exceeds 32 MB")
    expected = source_contract(lecture)
    actual = {}
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > 256:
                reject("ZIP contains too many entries")
            manifest = None
            raw_total = 0
            for entry in entries:
                if entry.is_dir():
                    continue
                if entry.filename == "original-figures/manifest.json":
                    if entry.file_size > 200_000 or manifest is not None:
                        reject("oversized or duplicate image manifest")
                    try:
                        manifest = json.loads(archive.read(entry).decode("utf-8"))
                    except (ValueError, UnicodeDecodeError):
                        reject("original-image manifest is not valid JSON")
                    continue
                if entry.filename in ("original-figures/README.txt", "original-figures/README.md"):
                    continue
                match = IMAGE_PATH.fullmatch(entry.filename)
                if not match:
                    reject("unexpected file/path in source ZIP: " + entry.filename)
                ident = match.group(1)
                if ident not in expected or ident in actual:
                    reject("unknown/duplicate original image ID: " + ident)
                if not 300 <= entry.file_size <= MAX_JPEG:
                    reject(ident + ": source JPEG outside 300 B – 5 MB")
                raw_total += entry.file_size
                if raw_total > 64 * 1024 * 1024:
                    reject("source ZIP would decompress over 64 MB")
                jpeg = archive.read(entry)  # No extract(), disk write or network.
                if not jpeg.startswith(b"\xff\xd8\xff"):
                    reject(ident + ": source bytes are not a JPEG")
                if sha256(jpeg).hexdigest() != expected[ident]["imageSha256"]:
                    reject(ident + ": photo differs from the reviewed original PDF")
                length = expected[ident].get("imageBytes")
                if length is not None and length != len(jpeg):
                    reject(ident + ": byte count differs from reviewed imageBytes")
                actual[ident] = len(jpeg)
            missing = set(expected) - set(actual)
            if missing:
                reject("source ZIP missing: " + ", ".join(sorted(missing)))
            if not isinstance(manifest, dict) or not isinstance(manifest.get("items"), list):
                reject("private source ZIP needs a per-image manifest")
            if manifest.get("lectureId") not in (None, lecture.get("id")):
                reject("original images belong to a different lecture")
            seen = set()
            for item in manifest["items"]:
                if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                    reject("invalid original image manifest item")
                ident = item["id"]
                if ident not in actual or ident in seen:
                    reject("unexpected/duplicate original manifest image: " + ident)
                seen.add(ident)
                if item.get("sha256") != expected[ident]["imageSha256"]:
                    reject(ident + ": manifest fingerprint mismatches lecture")
                page = item.get("sourcePage")
                if not isinstance(page, int) or isinstance(page, bool) or str(page) not in re.findall(r"\d+", str(expected[ident]["page"])):
                    reject(ident + ": printed PDF page mismatches lecture")
            if seen != set(expected):
                reject("source manifest does not cover all lecture photos")
    except (zipfile.BadZipFile, EOFError, RuntimeError) as error:
        reject("invalid source-photo ZIP: " + str(error))
    return len(actual), sum(actual.values())


def main():
    parser = ArgumentParser(description="Audit a PRIVATE original-PDF JPEG ZIP against reviewed lecture JSON")
    parser.add_argument("--lecture", required=True, type=Path)
    parser.add_argument("--private-zip", required=True, type=Path)
    args = parser.parse_args()
    try:
        lecture = json.loads(args.lecture.read_text(encoding="utf-8"))
        count, size = audit_zip(lecture, args.private_zip)
    except (ValueError, OSError, UnicodeError) as error:
        print("SOURCE PHOTO PACK CHECK FAILED: " + str(error), file=sys.stderr)
        raise SystemExit(1)
    print(f"VERIFIED: {count} original PDF figures ({size:,} source JPEG bytes)")
    print("Photo hashes, names and printed-page provenance match. Nothing was uploaded or extracted.")


if __name__ == "__main__":
    main()
