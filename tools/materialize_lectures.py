#!/usr/bin/env python3
"""Convert validated legacy lecture payloads into reviewable JSON files."""

from __future__ import annotations

from pathlib import Path
import json

from lecture_builder import LECTURE_LIST_KEYS, load_legacy_lectures


ROOT = Path(__file__).resolve().parent.parent
LECTURE_DIR = ROOT / "lectures"
DATA_DIR = LECTURE_DIR / "data"
CATALOG_PATH = LECTURE_DIR / "catalog.json"


def file_name_for(lecture_id: str) -> str:
    return f"data/{lecture_id}.json"


def main() -> None:
    lectures, _ = load_legacy_lectures(ROOT)
    if not lectures:
        raise SystemExit("No validated legacy lectures were found to materialize")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    entries = []

    for lecture in sorted(lectures, key=lambda item: (item["subjectKey"], item["order"], item["id"])):
        relative_file = file_name_for(lecture["id"])
        output_path = LECTURE_DIR / relative_file
        output_path.write_text(
            json.dumps(lecture, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        entries.append(
            {
                "id": lecture["id"],
                "file": relative_file,
                "expectedCounts": {
                    key: len(lecture[key])
                    for key in LECTURE_LIST_KEYS
                },
            }
        )
        print(f"Materialized {lecture['id']} -> {relative_file}")

    catalog = {
        "$schema": "./catalog.schema.json",
        "version": 1,
        "lectures": entries,
    }
    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {CATALOG_PATH.relative_to(ROOT)} with {len(entries)} lectures")


if __name__ == "__main__":
    main()
