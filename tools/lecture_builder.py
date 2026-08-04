#!/usr/bin/env python3
"""Validate course content packs and build the standalone lecture bootstrap."""
from __future__ import annotations
from pathlib import Path
import base64, copy, json

COUNT_KEYS=("cases","coreShorts","imageQuestions","detailedShorts","rapid")
VALID_PRIORITIES={"High","Core"}

def fail(message:str): raise SystemExit(message)
def read_json(path:Path):
    if not path.is_file(): fail(f"Missing JSON file: {path}")
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e: fail(f"Could not read {path}: {e}")
def nonempty(v): return isinstance(v,str) and bool(v.strip())
def number(v): return isinstance(v,(int,float)) and not isinstance(v,bool)
def string_list(v,allow_empty=False): return isinstance(v,list) and (allow_empty or bool(v)) and all(nonempty(x) for x in v)
def safe_resolve(base:Path,relative:str,root:Path,label:str)->Path:
    if not nonempty(relative): fail(f"{label} path is missing")
    path=(base/relative).resolve()
    if not path.is_relative_to(root.resolve()): fail(f"{label} escapes repository: {relative}")
    return path

def validate_lecture(lecture,*,entry,course_key,label):
    if not isinstance(lecture,dict) or lecture.get('id')!=entry.get('id'): fail(f"{label} has an unexpected lecture id")
    for field in ('title','subjectKey','subject','subtitle','sourceNote'):
        if not nonempty(lecture.get(field)): fail(f"{label} is missing {field}")
    if lecture['title']!=entry['title'] or lecture['subjectKey']!=entry['subjectKey'] or lecture.get('order')!=entry['order']:
        fail(f"{label} metadata differs from its catalog")
    subtopics=lecture.get('subtopics')
    if not isinstance(subtopics,list) or not subtopics: fail(f"{label} has no subtopics")
    subids=[]
    for sub in subtopics:
        if not isinstance(sub,dict) or not nonempty(sub.get('id')) or not nonempty(sub.get('label')): fail(f"{label} has an invalid subtopic")
        subids.append(sub['id'])
    if len(subids)!=len(set(subids)): fail(f"{label} has duplicate subtopics")
    expected=entry.get('expectedCounts')
    if not isinstance(expected,dict) or set(expected)!=set(COUNT_KEYS): fail(f"{label} expectedCounts is invalid")
    item_ids=set()
    for key in COUNT_KEYS:
        value=lecture.get(key)
        if not isinstance(value,list) or len(value)!=expected[key]: fail(f"{label} has invalid {key} count")
        if key=='rapid':
            if any(not isinstance(card,list) or len(card)!=2 or not all(nonempty(part) for part in card) for card in value): fail(f"{label} has an invalid rapid card")
            continue
        for item in value:
            if not isinstance(item,dict) or not nonempty(item.get('id')): fail(f"{label}/{key} has an invalid item")
            if item['id'] in item_ids: fail(f"{label} has duplicate item id {item['id']}")
            item_ids.add(item['id'])
            if not nonempty(item.get('topic')) or item.get('priority') not in VALID_PRIORITIES or not number(item.get('marks')): fail(f"{label}/{item['id']} has invalid shared fields")
            if not string_list(item.get('subtopics')) or set(item['subtopics'])-set(subids): fail(f"{label}/{item['id']} has invalid subtopics")
            if key in ('cases','imageQuestions'):
                if not nonempty(item.get('title')) or not string_list(item.get('questions')) or not string_list(item.get('answer')): fail(f"{label}/{item['id']} has incomplete case/image content")
                if key=='cases' and not nonempty(item.get('scenario')): fail(f"{label}/{item['id']} has no scenario")
                if key=='imageQuestions':
                    image=item.get('image'); page=item.get('page')
                    if not nonempty(image) and not ((nonempty(page) or number(page)) and not isinstance(page,bool)): fail(f"{label}/{item['id']} has no visual")
                    if nonempty(image) and not image.startswith(('data:image/','./assets/','assets/')): fail(f"{label}/{item['id']} has unsupported visual source")
            else:
                answer=item.get('a')
                if not nonempty(item.get('q')) or not (nonempty(answer) or string_list(answer)): fail(f"{label}/{item['id']} has invalid short content")
    result=copy.deepcopy(lecture); result['courseKey']=course_key
    return result

