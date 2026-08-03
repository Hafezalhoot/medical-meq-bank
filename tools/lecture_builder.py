#!/usr/bin/env python3
"""Load, validate and inject reviewable Medical MEQ lecture JSON sources."""

from __future__ import annotations

from pathlib import Path
import json


LECTURE_LIST_KEYS = (
    "cases",
    "coreShorts",
    "imageQuestions",
    "detailedShorts",
    "rapid",
)


def _non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _valid_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate_lecture(
    lecture: object,
    *,
    label: str,
    expected_id: str,
    expected_counts: dict[str, int],
) -> dict:
    if not isinstance(lecture, dict):
        raise SystemExit(f"{label} lecture is not an object")

    lecture_id = lecture.get("id")
    if lecture_id != expected_id:
        raise SystemExit(f"{label} lecture has unexpected id: {lecture_id!r}")

    for key in ("title", "subjectKey", "subject"):
        if not _non_empty_string(lecture.get(key)):
            raise SystemExit(f"{label} lecture is missing a valid {key}")
    if not _valid_number(lecture.get("order")):
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

        expected = expected_counts.get(key)
        if not isinstance(expected, int) or isinstance(expected, bool) or expected < 0:
            raise SystemExit(f"{label} has an invalid expected count for {key}")
        if len(value) != expected:
            raise SystemExit(f"{label} lecture has {len(value)} {key}; expected {expected}")

        if key == "rapid":
            for index, card in enumerate(value, start=1):
                if (
                    not isinstance(card, list)
                    or len(card) != 2
                    or not all(_non_empty_string(part) for part in card)
                ):
                    raise SystemExit(
                        f"{label} rapid card {index} must contain question and answer text"
                    )
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
            if not _valid_number(item.get("marks")) or item["marks"] < 0:
                raise SystemExit(f"{label} {item_id} has invalid marks")

            item_subtopics = item.get("subtopics")
            if (
                not isinstance(item_subtopics, list)
                or not all(_non_empty_string(value) for value in item_subtopics)
            ):
                raise SystemExit(f"{label} {item_id} has invalid subtopics")
            unknown_subtopics = sorted(set(item_subtopics) - subtopic_ids)
            if unknown_subtopics:
                raise SystemExit(
                    f"{label} {item_id} references unknown subtopics: "
                    f"{', '.join(unknown_subtopics)}"
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
                if not (
                    _non_empty_string(answer)
                    or (isinstance(answer, list) and bool(answer))
                ):
                    raise SystemExit(f"{label} {item_id} has an invalid answer")

    return lecture


def load_json_lectures(root: Path | str = Path(".")) -> list[dict]:
    root = Path(root)
    lecture_dir = root / "lectures"
    catalog_path = lecture_dir / "catalog.json"
    if not catalog_path.is_file():
        raise SystemExit("Missing lectures/catalog.json")

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
    seen_files: set[Path] = set()
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
        if set(expected_counts) != set(LECTURE_LIST_KEYS):
            raise SystemExit(
                f"Lecture catalog entry {lecture_id} must define counts for "
                f"{', '.join(LECTURE_LIST_KEYS)}"
            )

        source_path = (lecture_dir / relative_file).resolve()
        if not source_path.is_relative_to(base):
            raise SystemExit(
                f"Lecture catalog path escapes lectures directory: {relative_file}"
            )
        if source_path.suffix != ".json" or source_path.parent != (lecture_dir / "data").resolve():
            raise SystemExit(
                f"Lecture source must be a JSON file under lectures/data: {relative_file}"
            )
        if source_path in seen_files:
            raise SystemExit(f"Lecture catalog reuses source file: {relative_file}")
        if not source_path.is_file():
            raise SystemExit(f"Lecture source is missing: {relative_file}")

        try:
            lecture = json.loads(source_path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SystemExit(
                f"Could not read lecture source {relative_file}: {error}"
            ) from error

        lectures.append(
            validate_lecture(
                lecture,
                label=f"JSON {lecture_id}",
                expected_id=lecture_id,
                expected_counts=expected_counts,
            )
        )
        seen_ids.add(lecture_id)
        seen_files.add(source_path)

    unlisted_files = sorted(
        path.relative_to(lecture_dir).as_posix()
        for path in (lecture_dir / "data").glob("*.json")
        if path.resolve() not in seen_files
    )
    if unlisted_files:
        raise SystemExit(
            "Lecture data files are not listed in catalog.json: "
            + ", ".join(unlisted_files)
        )

    return lectures


def _batch_extension(lectures_to_add: list[dict]) -> str:
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
    lectures = load_json_lectures(root)
    return _batch_extension(lectures)


if __name__ == "__main__":
    print(build_lecture_extensions())
