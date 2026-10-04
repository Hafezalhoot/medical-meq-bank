#!/usr/bin/env python3
"""Validate and register one canonical lecture source with the MEQ Bank."""

from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import json
import os
import re

from lecture_builder import LECTURE_LIST_KEYS, validate_lecture

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


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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


def baseline_entry(entry: dict) -> dict:
    return {
        "id": entry["id"],
        "title": entry["title"],
        "subjectKey": entry["subjectKey"],
        "order": entry["order"],
        "expectedCounts": entry["expectedCounts"],
    }


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
    args = parser.parse_args()

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
    if not isinstance(order, (int, float)) or isinstance(order, bool):
        fail("lecture order must be numeric")

    pack_path, pack = course_pack(args.course)
    subjects = pack.get("subjects")
    if not isinstance(subjects, list) or subject_key not in {
        item.get("id") for item in subjects if isinstance(item, dict)
    }:
        fail(f"subject {subject_key} is not registered in course {args.course}")

    counts = {}
    for key in LECTURE_LIST_KEYS:
        value = lecture.get(key)
        if not isinstance(value, list):
            fail(f"lecture is missing list {key}")
        counts[key] = len(value)

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
    if target.exists() and target != source_path:
        fail(f"target already exists: {target.relative_to(ROOT)}")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target != source_path:
        write_json(target, medical_source)

    entries.append(entry)
    entries.sort(
        key=lambda item: (
            str(item.get("courseId", "")),
            str(item.get("subjectKey", "")),
            float(item.get("order", 0)),
            str(item.get("id", "")),
        )
    )
    write_json(CATALOG_PATH, catalog)

    if not pack.get("lectureCatalog"):
        pack["lectureCatalog"] = Path(
            os.path.relpath(CATALOG_PATH, start=pack_path.parent)
        ).as_posix()
        write_json(pack_path, pack)

    if args.course == "surgery":
        baseline_path = COURSES / "packs" / "surgery-baseline.json"
        baseline = read_json(baseline_path)
        protected = baseline.get("protectedLectures") if isinstance(baseline, dict) else None
        if not isinstance(protected, list):
            fail("surgery baseline is invalid")
        protected.append(baseline_entry(entry))
        protected.sort(
            key=lambda item: (
                str(item.get("subjectKey", "")),
                float(item.get("order", 0)),
                str(item.get("id", "")),
            )
        )
        write_json(baseline_path, baseline)

    print(
        f"Registered {lecture_id}. Run 'bash build.sh' before committing to verify the full bank."
    )


if __name__ == "__main__":
    main()
