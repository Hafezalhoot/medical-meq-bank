#!/usr/bin/env python3
"""Prepare a reviewable lecture skeleton for the existing add_lecture workflow.

This does not read or invent medical facts from a PDF. ChatGPT / a human
populates the source-backed sections, then the reviewed registrar imports it.
"""

from argparse import ArgumentParser
from pathlib import Path
import json
import re

from add_lecture import ROOT, LECTURES, course_pack, fail, read_json


def slug(value: str) -> str:
    result = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")
    if not result:
        fail("title must include an ASCII transliteration for its stable slug")
    return result


def pending_drafts() -> list[dict]:
    """Find unpublished drafts so their IDs/orders cannot collide in a busy intake queue."""
    drafts = []
    directory = ROOT / "tmp" / "lecture-drafts"
    for path in sorted(directory.glob("*.json")):
        document = read_json(path)
        if not isinstance(document, dict) or not isinstance(document.get("id"), str):
            fail(f"invalid pending draft (repair or move it before intake): {path}")
        drafts.append(document)
    return drafts


def prepare_draft(
    *, course: str, subject_key: str, title: str, source: str,
    custom_id: str | None = None, number: int | None = None,
    planned: tuple[dict, ...] | list[dict] = (),
) -> dict:
    """Plan a source-only draft; never touch the published catalog or generate facts."""
    if not all(isinstance(value, str) and value.strip()
               for value in (course, subject_key, title, source)):
        fail("course, subject, title and source PDF filename are required")

    _, pack = course_pack(course)
    subjects = pack.get("subjects")
    subject = next(
        (item for item in subjects if isinstance(item, dict) and item.get("id") == subject_key),
        None,
    ) if isinstance(subjects, list) else None
    if subject is None:
        fail(f"subject {subject_key} is not registered in {course}")

    catalog = read_json(LECTURES / "catalog.json")
    entries = catalog.get("lectures") if isinstance(catalog, dict) else None
    if not isinstance(entries, list):
        fail("lecture catalog is invalid")
    lecture_id = custom_id if custom_id is not None else f"{course}-{subject_key}-{slug(title)}"
    if not isinstance(lecture_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", lecture_id):
        fail("lecture ID must use lowercase letters, digits and hyphens")
    if any(isinstance(item, dict) and item.get("id") == lecture_id for item in entries):
        fail(f"lecture id already exists: {lecture_id}")

    queued = pending_drafts() + list(planned)
    if any(item.get("id") == lecture_id for item in queued):
        fail(f"draft already exists with id {lecture_id}")

    def same_subject(item: dict) -> bool:
        if item.get("subjectKey") != subject_key:
            return False
        if item.get("courseId") == course:
            return True
        # Older drafts predate the explicit draft-only courseId field.
        return item.get("courseId") is None and item["id"].startswith(f"{course}-{subject_key}-")

    used = {
        item["order"] for item in entries
        if isinstance(item, dict) and item.get("courseId") == course
        and item.get("subjectKey") == subject_key
    }
    for item in queued:
        if same_subject(item):
            order = item.get("order")
            if not isinstance(order, int) or isinstance(order, bool) or order < 1:
                fail(f"pending draft {item['id']} has an invalid order")
            used.add(order)

    order = number if number is not None else max(used, default=0) + 1
    if not isinstance(order, int) or isinstance(order, bool) or order <= 0 or order in used:
        fail(f"order {order} is not a positive unused number in {course}/{subject_key}")

    return {
        "id": lecture_id,
        "courseId": course,  # Draft identity only; stripped by add_lecture on publication.
        "order": order,
        "subjectKey": subject_key,
        "subject": subject["label"],
        "title": title.strip(),
        "subtitle": "Source-backed lecture study bank",
        "sourceNote": f"PDF source: {Path(source).name}; review slide/page references before approval.",
        "subtopics": [{"id": "overview", "label": "Overview — replace with lecture topics"}],
        "cases": [],
        "coreShorts": [],
        "imageQuestions": [],
        "detailedShorts": [],
        "rapid": [],
    }


def main() -> None:
    parser = ArgumentParser(description="Generate an unpublished lecture JSON skeleton; no medical facts are generated.")
    parser.add_argument("--course", required=True, help="Existing course ID, e.g. surgery")
    parser.add_argument("--subject", required=True, help="Subject ID within that course, e.g. urology")
    parser.add_argument("--title", required=True, help="Human-readable lecture title")
    parser.add_argument("--source", required=True, help="Original source PDF filename for review traceability")
    parser.add_argument("--id", help="Optional globally unique stable lecture ID")
    parser.add_argument("--order", type=int, help="Optional positive lecture number within subject")
    parser.add_argument("--output", type=Path, help="Draft output (default tmp/lecture-drafts/<id>.json)")
    args = parser.parse_args()

    draft = prepare_draft(
        course=args.course, subject_key=args.subject, title=args.title,
        source=args.source, custom_id=args.id, number=args.order,
    )
    destination = (args.output or ROOT / "tmp" / "lecture-drafts" / f"{draft['id']}.json").resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(draft, ensure_ascii=False, indent=2) + "\n")
    except FileExistsError:
        fail(f"draft already exists; never overwrite: {destination}")
    print(f"Created unpublished draft: {destination}")
    print(f"Next: populate all five learning formats using only {args.source}, review, then run")
    print(f"python3 tools/add_lecture.py {destination} --course {args.course}")
    print(f"python3 tools/add_lecture.py {destination} --course {args.course} --write --reviewed")


if __name__ == "__main__":
    main()