def load_course_packs(root:Path|str=Path('.')):
    root=Path(root).resolve(); course_root=root/'courses'; registry_path=course_root/'catalog.json'
    registry=read_json(registry_path)
    if not isinstance(registry,dict) or registry.get('version')!=1 or not isinstance(registry.get('courses'),list) or not registry['courses']: fail('Course registry must be version 1 and non-empty')
    course_ids=[]; manifests=[]; lectures=[]; assets=['courses/catalog.json']; lecture_ids=set(); catalog_paths=set()
    for reg in registry['courses']:
        if not isinstance(reg,dict) or not all(nonempty(reg.get(k)) for k in ('id','label','manifest')) or not number(reg.get('order')): fail('Invalid course registry entry')
        if reg['id'] in course_ids: fail(f"Duplicate course id: {reg['id']}")
        course_ids.append(reg['id'])
        manifest_path=safe_resolve(course_root,reg['manifest'],root,f"Course {reg['id']} manifest")
        manifest=read_json(manifest_path)
        if not isinstance(manifest,dict) or manifest.get('version')!=1 or manifest.get('id')!=reg['id']: fail(f"Invalid manifest for {reg['id']}")
        for field in ('label','description','defaultSubject','lectureCatalog'):
            if not nonempty(manifest.get(field)): fail(f"Course {reg['id']} is missing {field}")
        subjects=manifest.get('subjects')
        if not isinstance(subjects,list) or not subjects: fail(f"Course {reg['id']} has no subjects")
        subject_ids=[]
        for subject in subjects:
            if not isinstance(subject,dict) or not nonempty(subject.get('id')) or not nonempty(subject.get('label')) or not number(subject.get('order')): fail(f"Course {reg['id']} has invalid subject")
            if subject['id'] in subject_ids: fail(f"Course {reg['id']} has duplicate subject {subject['id']}")
            subject_ids.append(subject['id'])
        if manifest['defaultSubject'] not in subject_ids: fail(f"Course {reg['id']} default subject is not declared")
        catalog_path=safe_resolve(manifest_path.parent,manifest['lectureCatalog'],root,f"Course {reg['id']} lecture catalog")
        if catalog_path in catalog_paths: fail(f"Lecture catalog is reused by multiple courses: {catalog_path}")
        catalog_paths.add(catalog_path)
        catalog=read_json(catalog_path)
        if not isinstance(catalog,dict) or catalog.get('version')!=1 or not isinstance(catalog.get('lectures'),list): fail(f"Invalid lecture catalog for {reg['id']}")
        asset_manifest=manifest_path.relative_to(root).as_posix(); asset_catalog=catalog_path.relative_to(root).as_posix()
        assets.extend([asset_manifest,asset_catalog])
        seen_orders=set()
        for entry in catalog['lectures']:
            if not isinstance(entry,dict) or not all(nonempty(entry.get(k)) for k in ('id','title','subjectKey','file')) or not number(entry.get('order')): fail(f"Invalid lecture entry in {reg['id']}")
            if entry['subjectKey'] not in subject_ids: fail(f"Lecture {entry['id']} uses unknown subject {reg['id']}/{entry['subjectKey']}")
            if entry['id'] in lecture_ids: fail(f"Duplicate global lecture id: {entry['id']}")
            order_key=(entry['subjectKey'],float(entry['order']))
            if order_key in seen_orders: fail(f"Duplicate order {entry['order']} in {reg['id']}/{entry['subjectKey']}")
            seen_orders.add(order_key); lecture_ids.add(entry['id'])
            source_path=safe_resolve(catalog_path.parent,entry['file'],root,f"Lecture {entry['id']}")
            if source_path.suffix!='.json': fail(f"Lecture {entry['id']} is not JSON")
            assets.append(source_path.relative_to(root).as_posix())
            lecture=validate_lecture(read_json(source_path),entry=entry,course_key=reg['id'],label=f"{reg['id']}/{entry['id']}")
            for visual in lecture['imageQuestions']:
                source=visual.get('image')
                if nonempty(source) and source.startswith(('./assets/','assets/')):
                    asset_relative=source[2:] if source.startswith('./') else source
                    asset_path=safe_resolve(root,asset_relative,root,f"Lecture image {entry['id']}/{visual['id']}")
                    if not asset_path.is_file(): fail(f"Lecture image is missing: {asset_relative}")
                    assets.append(asset_relative)
            lectures.append(lecture)
        manifests.append({'entry':reg,'manifest':manifest,'manifestPath':asset_manifest,'catalogPath':asset_catalog,'catalog':catalog})
    if registry.get('defaultCourse') not in course_ids: fail('Course registry defaultCourse is not declared')
    return {'registry':registry,'packs':manifests,'lectures':lectures,'assets':list(dict.fromkeys(assets))}

