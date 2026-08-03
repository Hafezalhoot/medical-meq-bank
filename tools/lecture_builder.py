#!/usr/bin/env python3
"""Build validated lecture extensions for the Medical MEQ Bank.

Compressed lecture payloads are decoded during the build so students do not
need browser-side gzip support. Decoded lectures are inserted in one batch,
which also avoids repeated full renders during application startup.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import base64
import gzip
import json
import re
from typing import Iterable


@dataclass(frozen=True)
class LectureSpec:
    label: str
    expected_id: str
    expected_counts: dict[str, int]
    legacy_pattern: re.Pattern[str]
    loader_names: tuple[str, ...]
    data_glob: str | None = None


SPECS = (
    LectureSpec(
        label="TBI",
        expected_id="neurosurgery-traumatic-brain-injury",
        expected_counts={
            "cases": 16,
            "coreShorts": 35,
            "imageQuestions": 10,
            "detailedShorts": 58,
            "rapid": 40,
        },
        legacy_pattern=re.compile(r"neuro-tbi-(?!99)[0-9]{2}\.js"),
        loader_names=("neuro-tbi-99.js",),
        data_glob="neuro-tbi-data-*.b64",
    ),
    LectureSpec(
        label="Scrotal Swelling",
        expected_id="urology-scrotal-swelling",
        expected_counts={
            "cases": 15,
            "coreShorts": 35,
            "imageQuestions": 10,
            "detailedShorts": 58,
            "rapid": 40,
        },
        legacy_pattern=re.compile(r"urology-scrotal-(?!99).+\.js"),
        loader_names=("urology-scrotal-99.js",),
        data_glob="urology-scrotal-data-*.b64",
    ),
    LectureSpec(
        label="Urinary Tract Infection",
        expected_id="urology-urinary-tract-infection",
        expected_counts={
            "cases": 15,
            "coreShorts": 35,
            "imageQuestions": 10,
            "detailedShorts": 58,
            "rapid": 40,
        },
        legacy_pattern=re.compile(r"urology-uti-(?!99)[0-9]{2}\.js"),
        loader_names=("urology-uti-99.js",),
    ),
    LectureSpec(
        label="Urological Emergencies",
        expected_id="urology-urological-emergencies",
        expected_counts={
            "cases": 15,
            "coreShorts": 31,
            "imageQuestions": 10,
            "detailedShorts": 53,
            "rapid": 33,
        },
        legacy_pattern=re.compile(r"urol-emerg-(?!99)[0-9]{2}\.js"),
        loader_names=("urol-emerg-99.js",),
    ),
)


BASE64_PATTERN = re.compile(r"[A-Za-z0-9+/=]+")
LEGACY_CHUNK_PATTERN = re.compile(r"\+\s*'([^']+)'\s*;?\s*$", re.S)


def _normalize_base64(value: str, source: Path, label: str) -> str:
    chunk = "".join(value.split())
    if not chunk or BASE64_PATTERN.fullmatch(chunk) is None:
        raise SystemExit(f"Invalid compressed {label} data chunk: {source}")
    return chunk


def _read_plain_chunks(paths: Iterable[Path], label: str) -> str:
    return "".join(
        _normalize_base64(path.read_text(encoding="ascii"), path, label)
        for path in paths
    )


def _read_legacy_chunks(paths: Iterable[Path], label: str) -> str:
    encoded_parts: list[str] = []
    for path in paths:
        source = path.read_text(encoding="utf-8").strip()
        match = LEGACY_CHUNK_PATTERN.search(source)
        if not match:
            raise SystemExit(f"Could not parse compressed {label} chunk: {path}")
        encoded_parts.append(_normalize_base64(match.group(1), path, label))
    return "".join(encoded_parts)


def _decode_lecture(
    encoded: str,
    spec: LectureSpec,
    chunk_count: int,
) -> dict | None:
    if not encoded:
        return None

    try:
        compressed = base64.b64decode(encoded, validate=True)
        payload = gzip.decompress(compressed).decode("utf-8")
        lecture = json.loads(payload)
    except Exception as error:
        raise SystemExit(
            f"Could not decode compressed {spec.label} lecture during build: {error}; "
            f"chunks={chunk_count}, base64_chars={len(encoded)}, mod4={len(encoded) % 4}"
        ) from error

    if not isinstance(lecture, dict):
        raise SystemExit(f"Decoded {spec.label} lecture is not an object")
    if lecture.get("id") != spec.expected_id:
        raise SystemExit(
            f"Decoded {spec.label} lecture has unexpected id: {lecture.get('id')!r}"
        )
    if not isinstance(lecture.get("title"), str) or not lecture["title"].strip():
        raise SystemExit(f"Decoded {spec.label} lecture is missing a title")
    if not isinstance(lecture.get("subjectKey"), str) or not lecture["subjectKey"].strip():
        raise SystemExit(f"Decoded {spec.label} lecture is missing subjectKey")
    if not isinstance(lecture.get("order"), (int, float)):
        raise SystemExit(f"Decoded {spec.label} lecture has an invalid order")

    for key, expected in spec.expected_counts.items():
        value = lecture.get(key)
        if not isinstance(value, list):
            raise SystemExit(f"Decoded {spec.label} lecture is missing list {key}")
        actual = len(value)
        if actual != expected:
            raise SystemExit(
                f"Decoded {spec.label} lecture has {actual} {key}; expected {expected}"
            )

    return lecture


def _batch_extension(lectures_to_add: list[dict]) -> str:
    if not lectures_to_add:
        return ""

    serialized = json.dumps(
        lectures_to_add,
        ensure_ascii=False,
        separators=(",", ":"),
    ).replace("</", "<\\/")

    return (
        "(() => {\n"
        f"  const incomingLectures = {serialized};\n"
        "  const existingIds = new Set(lectures.map(item => item.id));\n"
        "  const added = incomingLectures.filter(item => !existingIds.has(item.id));\n"
        "  if (!added.length) return;\n"
        "  lectures.push(...added);\n"
        "  lectures.sort((a,b) => a.subjectKey.localeCompare(b.subjectKey) || a.order - b.order);\n"
        "  populateLectureFilter();\n"
        "  updateTopicOptions();\n"
        "  render();\n"
        "  validateBank();\n"
        "  setSidebarState();\n"
        "})();"
    )


def build_lecture_extensions(root: Path | str = Path(".")) -> str:
    root = Path(root)
    lecture_dir = root / "lectures"
    if not lecture_dir.is_dir():
        return ""

    lecture_files = sorted(lecture_dir.glob("*.js"))
    excluded: set[str] = set()
    decoded_lectures: list[dict] = []

    for spec in SPECS:
        legacy_chunks = [
            path for path in lecture_files
            if spec.legacy_pattern.fullmatch(path.name)
        ]
        data_chunks = sorted(lecture_dir.glob(spec.data_glob)) if spec.data_glob else []

        excluded.update(path.name for path in legacy_chunks)
        excluded.update(spec.loader_names)

        if data_chunks:
            encoded = _read_plain_chunks(data_chunks, spec.label)
            chunk_count = len(data_chunks)
        else:
            encoded = _read_legacy_chunks(legacy_chunks, spec.label) if legacy_chunks else ""
            chunk_count = len(legacy_chunks)

        lecture = _decode_lecture(encoded, spec, chunk_count)
        if lecture:
            decoded_lectures.append(lecture)

    raw_extensions = [
        path.read_text(encoding="utf-8")
        for path in lecture_files
        if path.name not in excluded
    ]

    batch = _batch_extension(decoded_lectures)
    if batch:
        raw_extensions.append(batch)

    return "\n\n".join(part for part in raw_extensions if part.strip())


if __name__ == "__main__":
    print(build_lecture_extensions())
