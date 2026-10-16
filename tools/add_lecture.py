#!/usr/bin/env python3
"""Validate and register one canonical lecture source with the MEQ Bank."""

from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import json
import os
import re
import base64
import binascii
import math
import tempfile

from lecture_builder import LECTURE_LIST_KEYS, validate_lecture, validate_safe_svg

ROOT = Path(__file__).resolve().parents[1]
LECTURES = ROOT / "lectures"
COURSES = ROOT / "courses"
CATALOG_PATH = LECTURES / "catalog.json"


def fail(message: str) -> None:
    raise SystemExit(f"ADD LECTURE FAILED: {message}")


def read_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"cannot read {path}: {error}")


def render_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def commit_checked_files(changes: dict[Path, str]) -> None:
    """Stage every output first, then install with rollback on a failed write.

    Multiple paths cannot be renamed as one atomic filesystem operation;
    rollback makes ordinary I/O failures safe. Review changes in Git before commit.
    """
    staged: dict[Path, Path] = {}
    installed: list[tuple[Path, bytes | None]] = []
    try:
        for path, content in changes.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=path.parent,
                prefix=f".{path.name}.", suffix=".intake-tmp", delete=False,
            ) as handle:
                handle.write(content)
                staged[path] = Path(handle.name)
        for path, temporary in staged.items():
            previous = path.read_bytes() if path.exists() else None
            os.replace(temporary, path)
            installed.append((path, previous))
    except OSError as error:
        for path, previous in reversed(installed):
            if previous is None:
                path.unlink(missing_ok=True)
            else:
                with tempfile.NamedTemporaryFile(
                    mode="wb", dir=path.parent, suffix=".restore-tmp",
                    prefix=f".{path.name}.", delete=False,
                ) as restore:
                    restore.write(previous)
                    rollback_path = Path(restore.name)
                os.replace(rollback_path, path)
        fail(f"write failed; previous files restored: {error}")
    finally:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)


def validate_image_sources(lecture: dict) -> None:
    """Fail closed on missing/traversing assets and unsafe embedded media."""
    assets = (ROOT / "assets").resolve()
    sources = list(lecture.get("imageQuestions", []))
    infographic = lecture.get("studyGuide", {}).get("infographic")
    if infographic:
        sources.append({"id": f"{lecture['id']}-infographic", "image": infographic["image"]})
    for image in sources:
        source = image.get("image")
        if not isinstance(source, str) or not source.strip():
            continue  # A lecture-page reference may be the whole visual cue.
        if source.startswith("data:"):
            match = re.fullmatch(
                r"data:image/(?:png|jpeg|webp|avif);base64,([A-Za-z0-9+/=\r\n]+)",
                source,
            )
            if not match:
                fail(f"{image['id']}: embedded image must be PNG/JPEG/WebP/AVIF base64")
            try:
                raw = base64.b64decode(match.group(1), validate=False)
            except (ValueError, binascii.Error):
                fail(f"{image['id']}: invalid embedded image")
            if not raw or len(raw) > 15 * 1024 * 1024:
                fail(f"{image['id']}: image is empty or exceeds 15 MB")
            continue
        relative = source.removeprefix("./")
        if not relative.startswith("assets/") or "\\" in relative:
            fail(f"{image['id']}: invalid image path")
        target = (ROOT / relative).resolve()
        if not target.is_relative_to(assets) or not target.is_file():
            fail(f"{image['id']}: referenced image does not exist under assets/")
        if target.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg"}:
            fail(f"{image['id']}: unsupported image extension")
        if target.suffix.lower() == ".svg":
            validate_safe_svg(target)


def course_pack(course_id: str) -> tuple[Path, dict]:
    catalog = read_json(COURSES / "catalog.json")
    entries = catalog.get("courses") if isinstance(catalog, dict) else None
    if not isinstance(entries, list):
        fail("course catalog is invalid")
    entry = next((item for item in entries if isinstance(item, dict) and item.get("id") == course_id), None)
    if not entry or not isinstance(entry.get("pack"), str):
        fail(f"unknown course: {course_id}")
    path = (COURSES / entry["pack"]).resolve()
    if not path.is_relative_to(COURSES.resolve()):
        fail("course pack path escapes courses directory")
    pack = read_json(path)
    if not isinstance(pack, dict) or pack.get("id") != course_id:
        fail(f"course pack does not match {course_id}")
    return path, pack


