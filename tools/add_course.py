#!/usr/bin/env python3
"""Register an empty medical course without touching any existing study content."""

from argparse import ArgumentParser
from pathlib import Path
import re

from add_lecture import COURSES, commit_checked_files, fail, read_json, render_json

ID = re.compile(r"[a-z0-9][a-z0-9-]*")


def main() -> None:
    parser = ArgumentParser(description="Create an empty course pack (dry-run by default).")
    parser.add_argument("--id", required=True, help="New course ID, e.g. pediatrics")
    parser.add_argument("--label", required=True, help="Course title shown to learners")
    parser.add_argument("--description", default="", help="Optional useful course description")
    parser.add_argument("--subject", required=True, action="append",
                        help="Repeat: specialty-id=Specialty Label")
    parser.add_argument("--write", action="store_true", help="Write reviewed metadata to courses/ packs/catalog")
    args = parser.parse_args()

    if not ID.fullmatch(args.id) or not args.label.strip():
        fail("invalid course id or label")
    catalog_path = COURSES / "catalog.json"
    catalog = read_json(catalog_path)
    if not isinstance(catalog, dict) or catalog.get("schemaVersion") != 2 or catalog.get("version") != 1:
        fail("course catalog contract is invalid")
    entries = catalog.get("courses")
    if not isinstance(entries, list) or not entries:
        fail("course catalog has no registered courses")
    if any(entry["id"] == args.id for entry in entries):
        fail(f"course already registered: {args.id}")

    subjects = []
    for raw in args.subject:
        subject_id, sep, name = raw.partition("=")
        if not sep or not ID.fullmatch(subject_id) or not name.strip():
            fail(f"invalid --subject {raw!r}; use id=Readable label")
        if any(subject["id"] == subject_id for subject in subjects):
            fail(f"duplicate specialty: {subject_id}")
        subjects.append({"id": subject_id, "label": name.strip(), "order": len(subjects) + 1})

    target = (COURSES / "packs" / (args.id + ".json")).resolve()
    if target.parent != (COURSES / "packs").resolve() or target.exists():
        fail(f"course pack already exists or escapes packs: {target}")
    order = max((entry["order"] for entry in entries), default=0) + 1
    pack = {
        "$schema": "../course-pack.schema.json",
        "version": 1, "schemaVersion": 2,
        "id": args.id, "label": args.label.strip(), "order": order,
        "description": args.description.strip(),
        "defaultSubject": subjects[0]["id"],
        "subjects": subjects,
    }
    entries.append({"id": args.id, "label": pack["label"], "order": order,
                    "pack": "packs/" + args.id + ".json"})
    entries.sort(key=lambda entry: entry["order"])
    print(f"Course {args.id}: {len(subjects)} specialties; order={order}")
    if not args.write:
        print("Dry-run only. Re-run with --write to register the empty course.")
        return
    commit_checked_files({
        target: render_json(pack),
        catalog_path: render_json(catalog),
    })
    print(f"Registered {args.id}; new lectures will connect to the shared catalog when reviewed.")


if __name__ == "__main__":
    main()
