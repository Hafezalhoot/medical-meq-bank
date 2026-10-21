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

    if not args.title.strip() or not args.source.strip():
        fail("title and source PDF filename are required")

    _, pack = course_pack(args.course)
    subject = next((s for s in pack["subjects"] if s["id"] == args.subject), None)
    if subject is None:
        fail(f"subject {args.subject} is not registered in {args.course}")

    catalog = read_json(LECTURES / "catalog.json")
    entries = catalog["lectures"]
    # Globally unique by default across courses with the same specialty/title.
    # Explicit --id remains supported for stable legacy or faculty-reviewed IDs.
    lecture_id = args.id or f"{args.course}-{args.subject}-{slug(args.title)}"
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", lecture_id):
        fail("lecture ID must use lowercase letters, digits and hyphens")
    if any(entry["id"] == lecture_id for entry in entries):
        fail(f"lecture id already exists: {lecture_id}")

    used = {entry["order"] for entry in entries
            if entry.get("courseId") == args.course and entry.get("subjectKey") == args.subject}
    order = args.order if args.order is not None else (int(max(used, default=0)) + 1)
    if order <= 0 or order in used:
        fail(f"order {order} is not a positive unused number in {args.course}/{args.subject}")

    draft = {
        "id": lecture_id,
        "order": order,
        "subjectKey": args.subject,
        "subject": subject["label"],
        "title": args.title.strip(),
        "subtitle": "Source-backed lecture study bank",
        "sourceNote": f"PDF source: {Path(args.source).name}; review slide/page references before approval.",
        "subtopics": [{"id": "overview", "label": "Overview — replace with lecture topics"}],
        "cases": [],
        "coreShorts": [],
        "imageQuestions": [],
        "detailedShorts": [],
        "rapid": [],
    }
    destination = args.output or ROOT / "tmp" / "lecture-drafts" / f"{lecture_id}.json"
    destination = destination.resolve()
    if destination.exists():
        fail(f"draft already exists; never overwrite: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Created unpublished draft: {destination}")
    print(f"Next: populate all five learning formats using only {args.source}, review, then run")
    print(f"python3 tools/add_lecture.py {destination} --course {args.course}")
    print(f"python3 tools/add_lecture.py {destination} --course {args.course} --write --reviewed")


if __name__ == "__main__":
    main()
