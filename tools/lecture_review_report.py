#!/usr/bin/env python3
"""Build a private lecture review checklist; never approve or publish clinical content."""

from argparse import ArgumentParser
from hashlib import sha256
from html import escape
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRACTICE = ("cases", "coreShorts", "imageQuestions", "detailedShorts", "rapid")
BT = chr(96)


def plain(value):
    return escape(str(value or "").replace("\r", " ").replace("\n", " ")[:150]).replace("|", r"\|")


def pdf_fingerprint(path):
    if path.suffix.lower() != ".pdf" or not path.is_file():
        raise SystemExit("Source evidence must be an existing local PDF file")
    digest = sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_report(lecture, pdf_name="", pdf_hash="", page_count=None):
    if not isinstance(lecture, dict) or not isinstance(lecture.get("title"), str):
        raise SystemExit("Lecture draft must have a title")
    guide = lecture.get("studyGuide") or {}
    if not isinstance(guide, dict):
        raise SystemExit("studyGuide must be an object")
    sections = {name: lecture.get(name) or [] for name in PRACTICE}
    sections["explanation"] = guide.get("explanation") or []
    sections["mcqs"] = guide.get("mcqs") or []
    if any(not isinstance(items, list) for items in sections.values()):
        raise SystemExit("Practice and study-guide sections must be lists")
    infographic = guide.get("infographic")
    if infographic is not None and not isinstance(infographic, dict):
        raise SystemExit("Infographic must be an object")

    lines = [
        "# Lecture intake review: " + plain(lecture["title"]), "",
        "**Status: NEEDS SOURCE REVIEW — not an approval or publication certificate.**", "",
        "- Lecture ID: " + plain(lecture.get("id") or "not assigned"),
        "- Source note: " + plain(lecture.get("sourceNote") or "not provided"),
        "- Original PDF: " + (plain(pdf_name) + " (SHA-256 " + BT + pdf_hash + BT + ")" if pdf_hash else "not fingerprinted"),
        "- Reported page count: " + (str(page_count) + " (not independently checked)" if page_count else "not provided"),
        "", "## Draft inventory", "",
        "| Section | Count | Page references provided |",
        "| --- | ---: | ---: |",
    ]
    page_fields = {"imageQuestions": "page", "explanation": "sourcePage", "mcqs": "sourcePage"}
    for name, items in sections.items():
        field = page_fields.get(name)
        traced = sum(isinstance(item, dict) and isinstance(item.get(field), str)
                     and bool(item[field].strip()) for item in items) if field else None
        lines.append(f"| {name} | {len(items)} | {traced if field else 'Not supported in legacy schema'} |")
    lines += [
        "", "## Source-page map (labels must be verified against the original PDF)", "",
        "| Format | Item ID or heading | Claimed page | Reviewer action |",
        "| --- | --- | --- | --- |",
    ]
    missing = []
    rows = 0
    for name in ("explanation", "mcqs", "imageQuestions"):
        for index, item in enumerate(sections[name], 1):
            if not isinstance(item, dict):
                raise SystemExit(f"{name} item {index} must be an object")
            label = item.get("id") or item.get("heading") or f"{name}-{index:02d}"
            page = item.get(page_fields[name])
            if not isinstance(page, str) or not page.strip():
                missing.append(f"{name}: {label}")
                page = "MISSING"
            lines.append(f"| {name} | {plain(label)} | {plain(page)} | Check original PDF |")
            rows += 1
    if infographic is not None:
        page = infographic.get("sourcePage")
        if not isinstance(page, str) or not page.strip():
            missing.append("infographic")
            page = "MISSING"
        lines.append(f"| infographic | Source figure | {plain(page)} | Confirm original and reuse rights |")
        rows += 1
    if not rows:
        lines.append("| — | No page-linked items yet | — | Draft |")
    lines += ["", "## Required human review", ""]
    if not sections["mcqs"]:
        lines.append("- No reviewed MCQ keys: automatic scoring is unavailable for this lecture.")
    for item in missing:
        lines.append("- Source page not supplied for: " + plain(item))
    lines += [
        "- [ ] Check every exam fact, answer and explanation against the original lecture PDF.",
        "- [ ] Check each page label, MCQ answer index and distractor against the printed source.",
        "- [ ] Confirm original image provenance and public redistribution rights before any upload.",
        "- [ ] Run the existing add_lecture.py --course dry-run with no write.",
        "- [ ] Obtain explicit medical review and run --write --reviewed only after approval.",
        "", "**This report does not inspect clinical accuracy, publish source PDFs or modify catalogs.**", "",
    ]
    return "\n".join(lines)


def main():
    parser = ArgumentParser(description="Private source-review checklist for lecture intake.")
    parser.add_argument("draft", type=Path)
    parser.add_argument("--pdf", type=Path, help="Optional original local PDF (fingerprint only, never uploaded)")
    parser.add_argument("--page-count", type=int, help="Optional manually checked PDF page count")
    parser.add_argument("--output", type=Path, help="Default: tmp/lecture-drafts/<draft-name>-review.md")
    args = parser.parse_args()
    if args.page_count is not None and args.page_count <= 0:
        parser.error("--page-count must be positive")
    try:
        draft = json.loads(args.draft.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Cannot read lecture draft: {error}") from error
    fingerprint = pdf_fingerprint(args.pdf) if args.pdf else ""
    report = build_report(draft, args.pdf.name if args.pdf else "", fingerprint, args.page_count)
    target = args.output or ROOT / "tmp" / "lecture-drafts" / (args.draft.stem + "-review.md")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with target.open("x", encoding="utf-8") as stream:
            stream.write(report)
    except FileExistsError as error:
        raise SystemExit(f"Report already exists, choose a different --output path: {target}") from error
    print(f"Created private draft review report: {target}")


if __name__ == "__main__":
    main()
