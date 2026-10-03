#!/usr/bin/env python3
"""Generate and inject the course-pack runtime from reviewable JSON configuration."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
COURSES = ROOT / "courses"


def fail(message: str) -> None:
    raise SystemExit(f"COURSE PACK FINALIZATION FAILED: {message}")


def read_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"cannot read {path.relative_to(ROOT)}: {error}")


def load_embedded_registry() -> dict:
    catalog_path = COURSES / "catalog.json"
    catalog = read_json(catalog_path)
    if (
        not isinstance(catalog, dict)
        or catalog.get("version") != 1
        or catalog.get("schemaVersion") != 2
    ):
        fail("courses/catalog.json must be version 1 with schemaVersion 2")
    entries = catalog.get("courses")
    if not isinstance(entries, list) or not entries:
        fail("course catalog has no courses")

    packs: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            fail("course catalog contains a non-object entry")
        course_id = entry.get("id")
        pack_relative = entry.get("pack")
        if not isinstance(course_id, str) or not course_id:
            fail("course entry has no id")
        if not isinstance(pack_relative, str) or not pack_relative:
            fail(f"course {course_id} has no pack path")
        pack_path = (COURSES / pack_relative).resolve()
        if not pack_path.is_relative_to(COURSES.resolve()) or pack_path.suffix != ".json":
            fail(f"course {course_id} uses an unsafe pack path")
        pack = read_json(pack_path)
        if (
            not isinstance(pack, dict)
            or pack.get("id") != course_id
            or pack.get("version") != 1
            or pack.get("schemaVersion") != 2
        ):
            fail(f"course pack {pack_relative} does not match {course_id}")
        prepared = deepcopy(pack)
        lecture_catalog = prepared.get("lectureCatalog")
        if lecture_catalog is not None:
            if not isinstance(lecture_catalog, str) or not lecture_catalog:
                fail(f"course {course_id} has invalid lectureCatalog")
            resolved = (pack_path.parent / lecture_catalog).resolve()
            if not resolved.is_relative_to(ROOT.resolve()) or not resolved.is_file():
                fail(f"course {course_id} lecture catalog is missing or unsafe")
            prepared["lectureCatalogUrl"] = "./" + resolved.relative_to(ROOT).as_posix()
        packs[course_id] = prepared

    return {"catalog": catalog, "packs": packs}


def insert_once(text: str, marker: str, insertion: str, label: str, *, before: bool = True) -> str:
    if insertion in text:
        return text
    if marker not in text:
        fail(f"cannot inject {label}: missing marker")
    return text.replace(marker, insertion + "\n" + marker if before else marker + "\n" + insertion, 1)


def safe_inline_script(source: str) -> str:
    return re.sub(r"</script", r"<\/script", source, flags=re.I)


def safe_inline_style(source: str) -> str:
    return re.sub(r"</style", r"<\/style", source, flags=re.I)


def patch_service_worker(worker: str, assets: list[str]) -> str:
    anchor = "  './app.js',"
    if anchor not in worker:
        fail("generated service worker has no app.js asset anchor")
    missing = [asset for asset in assets if f"  '{asset}'," not in worker]
    if not missing:
        return worker
    addition = "\n".join(f"  '{asset}'," for asset in missing)
    return worker.replace(anchor, anchor + "\n" + addition, 1)


def main() -> None:
    for required in (
        DIST / "index.html",
        DIST / "service-worker.js",
        DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html",
        ROOT / "src" / "course-packs.template.js",
        ROOT / "src" / "course-packs.css",
    ):
        if not required.is_file():
            fail(f"missing {required.relative_to(ROOT)}")

    registry = load_embedded_registry()
    serialized = json.dumps(registry, ensure_ascii=False, separators=(",", ":")).replace("</", "<\/")
    template = (ROOT / "src" / "course-packs.template.js").read_text(encoding="utf-8")
    placeholder = "/*__COURSE_CONFIG__*/ null"
    if template.count(placeholder) != 1:
        fail("course runtime template has an invalid configuration placeholder")
    runtime = template.replace(placeholder, serialized, 1)
    css = (ROOT / "src" / "course-packs.css").read_text(encoding="utf-8")

    (DIST / "course-packs.js").write_text(runtime, encoding="utf-8")
    (DIST / "course-packs.css").write_text(css, encoding="utf-8")

    published_courses = DIST / "courses"
    if published_courses.exists():
        shutil.rmtree(published_courses)
    shutil.copytree(COURSES, published_courses)

    index_path = DIST / "index.html"
    index = index_path.read_text(encoding="utf-8")
    index = insert_once(
        index,
        "</head>",
        '<link id="course-pack-styles" rel="stylesheet" href="./course-packs.css">',
        "course pack stylesheet",
    )
    index = insert_once(
        index,
        '<script src="./lecture-loader.js"></script>',
        '<script id="course-pack-runtime" src="./course-packs.js"></script>',
        "course pack runtime",
    )
    index_path.write_text(index, encoding="utf-8")

    offline_path = DIST / "offline" / "Medical_MEQ_Review_Bank_Offline.html"
    offline = offline_path.read_text(encoding="utf-8")
    offline = insert_once(
        offline,
        "</head>",
        f'<style id="course-pack-styles">\n{safe_inline_style(css)}\n</style>',
        "offline course styles",
    )
    offline = insert_once(
        offline,
        '<script id="lecture-extensions">',
        f'<script id="course-pack-runtime">\n{safe_inline_script(runtime)}\n</script>',
        "offline course runtime",
    )
    offline_path.write_text(offline, encoding="utf-8")

    course_assets = ["./course-packs.js", "./course-packs.css"] + [
        "./" + path.relative_to(ROOT).as_posix()
        for path in sorted(COURSES.rglob("*.json"))
    ]
    worker_path = DIST / "service-worker.js"
    worker = patch_service_worker(worker_path.read_text(encoding="utf-8"), course_assets)
    worker_path.write_text(worker, encoding="utf-8")

    print(f"Generated {len(registry['packs'])} independent course packs")


if __name__ == "__main__":
    main()
