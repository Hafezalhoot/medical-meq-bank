#!/usr/bin/env python3
"""Safely prepare many unpublished, lecture-first JSON drafts from one manifest."""

from argparse import ArgumentParser
import json
from pathlib import Path

import new_lecture as intake

ALLOWED_FIELDS = {"course", "subject", "title", "source", "id", "order"}


def plan_manifest(manifest: Path) -> list[tuple[dict, Path]]:
    try:
        rows = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        intake.fail(f"cannot read lecture manifest: {error}")
    if not isinstance(rows, list) or not rows:
        intake.fail("manifest must be a non-empty JSON array of lecture entries")

    planned: list[tuple[dict, Path]] = []
    for index, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            intake.fail(f"manifest entry {index} must be an object")
        unknown = sorted(set(row) - ALLOWED_FIELDS)
        if unknown:
            intake.fail(f"manifest entry {index} has unsupported fields: {', '.join(unknown)}")

        draft = intake.prepare_draft(
            course=row.get("course"),
            subject_key=row.get("subject"),
            title=row.get("title"),
            source=row.get("source"),
            custom_id=row.get("id"),
            number=row.get("order"),
            planned=[item for item, _ in planned],
        )
        destination = intake.ROOT / "tmp" / "lecture-drafts" / f"{draft['id']}.json"
        if destination.exists():
            intake.fail(f"draft already exists; never overwrite: {destination}")
        planned.append((draft, destination))
    return planned


def write_planned(planned: list[tuple[dict, Path]]) -> None:
    """Create exclusively, undoing this batch if any write fails."""
    created: list[Path] = []
    try:
        for draft, path in planned:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("x", encoding="utf-8") as handle:
                created.append(path)
                handle.write(json.dumps(draft, ensure_ascii=False, indent=2) + "\n")
    except (OSError, UnicodeError) as error:
        for path in reversed(created):
            path.unlink(missing_ok=True)
        intake.fail(f"batch draft creation failed; new files rolled back: {error}")


def main() -> None:
    parser = ArgumentParser(
        description="Plan many source-only lecture drafts; never publish or generate medical facts."
    )
    parser.add_argument("manifest", type=Path, help="Local JSON list of course, subject, title and PDF filename")
    parser.add_argument(
        "--write", action="store_true",
        help="Create the unpublished drafts only; default is a non-writing preview",
    )
    args = parser.parse_args()
    planned = plan_manifest(args.manifest)
    preview = [
        {
            "canonicalId": f"{draft['courseId']}/{draft['subjectKey']}/{draft['id']}",
            "order": draft["order"],
            "source": draft["sourceNote"].split(";")[0],
            "draft": str(path),
        }
        for draft, path in planned
    ]
    print(json.dumps({"mode": "draft-write" if args.write else "dry-run", "lectures": preview},
                     ensure_ascii=False, indent=2))
    if args.write:
        write_planned(planned)
        print(f"Created {len(planned)} unpublished drafts. Medical content and approval are still required.")
    else:
        print("No files changed. Run again with --write to create the unpublished drafts.")


if __name__ == "__main__":
    main()