def main() -> None:
    parser = ArgumentParser(
        description="Validate a canonical lecture JSON file and optionally register it in the bank."
    )
    parser.add_argument("source", type=Path, help="Path to the lecture JSON source")
    parser.add_argument("--course", required=True, help="Course id, for example surgery")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Copy/register the lecture. Without this flag the command is a safe dry-run.",
    )
    parser.add_argument("--reviewed", action="store_true", help="Confirm medical content was checked against the source lecture; required with --write.")
    args = parser.parse_args()
    if args.write and not args.reviewed:
        fail("--write requires --reviewed after lecture-first medical review")

    source_path = args.source.resolve()
    lecture = read_json(source_path)
    if not isinstance(lecture, dict):
        fail("lecture source must be a JSON object")

    lecture_id = lecture.get("id")
    subject_key = lecture.get("subjectKey")
    title = lecture.get("title")
    order = lecture.get("order")
    if not isinstance(lecture_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", lecture_id):
        fail("lecture id must use lowercase letters, numbers and hyphens")
    if not isinstance(subject_key, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", subject_key):
        fail("subjectKey must use lowercase letters, numbers and hyphens")
    if not isinstance(title, str) or not title.strip():
        fail("lecture title is required")
    if not isinstance(order, (int, float)) or isinstance(order, bool) or not math.isfinite(order) or order <= 0:
        fail("lecture order must be a positive finite number")

    pack_path, pack = course_pack(args.course)
    subjects = pack.get("subjects")
    subject = next((
        item for item in subjects if isinstance(item, dict) and item.get("id") == subject_key
    ), None) if isinstance(subjects, list) else None
    if subject is None:
        fail(f"subject {subject_key} is not registered in course {args.course}")
    if lecture.get("subject") != subject.get("label"):
        fail(f"subject name must match course pack label {subject.get('label')!r}")

    counts = {}
    for key in LECTURE_LIST_KEYS:
        value = lecture.get(key)
        if not isinstance(value, list):
            fail(f"lecture is missing list {key}")
        counts[key] = len(value)
    if sum(counts.values()) == 0:
        fail("cannot publish an empty lecture; add reviewed learning items first")

    # Published identity is derived from catalogs. Keep reviewable source content independent.
    medical_source = dict(lecture)
    for key in ("schemaVersion", "courseId", "canonicalId"):
        medical_source.pop(key, None)
    validate_lecture(
        medical_source,
        label=f"Candidate {lecture_id}",
        expected_id=lecture_id,
        expected_counts=counts,
    )
    validate_image_sources(medical_source)
    for key in LECTURE_LIST_KEYS:
        if key == "rapid":
            continue
        for item in medical_source[key]:
            if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", item["id"]):
                fail(f"unsafe study item id: {item['id']!r}")

    catalog = read_json(CATALOG_PATH)
    if (
        not isinstance(catalog, dict)
        or catalog.get("version") != 1
        or catalog.get("schemaVersion") != 2
        or not isinstance(catalog.get("lectures"), list)
    ):
        fail("lecture catalog is invalid")

    entries = catalog["lectures"]
    if any(isinstance(item, dict) and item.get("id") == lecture_id for item in entries):
        fail(f"lecture id already exists: {lecture_id}")
    if any(
        isinstance(item, dict)
        and item.get("courseId") == args.course
        and item.get("subjectKey") == subject_key
        and item.get("order") == order
        for item in entries
    ):
        fail(f"order {order} is already used in {args.course}/{subject_key}")

    relative_file = f"data/{lecture_id}.json"
    entry = {
        "id": lecture_id,
        "title": title,
        "subjectKey": subject_key,
        "order": order,
        "file": relative_file,
        "expectedCounts": counts,
        "courseId": args.course,
        "schemaVersion": 1,
    }

    print(json.dumps({
        "mode": "write" if args.write else "dry-run",
        "canonicalId": f"{args.course}/{subject_key}/{lecture_id}",
        "catalogEntry": entry,
    }, ensure_ascii=False, indent=2))

    if not args.write:
        print("Dry-run passed. Re-run with --write to register this lecture.")
        return

    target = (LECTURES / relative_file).resolve()
    if target.parent != (LECTURES / "data").resolve():
        fail("lecture source target escapes canonical data directory")
    if target.exists() and target != source_path:
        fail(f"target already exists: {target.relative_to(ROOT)}")

    # Validate all mutable inputs before touching any published file.
    changes: dict[Path, str] = {}
    if target != source_path:
        changes[target] = render_json(medical_source)

    entries.append(entry)
    entries.sort(
        key=lambda item: (
            str(item.get("courseId", "")),
            str(item.get("subjectKey", "")),
            float(item.get("order", 0)),
            str(item.get("id", "")),
        )
    )
    changes[CATALOG_PATH] = render_json(catalog)

    if not pack.get("lectureCatalog"):
        pack["lectureCatalog"] = Path(
            os.path.relpath(CATALOG_PATH, start=pack_path.parent)
        ).as_posix()
        changes[pack_path] = render_json(pack)

    # The historical Surgery baseline must remain frozen. A new lecture is
    # additive, not a reason to expand or rewrite the old regression fixture.
    if args.course == "surgery":
        baseline = read_json(COURSES / "packs" / "surgery-baseline.json")
        if not isinstance(baseline, dict) or not isinstance(baseline.get("protectedLectures"), list):
            fail("surgery baseline is invalid")

    commit_checked_files(changes)
    print(f"Registered {lecture_id}. Run 'bash build.sh' and review the Git diff before committing.")


if __name__ == "__main__":
    main()
