#!/usr/bin/env python3
"""Validate a local browser intake file and prepare one unpublished empty draft."""
from argparse import ArgumentParser
import json
from pathlib import Path
import re

from add_lecture import ROOT, course_pack, fail
from new_lecture import prepare_draft


def prepare_intake(document):
    if (not isinstance(document, dict)
            or set(document) != {'format', 'version', 'status', 'lecture'}
            or document['format'] != 'medical-library-intake'
            or type(document['version']) is not int or document['version'] != 1
            or document['status'] != 'needs-source-review'):
        fail('unsupported intake format; only version 1 needs-source-review metadata is accepted')
    entry = document['lecture']
    fields = {'course', 'subject', 'title', 'id', 'order', 'source', 'topics'}
    if not isinstance(entry, dict) or not fields <= set(entry) or set(entry) - fields - {'chapterId'}:
        fail('intake lecture has missing or unsupported fields; clinical content is not accepted')
    for key, limit in (('course', 100), ('subject', 100), ('title', 200), ('id', 200), ('source', 180)):
        if not isinstance(entry[key], str) or not entry[key].strip() or len(entry[key]) > limit:
            fail(f'intake {key} is required and must be at most {limit} characters')
    if not re.fullmatch(r'[^/\\\x00-\x1f\x7f]+\.pdf', entry['source'], flags=re.I):
        fail('source must be a PDF filename without folders or control characters')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', entry['id']):
        fail('lecture ID must use single hyphens between lowercase letters and numbers, matching reader links')
    topics = entry['topics']
    if not isinstance(topics, list) or not 1 <= len(topics) <= 60:
        fail('provide 1 to 60 topic headings')
    ids, labels = set(), set()
    for topic in topics:
        if (not isinstance(topic, dict) or set(topic) != {'id', 'label'}
                or not isinstance(topic['id'], str)
                or re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', topic['id']) is None
                or not isinstance(topic['label'], str) or not topic['label'].strip()
                or len(topic['label']) > 160):
            fail('invalid topic heading or stable ID')
        normalized = ' '.join(topic['label'].split()).casefold()
        if topic['id'] in ids or normalized in labels:
            fail('duplicate topic heading or stable ID')
        ids.add(topic['id']); labels.add(normalized)
    _, pack = course_pack(entry['course'])
    subject = next((item for item in pack['subjects'] if item['id'] == entry['subject']), None)
    chapter = entry.get('chapterId')
    if chapter is not None and (not isinstance(chapter, str) or subject is None
            or not any(item['id'] == chapter for item in subject.get('chapters', []))):
        fail('Chapter is not registered in the selected course/specialty')
    draft = prepare_draft(course=entry['course'], subject_key=entry['subject'],
                          title=entry['title'], source=entry['source'],
                          custom_id=entry['id'], number=entry['order'])
    draft['subtopics'] = [{'id': item['id'], 'label': item['label'].strip()} for item in topics]
    if chapter is not None:
        draft['chapterId'] = chapter
    return draft


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('intake', type=Path)
    parser.add_argument('--write', action='store_true', help='Create a private empty draft; never publish')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'tmp' / 'lecture-drafts')
    args = parser.parse_args()
    try:
        if args.intake.stat().st_size > 128 * 1024:
            fail('intake metadata exceeds 128 KB')
        draft = prepare_intake(json.loads(args.intake.read_text(encoding='utf-8')))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail(f'cannot read intake file: {error}')
    target = args.output_dir / (draft['id'] + '.json')
    if target.exists():
        fail(f'draft already exists; never overwrite: {target}')
    print(json.dumps(draft, ensure_ascii=False, indent=2))
    if not args.write:
        print('Preview only. Use --write to create an unpublished draft. Source review is still required.')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    created = False
    try:
        with target.open('x', encoding='utf-8') as handle:
            created = True
            handle.write(json.dumps(draft, ensure_ascii=False, indent=2) + '\n')
    except (OSError, UnicodeError) as error:
        if created:
            target.unlink(missing_ok=True)
        fail(f'cannot create private draft: {error}')
    print(f'Created unpublished draft: {target}')
    print('Next: author content from the original PDF and use the existing source-review workflow.')


if __name__ == '__main__':
    main()
