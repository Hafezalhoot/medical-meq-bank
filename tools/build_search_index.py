#!/usr/bin/env python3
"""Build a compact searchable metadata index without changing medical content."""

from __future__ import annotations

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "lectures" / "catalog.json"


def fail(message: str) -> None:
    raise SystemExit(f"SEARCH INDEX BUILD FAILED: {message}")


def read_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"could not read {path.relative_to(ROOT)}: {error}")


SEARCH_EXCLUDED_FIELDS = {
    "image",
    "imageBytes",
    "imageSha256",
}


def flatten(value: object) -> str:
    """Flatten searchable medical text while excluding binary/image metadata."""
    if isinstance(value, str):
        if value.startswith("data:image/"):
            return ""
        return value
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return " ".join(flatten(item) for item in value)
    if isinstance(value, dict):
        return " ".join(
            flatten(item)
            for key, item in value.items()
            if key not in SEARCH_EXCLUDED_FIELDS
        )
    return ""


def entry(lecture: dict, item_type: str, item_id: str, label: str, payload: object, *, topic: str = "", priority: str = "") -> dict:
    search_text = " ".join((
        str(lecture.get("title", "")),
        str(lecture.get("subject", "")),
        label,
        flatten(payload),
        topic,
        priority,
    ))
    return {
        "lectureId": lecture["id"],
        "lectureTitle": str(lecture.get("title", lecture["id"])),
        "courseId": lecture["courseId"],
        "subjectKey": lecture["subjectKey"],
        "type": item_type,
        "id": item_id,
        "label": label,
        "topic": topic,
        "priority": priority,
        "text": " ".join(search_text.lower().split()),
    }


def build() -> dict:
    catalog = read_json(CATALOG)
    if not isinstance(catalog, dict) or not isinstance(catalog.get("lectures"), list):
        fail("lecture catalog is invalid")

    rows: list[dict] = []
    seen: set[str] = set()
    for metadata in catalog["lectures"]:
        if not isinstance(metadata, dict) or not isinstance(metadata.get("file"), str):
            fail("catalog contains an invalid lecture entry")
        path = ROOT / "lectures" / metadata["file"]
        lecture = read_json(path)
        if not isinstance(lecture, dict) or lecture.get("id") != metadata.get("id"):
            fail(f"lecture metadata mismatch for {metadata.get('id')}")
        course_id = metadata.get("courseId")
        if not isinstance(course_id, str) or not course_id:
            fail(f"lecture {lecture.get('id')} has no courseId in catalog")
        lecture = dict(lecture)
        lecture["courseId"] = course_id

        collections = (
            ("case", "cases", "title"),
            ("core", "coreShorts", "q"),
            ("image", "imageQuestions", "title"),
            ("extra", "detailedShorts", "q"),
        )
        for item_type, key, label_key in collections:
            items = lecture.get(key)
            if not isinstance(items, list):
                fail(f"{lecture['id']} has invalid {key}")
            for item in items:
                if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                    fail(f"{lecture['id']} has an invalid {item_type} item")
                row_key = f"{lecture['id']}::{item_type}::{item['id']}"
                if row_key in seen:
                    fail(f"duplicate search item {row_key}")
                seen.add(row_key)
                rows.append(entry(
                    lecture,
                    item_type,
                    item["id"],
                    str(item.get(label_key, item["id"])),
                    item,
                    topic=str(item.get("topic", "")),
                    priority=str(item.get("priority", "")),
                ))

        rapid = lecture.get("rapid")
        if not isinstance(rapid, list):
            fail(f"{lecture['id']} has invalid rapid recall")
        for index, pair in enumerate(rapid, start=1):
            if not isinstance(pair, list) or len(pair) != 2:
                fail(f"{lecture['id']} has invalid rapid item {index}")
            item_id = f"rapid-{index}"
            rows.append(entry(lecture, "rapid", item_id, str(pair[0]), pair))

    return {
        "version": 1,
        "catalogVersion": catalog.get("version"),
        "items": rows,
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/build_search_index.py <output-directory>")
    output = Path(sys.argv[1])
    output.mkdir(parents=True, exist_ok=True)
    data = build()

    # Guard against accidental binary/base64 duplication in searchable metadata.
    for item in data["items"]:
        text = item.get("text", "")
        if "data:image/" in text or ";base64," in text:
            fail("search index contains embedded image data")

    by_scope: dict[tuple[str, str], list[dict]] = {}
    for item in data["items"]:
        scope = (item["courseId"], item["subjectKey"])
        by_scope.setdefault(scope, []).append(item)

    catalog_entries = []
    for (course_id, subject_key), items in sorted(by_scope.items()):
        filename = f"{course_id}--{subject_key}.json"
        payload = {
            "version": 1,
            "courseId": course_id,
            "subjectKey": subject_key,
            "items": items,
        }
        (output / filename).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        catalog_entries.append({
            "courseId": course_id,
            "subjectKey": subject_key,
            "file": filename,
            "items": len(items),
        })

    (output / "catalog.json").write_text(
        json.dumps(
            {"version": 1, "subjects": catalog_entries},
            ensure_ascii=False,
            separators=(",", ":"),
        ) + "\n",
        encoding="utf-8",
    )
    print(
        f"Generated {len(catalog_entries)} course/subject search indexes "
        f"with {len(data['items'])} total items"
    )


if __name__ == "__main__":
    main()
