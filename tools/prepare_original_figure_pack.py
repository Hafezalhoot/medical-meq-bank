#!/usr/bin/env python3
"""Build a PRIVATE source-photo ZIP from ORIGINAL printed images inside a PDF.

This program never fabricates a medical figure, renders an annotated page,
uploads anything, or updates an exam answer. Crop coordinates and their
association to question IDs must be checked against the printed source.
Requires optional dependencies: PyMuPDF and Pillow.
"""

from __future__ import annotations

from argparse import ArgumentParser
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
import os
import re
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MAX_JPEG = 5 * 1024 * 1024
MAX_ARCHIVE = 32 * 1024 * 1024


def fail(message: str) -> None:
    raise SystemExit("ORIGINAL FIGURES FAILED: " + message)


def load_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"cannot read source metadata {path}: {exc}")
    if not isinstance(data, dict):
        fail(f"expected a JSON object: {path}")
    return data


def bounds(value: object) -> tuple[float, float, float, float]:
    if not isinstance(value, list) or len(value) != 4:
        fail("every image needs four normalized crop coordinates")
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in value):
        fail("all crop coordinates must be numbers")
    x0, y0, x1, y1 = (float(v) for v in value)
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        fail(f"invalid normalized crop rectangle: {value}")
    return x0, y0, x1, y1


def original_printed_scan(doc, page_number: int):
    """Return an actual JPEG covering most of a PDF page, not annotation layers.

    A vector/native-text page, or any page with no full-page background scan,
    is intentionally rejected. Never silently render overlays/handwriting.
    """
    try:
        page = doc[page_number - 1]
    except (IndexError, ValueError):
        fail(f"PDF page {page_number} does not exist")
    candidates = []
    for image in page.get_images(full=True):
        xref, width, height = image[0], image[2], image[3]
        rectangles = page.get_image_rects(xref)
        coverage = max((r.get_area() / page.rect.get_area() for r in rectangles), default=0)
        if coverage < 0.75 or width < 500 or height < 500:
            continue
        payload = doc.extract_image(xref)
        if payload.get("ext") != "jpeg":
            continue
        candidates.append((coverage, width * height, payload["image"]))
    if not candidates:
        fail(f"page {page_number} has no verified full-page printed JPEG; manually review this PDF")
    candidates.sort(key=lambda entry: (entry[0], entry[1]), reverse=True)
    from PIL import Image
    try:
        scan = Image.open(BytesIO(candidates[0][2]))
        scan.load()
    except Exception as exc:
        fail(f"cannot decode original printed page {page_number}: {exc}")
    return scan.convert("RGB")


