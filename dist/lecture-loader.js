(() => {
  const COURSE_REGISTRY_URL = './courses/catalog.json';
  const loadedLectureIds = new Set(lectures.map(lecture => lecture.id));
  const courseManifests = new Map();
  const courseCatalogs = new Map();
  const subjectLoads = new Map();
  let registryPromise = null;

  const main = document.querySelector('main');
  const empty = document.getElementById('empty');
  const emptyMessage = document.getElementById('emptyMessage');
  const courseSelector = document.getElementById('courseSelector');
  const subjectSelector = document.getElementById('subjectSelector');

  const normalizeLecture = (lecture, courseKey) => {
    if (!lecture || typeof lecture !== 'object') return lecture;
    lecture.courseKey = courseKey;
    for (const key of ['subtopics', 'cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid']) {
      if (!Array.isArray(lecture[key])) lecture[key] = [];
    }
    lecture.cases.forEach(item => {
      if (!Array.isArray(item.questions)) item.questions = [];
      if (!Array.isArray(item.answer)) item.answer = [];
      if (!Array.isArray(item.marking)) item.marking = [];
      if (!Array.isArray(item.subtopics)) item.subtopics = [];
      if (typeof item.scenario !== 'string') item.scenario = '';
      if (typeof item.ar !== 'string') item.ar = '';
      if (typeof item.trap !== 'string') item.trap = '';
      if (typeof item.memory !== 'string') item.memory = '';
    });
    lecture.coreShorts.forEach(item => { if (!Array.isArray(item.subtopics)) item.subtopics = []; });
    lecture.detailedShorts.forEach(item => { if (!Array.isArray(item.subtopics)) item.subtopics = []; });
    lecture.imageQuestions.forEach(item => {
      if (!Array.isArray(item.questions)) item.questions = [];
      if (!Array.isArray(item.answer)) item.answer = [];
      if (!Array.isArray(item.subtopics)) item.subtopics = [];
      if (typeof item.prompt !== 'string') item.prompt = '';
    });
    return lecture;
  };

  lectures.forEach(lecture => normalizeLecture(lecture, lecture.courseKey || 'surgery'));

  const readJson = async url => {
    const response = await fetch(url, {credentials: 'same-origin'});
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.json();
  };

  const setBusy = (busy, label = 'content') => {
    main?.setAttribute('aria-busy', busy ? 'true' : 'false');
    document.documentElement.classList.toggle('lectures-loading', busy);
    if (busy && empty && emptyMessage) {
      empty.classList.add('show');
      emptyMessage.textContent = `Loading ${label}…`;
    }
  };

  const loadRegistry = () => {
    if (!registryPromise) {
      registryPromise = readJson(COURSE_REGISTRY_URL).then(registry => {
        if (!registry || registry.version !== 1 || !Array.isArray(registry.courses) || !registry.courses.length) {
          throw new Error('Invalid course registry');
        }
        const ids = new Set();
        registry.courses.forEach((entry, index) => {
          for (const key of ['id', 'label', 'manifest']) {
            if (typeof entry?.[key] !== 'string' || !entry[key].trim()) throw new Error(`Course entry ${index + 1} has invalid ${key}`);
          }
          if (ids.has(entry.id)) throw new Error(`Duplicate course id ${entry.id}`);
          ids.add(entry.id);
        });
        if (!ids.has(registry.defaultCourse)) throw new Error('Course registry defaultCourse is missing');
        courses.splice(0, courses.length, ...registry.courses
          .map(entry => ({id: entry.id, label: entry.label, order: Number(entry.order) || 0, manifest: entry.manifest}))
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
        if (!ids.has(activeCourse)) activeCourse = registry.defaultCourse;
        storage.set('medicalBankCourseV1', activeCourse);
        populateCourseSelector();
        return registry;
      }).catch(error => { registryPromise = null; throw error; });
    }
    return registryPromise;
  };

  const loadCourseManifest = async courseKey => {
    if (courseManifests.has(courseKey)) return courseManifests.get(courseKey);
    const registry = await loadRegistry();
    const entry = registry.courses.find(item => item.id === courseKey);
    if (!entry) throw new Error(`Unknown course ${courseKey}`);
    const manifestUrl = new URL(entry.manifest, new URL(COURSE_REGISTRY_URL, location.href));
    const manifest = await readJson(manifestUrl.href);
    if (!manifest || manifest.version !== 1 || manifest.id !== courseKey || !Array.isArray(manifest.subjects) || !manifest.subjects.length) {
      throw new Error(`Invalid content pack manifest for ${courseKey}`);
    }
    const subjectIds = new Set();
    manifest.subjects.forEach(subject => {
      if (!subject || typeof subject.id !== 'string' || !subject.id.trim() || typeof subject.label !== 'string' || !subject.label.trim()) {
        throw new Error(`Invalid subject in ${courseKey}`);
      }
      if (subjectIds.has(subject.id)) throw new Error(`Duplicate subject ${courseKey}/${subject.id}`);
      subjectIds.add(subject.id);
    });
    if (!subjectIds.has(manifest.defaultSubject)) throw new Error(`Invalid default subject in ${courseKey}`);
    const course = courses.find(item => item.id === courseKey);
    Object.assign(course, {
      description: manifest.description || '',
      defaultSubject: manifest.defaultSubject,
      lectureCatalog: new URL(manifest.lectureCatalog, manifestUrl).href,
      manifestUrl: manifestUrl.href
    });
    const retained = subjects.filter(subject => subject.courseKey !== courseKey);
    const incoming = manifest.subjects.map(subject => ({
      id: subject.id,
      label: subject.label,
      order: Number(subject.order) || 0,
      courseKey
    }));
    subjects.splice(0, subjects.length, ...retained, ...incoming);
    courseManifests.set(courseKey, manifest);
    return manifest;
  };

  const loadCatalog = async courseKey => {
    if (courseCatalogs.has(courseKey)) return courseCatalogs.get(courseKey);
    await loadCourseManifest(courseKey);
    const course = courses.find(item => item.id === courseKey);
    const catalog = await readJson(course.lectureCatalog);
    if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.lectures)) throw new Error(`Invalid lecture catalog for ${courseKey}`);
    const subjectIds = new Set(subjects.filter(subject => subject.courseKey === courseKey).map(subject => subject.id));
    const ids = new Set();
    catalog.lectures.forEach((entry, index) => {
      for (const key of ['id', 'title', 'subjectKey', 'file']) {
        if (typeof entry?.[key] !== 'string' || !entry[key].trim()) throw new Error(`Lecture entry ${index + 1} has invalid ${key}`);
      }
      if (ids.has(entry.id)) throw new Error(`Duplicate lecture id ${entry.id}`);
      if (!subjectIds.has(entry.subjectKey)) throw new Error(`Unknown subject ${courseKey}/${entry.subjectKey}`);
      ids.add(entry.id);
    });
    const value = {catalog, catalogUrl: course.lectureCatalog};
    courseCatalogs.set(courseKey, value);
    return value;
  };

  const validateLecture = (lecture, entry, courseKey) => {
    if (!lecture || typeof lecture !== 'object' || lecture.id !== entry.id) throw new Error(`Unexpected lecture payload for ${entry.id}`);
    if (lecture.subjectKey !== entry.subjectKey || lecture.title !== entry.title) throw new Error(`Lecture metadata differs from catalog for ${entry.id}`);
    const expected = entry.expectedCounts || {};
    for (const key of ['cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid']) {
      if (!Array.isArray(lecture[key]) || lecture[key].length !== expected[key]) throw new Error(`Lecture ${entry.id} has invalid ${key}`);
    }
    return normalizeLecture(lecture, courseKey);
  };

  const refreshApplication = () => {
    populateCourseSelector();
    populateSubjectSelector();
    lectures.sort((a, b) => {
      const courseA = courses.find(course => course.id === a.courseKey)?.order || 0;
      const courseB = courses.find(course => course.id === b.courseKey)?.order || 0;
      const subjectA = subjects.find(subject => subject.courseKey === a.courseKey && subject.id === a.subjectKey)?.order || 0;
      const subjectB = subjects.find(subject => subject.courseKey === b.courseKey && subject.id === b.subjectKey)?.order || 0;
      return courseA - courseB || subjectA - subjectB || a.order - b.order || a.id.localeCompare(b.id);
    });
    populateLectureFilter();
    updateTopicOptions();
    render();
    validateBank();
    setSidebarState();
    document.dispatchEvent(new CustomEvent('meq:lectures-loaded', {
      detail: {courseKey: activeCourse, subjectKey: activeSubject, lectureIds: visibleLectures().map(lecture => lecture.id)}
    }));
  };

  const loadSubject = (subjectKey, courseKey = activeCourse) => {
    const loadKey = `${courseKey}::${subjectKey}`;
    if (subjectLoads.has(loadKey)) return subjectLoads.get(loadKey);
    const task = (async () => {
      const affectsActiveView = courseKey === activeCourse && subjectKey === activeSubject;
      if (affectsActiveView) setBusy(true, `${currentCourse()?.label || 'course'} / ${visibleSubjects().find(item => item.id === subjectKey)?.label || 'subject'}`);
      try {
        const {catalog, catalogUrl} = await loadCatalog(courseKey);
        const entries = catalog.lectures.filter(entry => entry.subjectKey === subjectKey).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        const missing = entries.filter(entry => !loadedLectureIds.has(entry.id));
        const settled = await Promise.allSettled(missing.map(async entry => {
          const fileUrl = new URL(entry.file, catalogUrl);
          return {entry, lecture: validateLecture(await readJson(fileUrl.href), entry, courseKey)};
        }));
        const failures = [];
        settled.forEach((result, index) => {
          const entry = missing[index];
          if (result.status === 'rejected') { failures.push({entry, error: String(result.reason)}); return; }
          const lecture = result.value.lecture;
          if (!loadedLectureIds.has(lecture.id)) { loadedLectureIds.add(lecture.id); lectures.push(lecture); }
        });
        if (courseKey === activeCourse && subjectKey === activeSubject) refreshApplication();
        if (failures.length) {
          console.error(`Could not load ${courseKey}/${subjectKey}:`, failures);
          document.dispatchEvent(new CustomEvent('meq:lecture-load-errors', {
            detail: {courseKey, subjectKey, lectureIds: failures.map(item => item.entry.id)}
          }));
          if (typeof showToast === 'function') showToast(`${failures.length} lecture${failures.length === 1 ? '' : 's'} could not be loaded.`);
        }
        return {loaded: entries.map(entry => entry.id).filter(id => loadedLectureIds.has(id)), failed: failures.map(item => item.entry.id)};
      } finally {
        if (affectsActiveView && courseKey === activeCourse && subjectKey === activeSubject) setBusy(false);
      }
    })().catch(error => { subjectLoads.delete(loadKey); throw error; });
    subjectLoads.set(loadKey, task);
    return task;
  };

  const loadCourse = async courseKey => {
    await loadCourseManifest(courseKey);
    if (courseKey === activeCourse) {
      populateCourseSelector();
      populateSubjectSelector();
      storage.set('medicalBankSubjectV4', activeSubject);
      refreshApplication();
      return loadSubject(activeSubject, courseKey);
    }
    return {loaded: [], failed: []};
  };

  const loadAll = async () => {
    const registry = await loadRegistry();
    for (const entry of registry.courses) await loadCourseManifest(entry.id);
    const tasks = [];
    for (const course of courses) {
      for (const subject of subjects.filter(item => item.courseKey === course.id)) tasks.push(loadSubject(subject.id, course.id));
    }
    const results = await Promise.allSettled(tasks);
    refreshApplication();
    return {lectureIds: [...loadedLectureIds], failedLoads: results.filter(result => result.status === 'rejected').length};
  };

  courseSelector?.addEventListener('change', () => {
    loadCourse(courseSelector.value).catch(error => {
      console.error('Could not switch course', error);
      if (typeof showToast === 'function') showToast('The selected course could not be loaded.');
    });
  });
  subjectSelector?.addEventListener('change', () => {
    loadSubject(subjectSelector.value, activeCourse).catch(error => {
      console.error('Could not switch subject', error);
      if (typeof showToast === 'function') showToast('The selected subject could not be loaded.');
    });
  });

  globalThis.MEQLectureLoader = Object.freeze({
    loadRegistry,
    loadCourseManifest,
    loadCatalog,
    loadCourse,
    loadSubject,
    loadAll,
    isLoaded: lectureId => loadedLectureIds.has(lectureId),
    loadedLectureIds,
    courseManifests
  });

  (async () => {
    try {
      setBusy(true, 'medical courses');
      await loadRegistry();
      await loadCourse(activeCourse);
    } catch (error) {
      console.error('Could not initialize Medical MEQ Bank', error);
      if (empty && emptyMessage) {
        empty.classList.add('show');
        emptyMessage.textContent = 'The medical course configuration could not be loaded.';
      }
    } finally {
      setBusy(false);
    }
  })();
})();
