#!/usr/bin/env python3
"""Review and apply a Chapter/Specialty metadata draft. Dry-run by default.

Never edits published lecture content, source images or learner progress.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from add_lecture import COURSES, commit_checked_files, read_json, render_json

ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")


def reject(reason: str) -> None:
    raise SystemExit("STRUCTURE DRAFT REJECTED: " + reason)


def valid_item(item: object) -> tuple[str, str]:
    if not isinstance(item, dict) or set(item) != {"id", "label"}:
        reject("item must have only id and label")
    item_id, label = item["id"], item["label"]
    if not isinstance(item_id, str) or len(item_id) > 120 or not ID.fullmatch(item_id):
        reject("invalid stable structure ID")
    if (not isinstance(label, str) or not label.strip() or len(label) > 160
            or any(ord(ch) < 32 or ord(ch) == 127 for ch in label)):
        reject("invalid structure name")
    return item_id, " ".join(label.split())


def prepare_change(data: object, courses_root: Path = COURSES) -> tuple[Path, dict]:
    if not isinstance(data, dict):
        reject("intake must be an object")
    expected_common = {"format", "version", "status", "kind", "course", "item"}
    if data.get("kind") == "chapter":
        expected_common.add("subject")
    if set(data) != expected_common:
        reject("unknown or missing structure fields")
    if data["format"] != "medical-library-structure-intake" or data["version"] != 1:
        reject("unsupported structure format")
    if data["status"] != "needs-review" or data["kind"] not in ("chapter", "specialty"):
        reject("unsupported structure state")
    course_id = data["course"]
    if not isinstance(course_id, str) or not ID.fullmatch(course_id):
        reject("invalid material ID")
    new_id, new_label = valid_item(data["item"])
    catalog = read_json(courses_root / "catalog.json")
    if not isinstance(catalog, dict) or catalog.get("schemaVersion") != 2:
        reject("invalid registered catalog")
    entry = next((row for row in catalog.get("courses", []) if row.get("id") == course_id), None)
    if entry is None:
        reject("unknown material")
    # Never accept a pack path from the user supplied draft or arbitrary catalog entries.
    expected_pack = "packs/" + course_id + ".json"
    if entry.get("pack") != expected_pack:
        reject("registered material pack does not match its ID")
    path = courses_root / "packs" / (course_id + ".json")
    pack = read_json(path)
    if not isinstance(pack, dict) or pack.get("schemaVersion") != 2 or pack.get("id") != course_id:
        reject("course pack contract changed")
    subjects = pack.get("subjects")
    if not isinstance(subjects, list) or not subjects:
        reject("material has no specialties")

    def duplicate(items: list) -> bool:
        return any(item["id"] == new_id or " ".join(item["label"].split()).casefold() == new_label.casefold()
                   for item in items)

    if data["kind"] == "specialty":
        if duplicate(subjects):
            reject("specialty ID or name already exists")
        order = max(item["order"] for item in subjects) + 1
        subjects.append({"id": new_id, "label": new_label, "order": order})
    else:
        subject_id = data["subject"]
        if not isinstance(subject_id, str) or not ID.fullmatch(subject_id):
            reject("invalid specialty ID")
        selected = next((item for item in subjects if item.get("id") == subject_id), None)
        if selected is None:
            reject("unknown specialty within selected material")
        chapters = selected.setdefault("chapters", [])
        if not isinstance(chapters, list):
            reject("invalid chapter list")
        if duplicate(chapters):
            reject("chapter ID or name already exists")
        order = max((item["order"] for item in chapters), default=0) + 1
        chapters.append({"id": new_id, "label": new_label, "order": order})
    return path, pack



def prepare_material_change(data: object, courses_root: Path = COURSES) -> dict[Path, str]:
    """Stage both the registry and new pack; never publish a partially registered material."""
    required = {"format", "version", "status", "kind", "item", "firstSubject"}
    if not isinstance(data, dict) or set(data) != required:
        reject("unknown or missing material fields")
    if (data["format"] != "medical-library-structure-intake" or data["version"] != 1
            or data["status"] != "needs-review" or data["kind"] != "material"):
        reject("unsupported material draft")
    new_id, new_label = valid_item(data["item"])
    first_id, first_label = valid_item(data["firstSubject"])
    registry_path = courses_root / "catalog.json"
    registry = read_json(registry_path)
    if not isinstance(registry, dict) or registry.get("schemaVersion") != 2 or registry.get("version") != 1:
        reject("invalid course catalog")
    entries = registry.get("courses")
    if not isinstance(entries, list) or not entries:
        reject("missing existing materials")
    if any(entry.get("id") == new_id or
           str(entry.get("label", "")).strip().casefold() == new_label.casefold()
           for entry in entries):
        reject("material ID or name already exists")
    pack_path = courses_root / "packs" / (new_id + ".json")
    if pack_path.exists():
        reject("material pack already exists")
    order = max(entry["order"] for entry in entries) + 1
    pack = {
        "$schema": "../course-pack.schema.json", "version": 1, "schemaVersion": 2,
        "id": new_id, "label": new_label, "order": order, "description": "",
        "defaultSubject": first_id,
        "subjects": [{"id": first_id, "label": first_label, "order": 1}]
    }
    entries.append({"id": new_id, "label": new_label, "order": order,
                    "pack": "packs/" + new_id + ".json"})
    entries.sort(key=lambda entry: entry["order"])
    return {registry_path: render_json(registry), pack_path: render_json(pack)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Review a source-neutral library structure draft.")
    parser.add_argument("draft", type=Path, help="Downloaded .structure.json file")
    parser.add_argument("--write", action="store_true", help="Apply after reviewing the dry-run and Git diff")
    args = parser.parse_args()
    draft = read_json(args.draft)
    if isinstance(draft, dict) and draft.get("kind") == "material":
        changes = prepare_material_change(draft)
        location = "new Material"
    else:
        path, pack = prepare_change(draft)
        changes = {path: render_json(pack)}
        location = draft["course"]
    print("Validated", draft["kind"], draft["item"]["id"], "for", location)
    for target in changes:
        print("Target:", target.relative_to(COURSES.parent))
    if not args.write:
        print("Dry-run only; no files changed. Review and rerun with --write to register metadata.")
        return
    commit_checked_files(changes)
    print("Saved reviewed structure metadata; the published clinical lectures were not changed.")


if __name__ == "__main__":
    main()
