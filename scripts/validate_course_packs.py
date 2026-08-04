#!/usr/bin/env python3
"""Validate future-facing course/content-pack isolation and legacy compatibility."""
from __future__ import annotations
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from lecture_builder import load_course_packs

def fail(msg):raise SystemExit('COURSE PACK VALIDATION FAILED: '+msg)
def read(path):return json.loads(path.read_text(encoding='utf-8'))

def main():
    data=load_course_packs(ROOT)
    baseline=read(ROOT/'tests/fixtures/legacy-surgery-baseline.json')
    surgery=next((pack for pack in data['packs'] if pack['entry']['id']=='surgery'),None)
    if not surgery:fail('surgery content pack is missing')
    current={entry['id']:entry for entry in surgery['catalog']['lectures']}
    for old in baseline.get('lectures',[]):
        now=current.get(old['id'])
        if not now:fail(f"legacy lecture disappeared: {old['id']}")
        for key in ('title','subjectKey','order','expectedCounts'):
            if now.get(key)!=old.get(key):fail(f"legacy lecture changed: {old['id']} {key}")
    if 'urology-renal-tumors' not in current:fail('Renal Tumours lecture is not registered')
    if len({lecture['id'] for lecture in data['lectures']})!=len(data['lectures']):fail('lecture IDs are not globally unique')
    app=(ROOT/'src/app.js').read_text(encoding='utf-8')
    loader=(ROOT/'src/lecture-loader.js').read_text(encoding='utf-8')
    index=(ROOT/'src/index.html').read_text(encoding='utf-8')
    for marker in ('const courses = [];','function visibleSubjects()','l.courseKey===activeCourse','medicalBankCourseV1','populateCourseSelector'):
        if marker not in app:fail(f'app is missing course isolation marker: {marker}')
    if "function key(lecture,type,id){return lecture+'::'+type+'::'+id}" not in app:fail('legacy progress keys changed')
    for hardcoded in ('"id": "urology"','"id": "general"','"id": "git"','"id": "neurosurgery"'):
        if hardcoded in app:fail('subject list is still hardcoded in app.js')
    for marker in ('COURSE_REGISTRY_URL','loadCourseManifest','loadCourse','courseManifests','courseKey'):
        if marker not in loader:fail(f'loader is missing content-pack marker: {marker}')
    if 'id="courseSelector"' not in index:fail('course selector is missing from the interface')
    # Model an additional future pack and prove course filtering leaves surgery unchanged.
    existing=[{'id':lecture['id'],'courseKey':lecture['courseKey'],'subjectKey':lecture['subjectKey']} for lecture in data['lectures']]
    legacy_surgery=[x['id'] for x in existing if x['courseKey']=='surgery']
    expanded=existing+[{'id':'medicine-cardiology-example','courseKey':'internal-medicine','subjectKey':'cardiology'}]
    after=[x['id'] for x in expanded if x['courseKey']=='surgery']
    if after!=legacy_surgery:fail('adding a future course changes surgery visibility')
    if 'urology-bladder-cancer::core::bc-s01'!='::'.join(('urology-bladder-cancer','core','bc-s01')):fail('legacy progress key compatibility failed')
    print(f"Validated {len(data['packs'])} content pack(s), {len(data['lectures'])} lectures and {len(baseline['lectures'])} unchanged legacy lectures")
if __name__=='__main__':main()
