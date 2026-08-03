(() => {
  const CATALOG_URL = './lectures/catalog.json';

  const normalizeLecture = lecture => {
    if (!lecture || typeof lecture !== 'object') return lecture;
    for (const key of ['subtopics', 'cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid']) {
      if (!Array.isArray(lecture[key])) lecture[key] = [];
    }
    lecture.cases.forEach(item => {
      if (!Array.isArray(item.questions)) item.questions = [];
      if (!Array.isArray(item.answer)) item.answer = [];
      if (!Array.isArray(item.marking) || !item.marking.length) {
        item.marking = [`Complete lecture-based model answer - ${item.marks || 0} marks`];
      }
      if (!Array.isArray(item.subtopics)) item.subtopics = [];
      if (typeof item.scenario !== 'string') item.scenario = item.title || 'Clinical case';
      if (typeof item.ar !== 'string') item.ar = '';
      if (typeof item.trap !== 'string') item.trap = 'Keep the answer within the lecture pathway.';
      if (typeof item.memory !== 'string') item.memory = item.title || 'Lecture recall';
    });
    lecture.coreShorts.forEach(item => {
      if (!Array.isArray(item.subtopics)) item.subtopics = [];
    });
    lecture.detailedShorts.forEach(item => {
      if (!Array.isArray(item.subtopics)) item.subtopics = [];
    });
    lecture.imageQuestions.forEach(item => {
      if (!Array.isArray(item.questions)) item.questions = [];
      if (!Array.isArray(item.answer)) item.answer = [];
      if (!Array.isArray(item.subtopics)) item.subtopics = [];
      if (typeof item.prompt !== 'string') item.prompt = item.title || 'Identify the illustrated finding.';
    });
    return lecture;
  };

  lectures.forEach(normalizeLecture);
  const loadedLectureIds = new Set(lectures.map(lecture => lecture.id));
  const subjectLoads = new Map();
  let catalogPromise = null;

  const main = document.querySelector('main');
  const empty = document.getElementById('empty');
  const emptyMessage = document.getElementById('emptyMessage');
  const subjectSelector = document.getElementById('subjectSelector');

  const setBusy = (busy, subjectKey = activeSubject) => {
    main?.setAttribute('aria-busy', busy ? 'true' : 'false');
    document.documentElement.classList.toggle('lectures-loading', busy);
    if (busy && subjectKey === activeSubject && empty && emptyMessage) {
      empty.classList.add('show');
      const label = subjects.find(subject => subject.id === subjectKey)?.label || 'this subject';
      emptyMessage.textContent = `Loading ${label} lectures…`;
    }
  };

  const showLoadError = (subjectKey, error) => {
    console.error(`Could not load ${subjectKey} lectures:`, error);
    if (subjectKey === activeSubject && empty && emptyMessage) {
      empty.classList.add('show');
      emptyMessage.textContent = 'Lectures could not be loaded. Check the connection and try again.';
    }
    if (typeof showToast === 'function') {
      showToast('Lectures could not be loaded. Try again while online.');
    }
  };

  const readJson = async url => {
    const response = await fetch(url, {credentials: 'same-origin'});
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    return response.json();
  };

  const loadCatalog = () => {
    if (!catalogPromise) {
      catalogPromise = readJson(CATALOG_URL).then(catalog => {
        if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.lectures)) {
          throw new Error('Invalid lecture catalog');
        }
        const ids = new Set();
        catalog.lectures.forEach((entry, index) => {
          if (!entry || typeof entry !== 'object') {
            throw new Error(`Invalid catalog entry ${index + 1}`);
          }
          for (const key of ['id', 'title', 'subjectKey', 'file']) {
            if (typeof entry[key] !== 'string' || !entry[key].trim()) {
              throw new Error(`Catalog entry ${index + 1} has invalid ${key}`);
            }
          }
          if (ids.has(entry.id)) throw new Error(`Duplicate catalog id ${entry.id}`);
          ids.add(entry.id);
        });
        return catalog;
      }).catch(error => {
        catalogPromise = null;
        throw error;
      });
    }
    return catalogPromise;
  };

  const validateLecture = (lecture, entry) => {
    if (!lecture || typeof lecture !== 'object' || lecture.id !== entry.id) {
      throw new Error(`Unexpected lecture payload for ${entry.id}`);
    }
    if (lecture.subjectKey !== entry.subjectKey || lecture.title !== entry.title) {
      throw new Error(`Lecture metadata differs from catalog for ${entry.id}`);
    }
    const expected = entry.expectedCounts || {};
    for (const key of ['cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid']) {
      if (!Array.isArray(lecture[key]) || lecture[key].length !== expected[key]) {
        throw new Error(`Lecture ${entry.id} has invalid ${key}`);
      }
    }
    return normalizeLecture(lecture);
  };

  const refreshApplication = () => {
    lectures.sort((a, b) =>
      a.subjectKey.localeCompare(b.subjectKey) || a.order - b.order || a.id.localeCompare(b.id)
    );
    populateLectureFilter();
    updateTopicOptions();
    render();
    validateBank();
    setSidebarState();
    document.dispatchEvent(new CustomEvent('meq:lectures-loaded', {
      detail: {
        subjectKey: activeSubject,
        lectureIds: visibleLectures().map(lecture => lecture.id)
      }
    }));
  };

  const loadSubject = subjectKey => {
    if (subjectLoads.has(subjectKey)) return subjectLoads.get(subjectKey);

    const task = (async () => {
      const affectsActiveView = subjectKey === activeSubject;
      if (affectsActiveView) setBusy(true, subjectKey);

      try {
        const catalog = await loadCatalog();
        const entries = catalog.lectures
          .filter(entry => entry.subjectKey === subjectKey)
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

        const missingEntries = entries.filter(entry => !loadedLectureIds.has(entry.id));
        const loaded = await Promise.all(missingEntries.map(async entry => {
          const fileUrl = new URL(entry.file, new URL(CATALOG_URL, location.href));
          return validateLecture(await readJson(fileUrl.href), entry);
        }));

        for (const lecture of loaded) {
          if (loadedLectureIds.has(lecture.id)) continue;
          loadedLectureIds.add(lecture.id);
          lectures.push(lecture);
        }
        if (subjectKey === activeSubject) refreshApplication();
        return entries.map(entry => entry.id);
      } finally {
        if (affectsActiveView && subjectKey === activeSubject) setBusy(false, subjectKey);
      }
    })().catch(error => {
      subjectLoads.delete(subjectKey);
      showLoadError(subjectKey, error);
      throw error;
    });

    subjectLoads.set(subjectKey, task);
    return task;
  };

  const loadAll = async () => {
    const catalog = await loadCatalog();
    const subjectKeys = [...new Set(catalog.lectures.map(entry => entry.subjectKey))];
    await Promise.all(subjectKeys.map(loadSubject));
    refreshApplication();
    return [...loadedLectureIds];
  };

  subjectSelector?.addEventListener('change', () => {
    loadSubject(subjectSelector.value).catch(() => {});
  });

  globalThis.MEQLectureLoader = Object.freeze({
    loadSubject,
    loadAll,
    loadCatalog,
    isLoaded: lectureId => loadedLectureIds.has(lectureId),
    loadedLectureIds
  });

  loadSubject(activeSubject).catch(() => {});
})();