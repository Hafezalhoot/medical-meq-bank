#!/usr/bin/env python3
"""Publish validated lecture payloads with explicit scoped identity metadata."""

from __future__ import annotations

from pathlib import Path
import json
import sys

from lecture_builder import load_json_lectures

ROOT = Path(__file__).resolve().parents[1]
LECTURES = ROOT / "lectures"


def fail(message: str) -> None:
    raise SystemExit(f"LECTURE PUBLISH FAILED: {message}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/publish_lectures.py <output-directory>")

    output = Path(sys.argv[1])
    output.mkdir(parents=True, exist_ok=True)

    catalog = json.loads((LECTURES / "catalog.json").read_text(encoding="utf-8"))
    entries = catalog.get("lectures")
    if not isinstance(entries, list):
        fail("lecture catalog has no entries")

    lectures = {lecture["id"]: lecture for lecture in load_json_lectures(ROOT)}
    expected_files: set[str] = set()

    for entry in entries:
        if not isinstance(entry, dict):
            fail("lecture catalog contains a non-object entry")
        lecture_id = entry.get("id")
        relative = entry.get("file")
        if not isinstance(lecture_id, str) or lecture_id not in lectures:
            fail(f"missing validated lecture payload for {lecture_id!r}")
        if not isinstance(relative, str) or not relative.startswith("data/"):
            fail(f"invalid publish path for {lecture_id}")
        filename = Path(relative).name
        expected_files.add(filename)
        (output / filename).write_text(
            json.dumps(lectures[lecture_id], ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    unexpected = sorted(
        path.name for path in output.glob("*.json") if path.name not in expected_files
    )
    if unexpected:
        fail("unexpected published lecture files: " + ", ".join(unexpected))

    print(f"Published {len(lectures)} versioned lecture payloads")


if __name__ == "__main__":
    main()