def build_offline_asset_map(root:Path|str=Path('.'))->str:
    root=Path(root).resolve(); data=load_course_packs(root); mapping={}
    mime_by_suffix={'.avif':'image/avif','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}
    for lecture in data['lectures']:
        for visual in lecture['imageQuestions']:
            source=visual.get('image')
            if not nonempty(source) or source.startswith('data:image/') or not source.startswith(('./assets/','assets/')): continue
            asset_relative=source[2:] if source.startswith('./') else source
            path=safe_resolve(root,asset_relative,root,f"Offline image {lecture['id']}/{visual['id']}")
            mime=mime_by_suffix.get(path.suffix.lower())
            if not mime: fail(f"Unsupported offline image type: {asset_relative}")
            mapping[source]=f"data:{mime};base64,"+base64.b64encode(path.read_bytes()).decode('ascii')
    serialized=json.dumps(mapping,ensure_ascii=False,separators=(',',':')).replace('</',r'<\/')
    return f"globalThis.MEQOfflineAssetMap = Object.freeze({serialized});"

def build_lecture_extensions(root:Path|str=Path('.'))->str:
    data=load_course_packs(root)
    courses=[]; subjects=[]
    for pack in data['packs']:
        reg=pack['entry']; man=pack['manifest']
        courses.append({'id':reg['id'],'label':reg['label'],'order':reg['order'],'description':man['description'],'defaultSubject':man['defaultSubject']})
        subjects.extend({'id':s['id'],'label':s['label'],'order':s['order'],'courseKey':reg['id']} for s in man['subjects'])
    def dump(value):return json.dumps(value,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
    source_lectures=[]; lecture_courses={}
    for lecture in data['lectures']:
        source=copy.deepcopy(lecture); lecture_courses[source['id']]=source.pop('courseKey'); source_lectures.append(source)
    return """(() => {
  const incomingCourses = %s;
  const incomingSubjects = %s;
  const incomingLectureCourses = %s;
  const incomingLectures = %s;
  const existingIds = new Set(lectures.map(item => item.id));
  courses.splice(0, courses.length, ...incomingCourses);
  subjects.splice(0, subjects.length, ...incomingSubjects);
  if (!courses.some(course => course.id === activeCourse)) activeCourse = %s;
  const selectedCourse = courses.find(course => course.id === activeCourse) || courses[0];
  const availableSubjects = subjects.filter(subject => subject.courseKey === selectedCourse?.id);
  if (!availableSubjects.some(subject => subject.id === activeSubject)) {
    activeSubject = availableSubjects.some(subject => subject.id === selectedCourse?.defaultSubject) ? selectedCourse.defaultSubject : (availableSubjects[0]?.id || '');
  }
  incomingLectures.forEach(lecture => {
    lecture.courseKey = incomingLectureCourses[lecture.id];
    for (const key of ['subtopics','cases','coreShorts','imageQuestions','detailedShorts','rapid']) if (!Array.isArray(lecture[key])) lecture[key] = [];
    lecture.cases.forEach(item => {
      if (!Array.isArray(item.questions)) item.questions=[];
      if (!Array.isArray(item.answer)) item.answer=[];
      if (!Array.isArray(item.marking)) item.marking=[];
      if (!Array.isArray(item.subtopics)) item.subtopics=[];
      if (typeof item.scenario !== 'string') item.scenario='';
      if (typeof item.ar !== 'string') item.ar='';
      if (typeof item.trap !== 'string') item.trap='';
      if (typeof item.memory !== 'string') item.memory='';
    });
    lecture.imageQuestions.forEach(item => {
      if (!Array.isArray(item.questions)) item.questions=[];
      if (!Array.isArray(item.answer)) item.answer=[];
      if (!Array.isArray(item.subtopics)) item.subtopics=[];
      if (typeof item.prompt !== 'string') item.prompt='';
    });
    if (!existingIds.has(lecture.id)) { existingIds.add(lecture.id); lectures.push(lecture); }
  });
  storage.set('medicalBankCourseV1', activeCourse);
  storage.set('medicalBankSubjectV4', activeSubject);
  populateCourseSelector();
  populateSubjectSelector();
  populateLectureFilter();
  updateTopicOptions();
  render();
  validateBank();
  setSidebarState();
})();"""%(dump(courses),dump(subjects),dump(lecture_courses),dump(source_lectures),dump(data['registry']['defaultCourse']))

if __name__=='__main__': print(build_lecture_extensions())
