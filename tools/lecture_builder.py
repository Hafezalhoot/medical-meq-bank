#!/usr/bin/env python3
"""Load, validate and inject Medical MEQ lecture sources.

Reviewable JSON lectures are the preferred source format. The legacy compressed
payload reader remains temporarily available only to migrate existing lectures
without changing their medical content.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import base64
import gzip
import json
import re
from typing import Iterable


LECTURE_LIST_KEYS = (
    "cases",
    "coreShorts",
    "imageQuestions",
    "detailedShorts",
    "rapid",
)


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
VALID_PRIORITIES = {"High", "Core", "Extended"}


def _non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_lecture(
    lecture: object,
    *,
    label: str,
    expected_id: str | None = None,
    expected_counts: dict[str, int] | None = None,
) -> dict:
    if not isinstance(lecture, dict):
        raise SystemExit(f"{label} lecture is not an object")

    lecture_id = lecture.get("id")
    if not _non_empty_string(lecture_id):
        raise SystemExit(f"{label} lecture is missing a valid id")
    if expected_id is not None and lecture_id != expected_id:
        raise SystemExit(f"{label} lecture has unexpected id: {lecture_id!r}")

    for key in ("title", "subjectKey", "subject"):
        if not _non_empty_string(lecture.get(key)):
            raise SystemExit(f"{label} lecture is missing a valid {key}")
    if not isinstance(lecture.get("order"), (int, float)):
        raise SystemExit(f"{label} lecture has an invalid order")

    subtopics = lecture.get("subtopics")
    if not isinstance(subtopics, list):
        raise SystemExit(f"{label} lecture is missing a subtopics list")
    subtopic_ids: set[str] = set()
    for index, subtopic in enumerate(subtopics, start=1):
        if not isinstance(subtopic, dict):
            raise SystemExit(f"{label} subtopic {index} is not an object")
        subtopic_id = subtopic.get("id")
        if not _non_empty_string(subtopic_id) or not _non_empty_string(subtopic.get("label")):
            raise SystemExit(f"{label} subtopic {index} is incomplete")
        if subtopic_id in subtopic_ids:
            raise SystemExit(f"{label} has duplicate subtopic id: {subtopic_id}")
        subtopic_ids.add(subtopic_id)

    all_item_ids: set[str] = set()
    required_fields = {
        "cases": ("id", "title", "topic", "priority", "marks", "subtopics", "questions", "answer"),
        "coreShorts": ("id", "q", "a", "topic", "priority", "marks", "subtopics"),
        "imageQuestions": ("id", "title", "topic", "priority", "marks", "subtopics", "questions", "answer"),
        "detailedShorts": ("id", "q", "a", "topic", "priority", "marks", "subtopics"),
    }

    for key in LECTURE_LIST_KEYS:
        value = lecture.get(key)
        if not isinstance(value, list):
            raise SystemExit(f"{label} lecture is missing list {key}")
        if expected_counts is not None:
            expected = expected_counts.get(key)
            if expected is not None and len(value) != expected:
                raise SystemExit(f"{label} lecture has {len(value)} {key}; expected {expected}")

        if key == "rapid":
            for index, card in enumerate(value, start=1):
                if not isinstance(card, list) or len(card) != 2 or not all(_non_empty_string(part) for part in card):
                    raise SystemExit(f"{label} rapid card {index} must contain question and answer text")
            continue

        for index, item in enumerate(value, start=1):
            if not isinstance(item, dict):
                raise SystemExit(f"{label} {key} item {index} is not an object")
            for field in required_fields[key]:
                if field not in item:
                    raise SystemExit(f"{label} {key} item {index} is missing {field}")

            item_id = item.get("id")
            if not _non_empty_string(item_id):
                raise SystemExit(f"{label} {key} item {index} has an invalid id")
            if item_id in all_item_ids:
                raise SystemExit(f"{label} has duplicate study item id: {item_id}")
            all_item_ids.add(item_id)

            if not _non_empty_string(item.get("topic")):
                raise SystemExit(f"{label} {item_id} has an invalid topic")
            if not _non_empty_string(item.get("priority")):
                raise SystemExit(f"{label} {item_id} has an invalid priority")
            if not isinstance(item.get("marks"), (int, float)) or item["marks"] < 0:
                raise SystemExit(f"{label} {item_id} has invalid marks")

            item_subtopics = item.get("subtopics")
            if not isinstance(item_subtopics, list) or not all(_non_empty_string(value) for value in item_subtopics):
                raise SystemExit(f"{label} {item_id} has invalid subtopics")
            unknown_subtopics = sorted(set(item_subtopics) - subtopic_ids)
            if unknown_subtopics:
                raise SystemExit(
                    f"{label} {item_id} references unknown subtopics: {', '.join(unknown_subtopics)}"
                )

            if key in {"cases", "imageQuestions"}:
                if not _non_empty_string(item.get("title")):
                    raise SystemExit(f"{label} {item_id} has an invalid title")
                if not isinstance(item.get("questions"), list) or not item["questions"]:
                    raise SystemExit(f"{label} {item_id} has no questions")
                if not isinstance(item.get("answer"), list) or not item["answer"]:
                    raise SystemExit(f"{label} {item_id} has no answer")
            else:
                if not _non_empty_string(item.get("q")):
                    raise SystemExit(f"{label} {item_id} has an invalid question")
                answer = item.get("a")
                if not (_non_empty_string(answer) or (isinstance(answer, list) and bool(answer))):
                    raise SystemExit(f"{label} {item_id} has an invalid answer")

    return lecture


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


def _decode_lecture(encoded: str, spec: LectureSpec, chunk_count: int) -> dict | None:
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

    return validate_lecture(
        lecture,
        label=f"Decoded {spec.label}",
        expected_id=spec.expected_id,
        expected_counts=spec.expected_counts,
    )


def _legacy_excluded_names(lecture_files: list[Path]) -> set[str]:
    excluded: set[str] = set()
    for spec in SPECS:
        excluded.update(
            path.name for path in lecture_files
            if spec.legacy_pattern.fullmatch(path.name)
        )
        excluded.update(spec.loader_names)
    return excluded


def load_legacy_lectures(root: Path | str = Path(".")) -> tuple[list[dict], set[str]]:
    root = Path(root)
    lecture_dir = root / "lectures"
    lecture_files = sorted(lecture_dir.glob("*.js"))
    decoded: list[dict] = []
    excluded = _legacy_excluded_names(lecture_files)

    for spec in SPECS:
        legacy_chunks = [path for path in lecture_files if spec.legacy_pattern.fullmatch(path.name)]
        data_chunks = sorted(lecture_dir.glob(spec.data_glob)) if spec.data_glob else []

        if data_chunks:
            encoded = _read_plain_chunks(data_chunks, spec.label)
            chunk_count = len(data_chunks)
        else:
            encoded = _read_legacy_chunks(legacy_chunks, spec.label) if legacy_chunks else ""
            chunk_count = len(legacy_chunks)

        lecture = _decode_lecture(encoded, spec, chunk_count)
        if lecture:
            decoded.append(lecture)

    return decoded, excluded


def load_json_lectures(root: Path | str = Path(".")) -> list[dict] | None:
    root = Path(root)
    lecture_dir = root / "lectures"
    catalog_path = lecture_dir / "catalog.json"
    if not catalog_path.is_file():
        return None

    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not read lecture catalog: {error}") from error

    if not isinstance(catalog, dict) or catalog.get("version") != 1:
        raise SystemExit("Lecture catalog must be an object with version 1")
    entries = catalog.get("lectures")
    if not isinstance(entries, list) or not entries:
        raise SystemExit("Lecture catalog has no lectures")

    lectures: list[dict] = []
    seen_ids: set[str] = set()
    base = lecture_dir.resolve()
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            raise SystemExit(f"Lecture catalog entry {index} is not an object")
        lecture_id = entry.get("id")
        relative_file = entry.get("file")
        expected_counts = entry.get("expectedCounts")
        if not _non_empty_string(lecture_id) or not _non_empty_string(relative_file):
            raise SystemExit(f"Lecture catalog entry {index} is incomplete")
        if lecture_id in seen_ids:
            raise SystemExit(f"Lecture catalog contains duplicate id: {lecture_id}")
        if not isinstance(expected_counts, dict):
            raise SystemExit(f"Lecture catalog entry {lecture_id} is missing expectedCounts")

        source_path = (lecture_dir / relative_file).resolve()
        if not source_path.is_relative_to(base):
            raise SystemExit(f"Lecture catalog path escapes lectures directory: {relative_file}")
        if not source_path.is_file():
            raise SystemExit(f"Lecture source is missing: {relative_file}")

        try:
            lecture = json.loads(source_path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SystemExit(f"Could not read lecture source {relative_file}: {error}") from error

        lectures.append(
            validate_lecture(
                lecture,
                label=f"JSON {lecture_id}",
                expected_id=lecture_id,
                expected_counts={key: int(value) for key, value in expected_counts.items()},
            )
        )
        seen_ids.add(lecture_id)

    return lectures


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
    excluded = _legacy_excluded_names(lecture_files)
    json_lectures = load_json_lectures(root)
    if json_lectures is None:
        decoded_lectures, legacy_excluded = load_legacy_lectures(root)
        excluded.update(legacy_excluded)
    else:
        decoded_lectures = json_lectures

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
