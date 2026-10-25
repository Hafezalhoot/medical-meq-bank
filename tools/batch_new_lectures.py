#!/usr/bin/env python3
"""Prepare a batch of unpublished, source-only lecture drafts from a local JSON manifest.

Never uploads PDFs, adds medical facts, changes catalogs, or publishes lectures.
"""
from argparse import ArgumentParser
import json
from pathlib import Path

from add_lecture import ROOT, fail
from new_lecture import prepare_draft

def plan_batch(entries):
    if not isinstance(entries, list) or not entries:
        fail("manifest must be a non-empty JSON array")
    planned = []
    for index, entry in enumerate(entries, 1):
        if not isinstance(entry, dict) or set(entry) - {"course", "subject", "title", "source", "id", "order"}:
            fail(f"manifest row {index}: unsupported fields or invalid row")
        for key in ("course", "subject", "title", "source"):
            if not isinstance(entry.get(key), str) or not entry[key].strip():
                fail(f"manifest row {index}: {key} is required")
        draft = prepare_draft(
            course=entry["course"], subject_key=entry["subject"], title=entry["title"],
            source=entry["source"], custom_id=entry.get("id"),
            number=entry.get("order"), planned=planned,
        )
        planned.append(draft)
    return planned


def main():
    parser = ArgumentParser(description="Check or prepare multiple lecture drafts without publishing.")
    parser.add_argument("manifest", type=Path, help="Local JSON array of {course,subject,title,source}")
    parser.add_argument("--write", action="store_true", help="Create private draft files after validating the whole batch")
    args = parser.parse_args()
    try:
        entries = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail(f"cannot read manifest: {error}")
    drafts = plan_batch(entries)
    directory = ROOT / "tmp" / "lecture-drafts"
    targets = [directory / f"{draft['id']}.json" for draft in drafts]
    for path in targets:
        if path.exists():
            fail(f"draft already exists: {path}")
    print(json.dumps([
        {"id": draft["id"], "course": draft["courseId"], "subject": draft["subjectKey"],
         "order": draft["order"], "file": str(path)}
        for draft, path in zip(drafts, targets)
    ], ensure_ascii=False, indent=2))
    if not args.write:
        print("Dry-run passed. Use --write to create private draft files; no lectures will be published.")
        return
    directory.mkdir(parents=True, exist_ok=True)
    created = []
    try:
        for path, draft in zip(targets, drafts):
            with path.open("x", encoding="utf-8") as output:
                created.append(path)
                output.write(json.dumps(draft, ensure_ascii=False, indent=2) + "\n")
    except OSError as error:
        for path in created:
            path.unlink(missing_ok=True)
        fail(f"batch creation failed; newly created files rolled back: {error}")
    print(f"Prepared {len(created)} unpublished drafts. Review sources before add_lecture.py --write --reviewed.")


if __name__ == "__main__":
    main()
