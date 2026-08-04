(() => {
  const embedded = /*__COURSE_CONFIG__*/ null;
  if (!embedded || !embedded.catalog || !embedded.packs) {
    console.error('Course pack configuration is unavailable.');
    return;
  }

  const catalog = embedded.catalog;
  const packById = new Map(Object.entries(embedded.packs));
  const orderedCourses = [...catalog.courses]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const subjectOwner = new Map();

  for (const course of orderedCourses) {
    const pack = packById.get(course.id);
    if (!pack) continue;
    for (const subject of pack.subjects) subjectOwner.set(subject.id, pack);
  }

  const panel = document.querySelector('.hero-panel');
  const subjectSelector = document.getElementById('subjectSelector');
  const subjectLabel = panel?.querySelector('label[for="subjectSelector"]');
  const subjectHint = panel?.querySelector('.subject-hint');
  const courseLabel = document.createElement('label');
  const courseSelector = document.createElement('select');
  const courseHint = document.createElement('span');

  courseLabel.className = 'hero-panel-label course-panel-label';
  courseLabel.htmlFor = 'courseSelector';
  courseLabel.textContent = 'Medical course';
  courseSelector.id = 'courseSelector';
  courseSelector.className = 'subject-select course-select';
  courseSelector.setAttribute('aria-label', 'Medical course');
  courseSelector.innerHTML = orderedCourses
    .map(course => `<option value="${course.id}">${course.label}</option>`)
    .join('');
  courseHint.className = 'subject-hint course-hint';
  courseHint.textContent = 'Choose the course first, then the specialty and lecture.';

  if (panel && subjectLabel) {
    panel.insertBefore(courseLabel, subjectLabel);
    panel.insertBefore(courseSelector, subjectLabel);
    panel.insertBefore(courseHint, subjectLabel);
    subjectLabel.textContent = 'Subject / specialty';
  }
  if (subjectHint) subjectHint.textContent = 'Choose a specialty to display its lectures and study content.';

  let activeCourse = '';

  const packForCourse = courseId => packById.get(courseId) || null;
  const packForSubject = subjectKey => subjectOwner.get(subjectKey) || null;
  const catalogForSubject = subjectKey => packForSubject(subjectKey)?.lectureCatalogUrl || null;
  const allSubjectKeys = () => orderedCourses.flatMap(course =>
    (packForCourse(course.id)?.subjects || []).map(subject => subject.id)
  );

  const refreshCourseView = () => {
    activeSubtopic = 'all';
    populateSubjectSelector();
    subjectSelector.value = activeSubject;
    populateLectureFilter();
    updateTopicOptions();
    render();
    validateBank();
    setSidebarState();
  };

  const activateCourse = (courseId, options = {}) => {
    const pack = packForCourse(courseId) || packForCourse(catalog.defaultCourse) || packForCourse(orderedCourses[0]?.id);
    if (!pack) return;

    activeCourse = pack.id;
    courseSelector.value = pack.id;
    subjects.splice(0, subjects.length, ...pack.subjects.map(subject => ({...subject})));

    const preserveSubject = options.preserveSubject !== false;
    const remembered = storage.get(`medicalBankSubjectV4:${pack.id}`);
    const candidate = preserveSubject && subjects.some(subject => subject.id === activeSubject)
      ? activeSubject
      : subjects.some(subject => subject.id === remembered)
        ? remembered
        : subjects.some(subject => subject.id === pack.defaultSubject)
          ? pack.defaultSubject
          : subjects[0]?.id || '';

    activeSubject = candidate;
    storage.set('medicalBankCourseV1', pack.id);
    if (activeSubject) {
      storage.set('medicalBankSubjectV4', activeSubject);
      storage.set(`medicalBankSubjectV4:${pack.id}`, activeSubject);
    }

    refreshCourseView();
    document.dispatchEvent(new CustomEvent('meq:course-changed', {
      detail: {courseId: pack.id, subjectKey: activeSubject}
    }));

    if (globalThis.MEQLectureLoader && activeSubject) {
      globalThis.MEQLectureLoader.loadSubject(activeSubject).catch(() => {});
    }
  };

  courseSelector.addEventListener('change', () => {
    activateCourse(courseSelector.value, {preserveSubject: false});
  });

  subjectSelector?.addEventListener('change', () => {
    if (activeCourse && subjectSelector.value) {
      storage.set(`medicalBankSubjectV4:${activeCourse}`, subjectSelector.value);
    }
  });

  const storedCourse = storage.get('medicalBankCourseV1');
  const inferredCourse = packForSubject(activeSubject)?.id;
  const initialCourse = packForCourse(storedCourse)?.id || inferredCourse || catalog.defaultCourse || orderedCourses[0]?.id;

  globalThis.MEQCourseRegistry = Object.freeze({
    catalog,
    courses: orderedCourses,
    packs: packById,
    activateCourse,
    catalogForSubject,
    courseForSubject: subjectKey => packForSubject(subjectKey)?.id || null,
    allSubjectKeys,
    get activeCourse() { return activeCourse; }
  });

  const footer = document.querySelector('.footer');
  if (footer) footer.textContent = 'Medical course → specialty → lecture → subtopic • Independent content packs • Saved progress';

  activateCourse(initialCourse, {preserveSubject: true});
})();
