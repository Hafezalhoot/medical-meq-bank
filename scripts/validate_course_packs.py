#!/usr/bin/env python3
"""Validate independent course packs and compatibility with the protected surgery bank."""

from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
COURSES = ROOT / 'courses'
COUNT_KEYS = ('cases','coreShorts','imageQuestions','detailedShorts','rapid')


def fail(message: str) -> None:
    raise SystemExit(f'COURSE PACK VALIDATION FAILED: {message}')


def load_json(path: Path) -> object:
    if not path.is_file() or path.stat().st_size == 0:
        fail(f'missing or empty file: {path.relative_to(ROOT)}')
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f'invalid JSON in {path.relative_to(ROOT)}: {error}')


def safe_child(base: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative:
        fail('empty relative path')
    resolved = (base / relative).resolve()
    if not resolved.is_relative_to(ROOT.resolve()):
        fail(f'path escapes repository: {relative}')
    return resolved


def main() -> None:
    for schema in ('catalog.schema.json','course-pack.schema.json'):
        load_json(COURSES / schema)

    catalog = load_json(COURSES / 'catalog.json')
    if not isinstance(catalog, dict) or catalog.get('version') != 1:
        fail('courses/catalog.json must be version 1')
    entries = catalog.get('courses')
    if not isinstance(entries, list) or not entries:
        fail('course catalog has no courses')

    course_ids: set[str] = set()
    course_orders: set[float] = set()
    subject_ids: set[str] = set()
    lecture_ids: set[str] = set()
    packs: dict[str, dict] = {}
    catalogs: dict[str, dict] = {}

    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            fail(f'course entry {index} is not an object')
        course_id = entry.get('id')
        label = entry.get('label')
        order = entry.get('order')
        pack_relative = entry.get('pack')
        if not isinstance(course_id, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', course_id):
            fail(f'course entry {index} has invalid id')
        if course_id in course_ids:
            fail(f'duplicate course id: {course_id}')
        if not isinstance(label, str) or not label.strip():
            fail(f'course {course_id} has invalid label')
        if not isinstance(order, (int,float)) or isinstance(order, bool) or float(order) in course_orders:
            fail(f'course {course_id} has invalid or duplicate order')
        pack_path = safe_child(COURSES, pack_relative)
        if pack_path.parent != (COURSES / 'packs').resolve() or pack_path.suffix != '.json':
            fail(f'course {course_id} pack must be a JSON file under courses/packs')
        pack = load_json(pack_path)
        if not isinstance(pack, dict) or pack.get('version') != 1 or pack.get('id') != course_id:
            fail(f'pack {pack_relative} does not match {course_id}')
        if pack.get('label') != label or pack.get('order') != order:
            fail(f'pack metadata differs from catalog for {course_id}')
        subjects = pack.get('subjects')
        if not isinstance(subjects, list) or not subjects:
            fail(f'course {course_id} has no subjects')
        subject_orders: set[float] = set()
        pack_subjects: set[str] = set()
        for subject in subjects:
            if not isinstance(subject, dict):
                fail(f'course {course_id} has invalid subject')
            subject_id = subject.get('id')
            subject_order = subject.get('order')
            if not isinstance(subject_id, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', subject_id):
                fail(f'course {course_id} has invalid subject id')
            if subject_id in subject_ids:
                fail(f'subject belongs to more than one course: {subject_id}')
            if not isinstance(subject.get('label'), str) or not subject['label'].strip():
                fail(f'subject {subject_id} has invalid label')
            if not isinstance(subject_order, (int,float)) or isinstance(subject_order, bool) or float(subject_order) in subject_orders:
                fail(f'subject {subject_id} has invalid or duplicate order')
            subject_ids.add(subject_id)
            pack_subjects.add(subject_id)
            subject_orders.add(float(subject_order))
        if pack.get('defaultSubject') not in pack_subjects:
            fail(f'course {course_id} defaultSubject is not in its subject list')

        lecture_catalog = pack.get('lectureCatalog')
        if lecture_catalog is not None:
            catalog_path = safe_child(pack_path.parent, lecture_catalog)
            lecture_catalog_data = load_json(catalog_path)
            if not isinstance(lecture_catalog_data, dict) or lecture_catalog_data.get('version') != 1:
                fail(f'course {course_id} has invalid lecture catalog')
            lecture_entries = lecture_catalog_data.get('lectures')
            if not isinstance(lecture_entries, list):
                fail(f'course {course_id} lecture catalog has invalid lectures')
            for lecture in lecture_entries:
                if not isinstance(lecture, dict):
                    fail(f'course {course_id} has invalid lecture entry')
                lecture_id = lecture.get('id')
                if not isinstance(lecture_id, str) or not lecture_id:
                    fail(f'course {course_id} has lecture without id')
                if lecture_id in lecture_ids:
                    fail(f'lecture id appears in more than one course pack: {lecture_id}')
                if lecture.get('subjectKey') not in pack_subjects:
                    fail(f'lecture {lecture_id} references subject outside course {course_id}')
                counts = lecture.get('expectedCounts')
                if not isinstance(counts, dict) or set(counts) != set(COUNT_KEYS):
                    fail(f'lecture {lecture_id} has invalid expectedCounts')
                lecture_ids.add(lecture_id)
            catalogs[course_id] = lecture_catalog_data
        packs[course_id] = pack
        course_ids.add(course_id)
        course_orders.add(float(order))

    if catalog.get('defaultCourse') not in course_ids:
        fail('defaultCourse does not exist')
    if 'surgery' not in packs or 'internal-medicine' not in packs:
        fail('required Surgery and Internal Medicine course packs are missing')

    baseline = load_json(COURSES / 'packs' / 'surgery-baseline.json')
    protected = baseline.get('protectedLectures') if isinstance(baseline, dict) else None
    if not isinstance(protected, list) or not protected:
        fail('surgery baseline has no protected lectures')
    current_by_id = {entry['id']: entry for entry in catalogs.get('surgery', {}).get('lectures', [])}
    for expected in protected:
        if not isinstance(expected, dict) or expected.get('id') not in current_by_id:
            fail(f"protected lecture is missing: {expected.get('id') if isinstance(expected, dict) else expected}")
        actual = current_by_id[expected['id']]
        for field in ('title','subjectKey','order','expectedCounts'):
            if actual.get(field) != expected.get(field):
                fail(f"protected lecture changed: {expected['id']} field {field}")

    renal = current_by_id.get('urology-renal-tumors')
    expected_renal = {'cases':12,'coreShorts':30,'imageQuestions':6,'detailedShorts':45,'rapid':30}
    if not renal or renal.get('expectedCounts') != expected_renal:
        fail('Renal Tumors lecture is missing or has unexpected counts')

    course_template = (ROOT / 'src' / 'course-packs.template.js').read_text(encoding='utf-8')
    for marker in ('MEQCourseRegistry', 'subjects.splice(0, subjects.length', 'catalogForSubject', 'allSubjectKeys'):
        if marker not in course_template:
            fail(f'course runtime does not own subject configuration: {marker}')

    dist = ROOT / 'dist'
    if dist.is_dir():
        runtime = (dist / 'course-packs.js').read_text(encoding='utf-8')
        if '/*__COURSE_CONFIG__*/ null' in runtime or 'MEQCourseRegistry' not in runtime:
            fail('generated course runtime is incomplete')
        html = (dist / 'index.html').read_text(encoding='utf-8')
        markers = [
            '<script src="./app.js"></script>',
            '<script id="course-pack-runtime" src="./course-packs.js"></script>',
            '<script src="./lecture-loader.js"></script>',
        ]
        positions = []
        for marker in markers:
            if html.count(marker) != 1:
                fail(f'generated index must contain exactly one {marker}')
            positions.append(html.index(marker))
        if positions != sorted(positions):
            fail('course runtime is not loaded between app.js and lecture-loader.js')
        offline = (dist / 'offline' / 'Medical_MEQ_Review_Bank_Offline.html').read_text(encoding='utf-8')
        if offline.count('id="course-pack-runtime"') != 1 or 'src="./course-packs.js"' in offline:
            fail('standalone offline file does not embed the course runtime')
        worker = (dist / 'service-worker.js').read_text(encoding='utf-8')
        required_course_assets = ['./course-packs.js', './course-packs.css']
        required_course_assets.extend('./' + path.relative_to(ROOT).as_posix() for path in sorted(COURSES.rglob('*.json')))
        for asset in required_course_assets:
            if asset not in worker:
                fail(f'service worker does not pre-cache course asset: {asset}')
        for source_path in sorted(COURSES.rglob('*.json')):
            published = dist / source_path.relative_to(ROOT)
            if load_json(published) != load_json(source_path):
                fail(f'published course config differs: {source_path.relative_to(ROOT)}')

    print(f'Validated {len(course_ids)} course packs, {len(subject_ids)} subjects and {len(lecture_ids)} lectures')


if __name__ == '__main__':
    main()