def produce(pdf: Path, lecture_json: Path, crop_map: Path) -> tuple[list[tuple[str, bytes]], dict, dict]:
    try:
        import fitz  # PyMuPDF: optional lecture-intake dependency, not app dependency
        from PIL import Image
    except ImportError:
        fail("install private-intake dependencies: pip install pymupdf Pillow")

    metadata = load_json(crop_map)
    lecture = load_json(lecture_json)
    items = metadata.get("items")
    if not isinstance(items, list) or not items:
        fail("crop map must contain a nonempty 'items' array")
    questions = lecture.get("imageQuestions")
    if not isinstance(questions, list) or not questions:
        fail("lecture has no imageQuestions")
    by_id = {q.get("id"): q for q in questions if isinstance(q, dict)}
    if len(by_id) != len(questions):
        fail("lecture has duplicate or invalid image-question IDs")
    if len(items) > 100:
        fail("too many clinical photos in one package")

    try:
        document = fitz.open(pdf)
    except Exception as exc:
        fail(f"cannot open PDF source: {exc}")
    try:
        actual_pdf_hash = sha256(pdf.read_bytes()).hexdigest()
        prepared, provenance, seen = [], [], set()
        for item in items:
            if not isinstance(item, dict):
                fail("crop map entries must be objects")
            ident, page = item.get("id"), item.get("sourcePage")
            if not isinstance(ident, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", ident):
                fail(f"unsafe medical image ID: {ident!r}")
            if ident in seen or ident not in by_id:
                fail(f"duplicate or unknown image ID in crop map: {ident}")
            seen.add(ident)
            if not isinstance(page, int) or isinstance(page, bool) or page < 1 or page > document.page_count:
                fail(f"{ident}: invalid printed PDF page")
            question = by_id[ident]
            if question.get("image"):
                fail(f"{ident}: source-only private photos cannot replace already-published images")
            reference = str(question.get("page", ""))
            printed_pages = re.findall(r"\d+", reference)
            if not printed_pages or str(page) not in printed_pages:
                fail(f"{ident}: crop page {page} is not listed in question page attribution {reference!r}")
            left, top, right, bottom = bounds(item.get("cropNormalized"))
            scan = original_printed_scan(document, page)
            width, height = scan.size
            crop = scan.crop((
                round(left * width), round(top * height),
                round(right * width), round(bottom * height),
            ))
            if crop.width < 48 or crop.height < 48:
                fail(f"{ident}: original crop is too small; check bounds")
            output = BytesIO()
            crop.save(output, format="JPEG", quality=94, optimize=True)
            raw = output.getvalue()
            if len(raw) < 300 or len(raw) > MAX_JPEG:
                fail(f"{ident}: private JPEG outside 300 B – 5 MB limit")
            digest = sha256(raw).hexdigest()
            existing = question.get("imageSha256")
            if existing is not None and not re.fullmatch(r"[a-f0-9]{64}", str(existing)):
                fail(f"{ident}: invalid existing source hash")
            filename = ident + ".jpg"
            prepared.append((filename, raw))
            provenance.append({
                "id": ident, "filename": filename, "sourcePage": page,
                "cropNormalized": [left, top, right, bottom], "sha256": digest,
                "imageBytes": len(raw), "description": str(item.get("description", "")).strip(),
            })
        if seen != set(by_id):
            fail("crop map must cover every image question: missing " + ", ".join(sorted(set(by_id) - seen)))
        summary = {
            "type": "private-original-source-figures",
            "lectureId": lecture.get("id"),
            "source": pdf.name,
            "sourcePdfSha256": actual_pdf_hash,
            "note": "Original printed PDF JPEG layer only. Page/crop mapping needs human review. Not licensed for public redistribution.",
            "items": provenance,
        }
        return prepared, summary, lecture
    finally:
        document.close()


def main() -> None:
    parser = ArgumentParser(description="Prepare private, source-only original JPEG photos; no generated medical images")
    parser.add_argument("--source-pdf", type=Path, required=True, help="User-supplied source PDF, not a generated rendering")
    parser.add_argument("--lecture", type=Path, required=True, help="Reviewed canonical lecture JSON")
    parser.add_argument("--crop-map", type=Path, required=True, help="Human-reviewed per-item page and normalized crop coordinates")
    parser.add_argument("--private-zip", type=Path, required=True, help="Output ZIP OUTSIDE public repository")
    parser.add_argument("--write-reviewed-hashes", action="store_true", help="Update hashes in the local lecture JSON AFTER reviewing all crops")
    parser.add_argument("--replace-existing-hashes", action="store_true", help="Explicitly permit changed crop hashes; requires --write-reviewed-hashes")
    args = parser.parse_args()
    if args.replace_existing_hashes and not args.write_reviewed_hashes:
        fail("--replace-existing-hashes requires --write-reviewed-hashes")
    pdf, lecture_path, map_path, out = (
        args.source_pdf.resolve(), args.lecture.resolve(), args.crop_map.resolve(),
        args.private_zip.resolve(),
    )
    if not pdf.is_file() or not lecture_path.is_file() or not map_path.is_file():
        fail("source PDF, lecture JSON and crop map must exist")
    if out.is_relative_to(ROOT):
        fail("private clinical-photo ZIP must be OUTSIDE the public repository")
    if out.exists():
        fail("private ZIP already exists; choose a new output name instead of overwriting")
    photos, manifest, lecture = produce(pdf, lecture_path, map_path)
    if not manifest.get("lectureId"):
        fail("lecture JSON must have a stable ID")
    by_id = {q["id"]: q for q in lecture["imageQuestions"]}
    for item in manifest["items"]:
        old = by_id[item["id"]].get("imageSha256")
        if old and old != item["sha256"] and not args.replace_existing_hashes:
            fail(f"{item['id']}: crop bytes differ from previously reviewed SHA-256; inspect original photos, then explicitly approve replacements")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=out.parent, suffix=".source-tmp", delete=False) as tmp:
        staging = Path(tmp.name)
    try:
        with zipfile.ZipFile(staging, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for filename, raw in photos:
                z.writestr("original-figures/" + filename, raw)
            z.writestr("original-figures/manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            z.writestr("original-figures/README.txt", (
                "PRIVATE ORIGINAL PHOTO PACK — source PDF only. Do not publicly redistribute.\n"
                "Import this ZIP into the MEQ lecture page, or extract the JPEGs and select them.\n"
                "Compare sourcePage/cropNormalized with the printed lecture before exam use.\n"
            ))
        if staging.stat().st_size > MAX_ARCHIVE:
            fail("ZIP exceeds browser's 32 MB limit; prepare a smaller reviewed crop package")
        if args.write_reviewed_hashes:
            for item in manifest["items"]:
                question = by_id[item["id"]]
                question["imageSha256"] = item["sha256"]
                question["imageBytes"] = item["imageBytes"]
            payload = json.dumps(lecture, ensure_ascii=False, indent=2) + "\n"
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=lecture_path.parent,
                suffix=".json-tmp", delete=False,
            ) as tmp:
                tmp.write(payload)
                staged_json = Path(tmp.name)
            try:
                os.replace(staged_json, lecture_path)
            finally:
                staged_json.unlink(missing_ok=True)
        os.replace(staging, out)
    finally:
        staging.unlink(missing_ok=True)
    print(f"Prepared {len(photos)} original figures from {pdf.name} for {manifest['lectureId']}")
    print(f"Private source ZIP: {out} ({out.stat().st_size:,} bytes)")
    print("Source PDF SHA-256:", manifest["sourcePdfSha256"])
    print("Photo hashes " + ("written to reviewed lecture" if args.write_reviewed_hashes else "reported in private manifest only"))
    print("REVIEW REQUIRED: printed image accuracy, page matching and publication permissions.")


if __name__ == "__main__":
    main()
