(() => {
  const DEFAULT_CATALOG_URL = './lectures/catalog.json';

  const normalizeLecture = lecture => {
    if (!lecture || typeof lecture !== 'object') return lecture;
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
      if (typeof item.prompt !== 'string') item.prompt = '';
    });
    return lecture;
  };

  lectures.forEach(normalizeLecture);
  const loadedLectureIds = new Set(
    lectures.filter(lecture => !lecture.__metadataOnly).map(lecture => lecture.id)
  );
  const catalogPromises = new Map();
  const subjectMetadataPromises = new Map();
  const lectureLoads = new Map();
  const entryById = new Map();

  const main = document.querySelector('main');
  const empty = document.getElementById('empty');
  const emptyMessage = document.getElementById('emptyMessage');
  const subjectSelector = document.getElementById('subjectSelector');
  const lectureFilter = document.getElementById('lectureFilter');

  const activeCourseId = () => globalThis.MEQCourseRegistry?.activeCourse || '';
  const subjectScopeKey = (subjectKey, courseId = activeCourseId()) =>
    courseId ? `${courseId}::${subjectKey}` : subjectKey;
  const catalogUrlForSubject = (subjectKey, courseId = activeCourseId()) => {
    const configured = globalThis.MEQCourseRegistry?.catalogForSubject(subjectKey, courseId);
    if (configured === null) return null;
    return configured || DEFAULT_CATALOG_URL;
  };

  const setBusy = (busy, subjectKey = activeSubject) => {
    main?.setAttribute('aria-busy', busy ? 'true' : 'false');
    document.documentElement.classList.toggle('lectures-loading', busy);
    if (busy && subjectKey === activeSubject && empty && emptyMessage) {
      empty.classList.add('show');
      const label = subjects.find(subject => subject.id === subjectKey)?.label || 'this subject';
      emptyMessage.textContent = `Loading ${label} lecture…`;
    }
  };

  const showLoadError = (subjectKey, failures) => {
    const failedIds = failures.map(failure => failure.entry.id);
    console.error(`Could not load ${subjectKey} lectures:`, failures);
    if (subjectKey === activeSubject && empty && emptyMessage && !visibleLectures().some(lecture => !lecture.__metadataOnly)) {
      empty.classList.add('show');
      emptyMessage.textContent = 'Lecture content could not be loaded. Check the connection and try again.';
    }
    if (typeof showToast === 'function') {
      showToast(`${failedIds.length} lecture${failedIds.length === 1 ? '' : 's'} could not be loaded.`);
    }
    document.dispatchEvent(new CustomEvent('meq:lecture-load-errors', {
      detail: {subjectKey, lectureIds: failedIds}
    }));
  };

  const readJson = async url => {
    const response = await fetch(url, {credentials: 'same-origin'});
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.json();
  };

  const loadCatalog = (catalogUrl = DEFAULT_CATALOG_URL) => {
    if (!catalogUrl) return Promise.resolve({version: 1, lectures: []});
    if (!catalogPromises.has(catalogUrl)) {
      const promise = readJson(catalogUrl).then(catalog => {
        if (!catalog || catalog.version !== 1 || catalog.schemaVersion !== 2 || !Array.isArray(catalog.lectures)) {
          throw new Error(`Invalid lecture catalog: ${catalogUrl}`);
        }
        const ids = new Set();
        catalog.lectures.forEach((entry, index) => {
          if (!entry || typeof entry !== 'object') throw new Error(`Invalid catalog entry ${index + 1}`);
          for (const key of ['id', 'title', 'subjectKey', 'file']) {
            if (typeof entry[key] !== 'string' || !entry[key].trim()) {
              throw new Error(`Catalog entry ${index + 1} has invalid ${key}`);
            }
          }
          if (entry.schemaVersion !== 1) {
            throw new Error(`Unsupported lecture schema version for ${entry.id}: ${entry.schemaVersion}`);
          }
          if (ids.has(entry.id)) throw new Error(`Duplicate catalog id ${entry.id}`);
          ids.add(entry.id);
        });
        return catalog;
      }).catch(error => {
        catalogPromises.delete(catalogUrl);
        throw error;
      });
      catalogPromises.set(catalogUrl, promise);
    }
    return catalogPromises.get(catalogUrl);
  };

  const validateLecture = (lecture, entry) => {
    if (!lecture || typeof lecture !== 'object' || lecture.id !== entry.id) {
      throw new Error(`Unexpected lecture payload for ${entry.id}`);
    }
    if (lecture.subjectKey !== entry.subjectKey || lecture.title !== entry.title) {
      throw new Error(`Lecture metadata differs from catalog for ${entry.id}`);
    }
    const expectedCanonicalId = globalThis.MEQCourseRegistry?.lectureScope?.(
      entry.id,
      entry.subjectKey,
      entry.courseId || activeCourseId()
    ) || `${entry.courseId}/${entry.subjectKey}/${entry.id}`;
    if (
      lecture.schemaVersion !== entry.schemaVersion ||
      lecture.courseId !== entry.courseId ||
      lecture.canonicalId !== expectedCanonicalId
    ) {
      throw new Error(`Lecture identity metadata differs from catalog for ${entry.id}`);
    }
    const expected = entry.expectedCounts || {};
    for (const key of ['cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid']) {
      if (!Array.isArray(lecture[key]) || lecture[key].length !== expected[key]) {
        throw new Error(`Lecture ${entry.id} has invalid ${key}`);
      }
    }
    lecture.courseId = entry.courseId;
    lecture.schemaVersion = entry.schemaVersion;
    lecture.canonicalId = expectedCanonicalId;
    lecture.expectedCounts = {...expected};
    lecture.__metadataOnly = false;
    return normalizeLecture(lecture);
  };

  const metadataLecture = entry => ({
    id: entry.id,
    title: entry.title,
    subjectKey: entry.subjectKey,
    courseId: entry.courseId || '',
    schemaVersion: entry.schemaVersion || 1,
    canonicalId: entry.canonicalId || entry.id,
    order: entry.order,
    subject: subjects.find(subject => subject.id === entry.subjectKey)?.label || entry.subjectKey,
    subtitle: '',
    sourceNote: '',
    subtopics: [],
    cases: [],
    coreShorts: [],
    imageQuestions: [],
    detailedShorts: [],
    rapid: [],
    schemaVersion: entry.schemaVersion,
    expectedCounts: {...(entry.expectedCounts || {})},
    __metadataOnly: true
  });

  const registerEntries = (entries, catalogUrl, courseId) => {
    entries.forEach(rawEntry => {
      const entry = {
        ...rawEntry,
        courseId: rawEntry.courseId || courseId || '',
        schemaVersion: rawEntry.schemaVersion || 1,
        canonicalId: rawEntry.canonicalId ||
          globalThis.MEQCourseRegistry?.lectureScope?.(
            rawEntry.id,
            rawEntry.subjectKey,
            rawEntry.courseId || courseId || activeCourseId()
          ) ||
          rawEntry.id
      };
      entryById.set(entry.id, {entry, catalogUrl});
      const existing = lectures.find(lecture => lecture.id === entry.id);
      if (!existing) {
        lectures.push(metadataLecture(entry));
      } else {
        existing.expectedCounts = {...(entry.expectedCounts || {})};
      }
    });
    lectures.sort((a, b) =>
      a.subjectKey.localeCompare(b.subjectKey) || a.order - b.order || a.id.localeCompare(b.id)
    );
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
        lectureIds: visibleLectures().filter(lecture => !lecture.__metadataOnly).map(lecture => lecture.id)
      }
    }));
  };

  const ensureSubjectMetadata = (subjectKey, courseId = activeCourseId()) => {
    const scopeKey = subjectScopeKey(subjectKey, courseId);
    if (subjectMetadataPromises.has(scopeKey)) return subjectMetadataPromises.get(scopeKey);
    const task = (async () => {
      const catalogUrl = catalogUrlForSubject(subjectKey, courseId);
      if (!catalogUrl) return [];
      const catalog = await loadCatalog(catalogUrl);
      const entries = catalog.lectures
        .filter(entry =>
          entry.subjectKey === subjectKey &&
          (!courseId || !entry.courseId || entry.courseId === courseId)
        )
        .map(entry => ({
          ...entry,
          courseId: entry.courseId || courseId || '',
          schemaVersion: entry.schemaVersion || catalog.schemaVersion || 1
        }))
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      registerEntries(entries, catalogUrl, courseId);
      return entries;
    })().catch(error => {
      subjectMetadataPromises.delete(scopeKey);
      throw error;
    });
    subjectMetadataPromises.set(scopeKey, task);
    return task;
  };

  const loadLecture = (lectureId, options = {}) => {
    if (!lectureId || lectureId === 'all') return Promise.resolve(null);
    if (loadedLectureIds.has(lectureId)) {
      return Promise.resolve(lectures.find(lecture => lecture.id === lectureId) || null);
    }
    if (lectureLoads.has(lectureId)) return lectureLoads.get(lectureId);

    const record = entryById.get(lectureId);
    if (!record) return Promise.reject(new Error(`Unknown lecture id: ${lectureId}`));
    const {entry, catalogUrl} = record;
    const affectsActiveView = options.busy !== false &&
      entry.subjectKey === activeSubject &&
      lectureFilter?.value === lectureId;

    const task = (async () => {
      if (affectsActiveView) setBusy(true, entry.subjectKey);
      try {
        const fileUrl = new URL(entry.file, new URL(catalogUrl, location.href));
        const lecture = validateLecture(await readJson(fileUrl.href), entry);
        const index = lectures.findIndex(item => item.id === lecture.id);
        if (index >= 0) lectures.splice(index, 1, lecture);
        else lectures.push(lecture);
        loadedLectureIds.add(lecture.id);
        if (options.refresh !== false && lecture.subjectKey === activeSubject) refreshApplication();
        return lecture;
      } catch (error) {
        showLoadError(entry.subjectKey, [{entry, error: String(error)}]);
        throw error;
      } finally {
        lectureLoads.delete(lectureId);
        if (affectsActiveView && entry.subjectKey === activeSubject) setBusy(false, entry.subjectKey);
      }
    })();

    lectureLoads.set(lectureId, task);
    return task;
  };

  const loadSubject = async (subjectKey, courseId = activeCourseId()) => {
    const affectsActiveView = subjectKey === activeSubject && (!courseId || courseId === activeCourseId());
    if (affectsActiveView) setBusy(true, subjectKey);
    try {
      const entries = await ensureSubjectMetadata(subjectKey, courseId);
      if (subjectKey === activeSubject) refreshApplication();
      if (!entries.length) return {loaded: [], failed: []};

      let selected = lectureFilter?.value || '';
      if (!entries.some(entry => entry.id === selected)) selected = entries[0].id;
      if (lectureFilter && subjectKey === activeSubject) lectureFilter.value = selected;

      try {
        await loadLecture(selected, {refresh: false, busy: false});
      } catch (error) {
        if (subjectKey === activeSubject) refreshApplication();
        return {loaded: [], failed: [selected]};
      }

      if (subjectKey === activeSubject) refreshApplication();
      return {loaded: [selected], failed: []};
    } finally {
      if (affectsActiveView && subjectKey === activeSubject) setBusy(false, subjectKey);
    }
  };

  const loadAll = async () => {
    const configuredScopes = globalThis.MEQCourseRegistry?.allSubjectScopes?.();
    let scopes = Array.isArray(configuredScopes) ? configuredScopes : [];
    if (!scopes.length) {
      const catalog = await loadCatalog(DEFAULT_CATALOG_URL);
      scopes = [...new Set(catalog.lectures.map(entry => entry.subjectKey))]
        .map(subjectKey => ({courseId: activeCourseId(), subjectKey}));
    }

    const metadataResults = await Promise.allSettled(
      scopes.map(scope => ensureSubjectMetadata(scope.subjectKey, scope.courseId))
    );
    const failedSubjects = metadataResults
      .map((result, index) => result.status === 'rejected' ? scopes[index]?.scopeId || subjectScopeKey(scopes[index]?.subjectKey, scopes[index]?.courseId) : null)
      .filter(Boolean);
    const allEntries = metadataResults.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const payloadResults = await Promise.allSettled(
      allEntries.map(entry => loadLecture(entry.id, {refresh: false, busy: false}))
    );
    payloadResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const entry = allEntries[index];
        const scope = subjectScopeKey(entry?.subjectKey, entry?.courseId);
        if (scope && !failedSubjects.includes(scope)) failedSubjects.push(scope);
      }
    });
    refreshApplication();
    return {
      lectureIds: [...loadedLectureIds],
      failedSubjects
    };
  };

  subjectSelector?.addEventListener('change', () => {
    loadSubject(subjectSelector.value).catch(() => {});
  });

  globalThis.MEQLectureLoader = Object.freeze({
    loadSubject,
    loadSubjectMetadata: ensureSubjectMetadata,
    loadLecture,
    loadAll,
    loadCatalog,
    catalogUrlForSubject,
    isLoaded: lectureId => loadedLectureIds.has(lectureId),
    catalogEntry: lectureId => entryById.get(lectureId)?.entry || null,
    lectureUrl: lectureId => {
      const record = entryById.get(lectureId);
      if (!record) return null;
      return new URL(record.entry.file, new URL(record.catalogUrl, location.href)).href;
    },
    entriesForSubject: (subjectKey, courseId = activeCourseId()) => lectures
      .filter(lecture =>
        lecture.subjectKey === subjectKey &&
        (!courseId || !lecture.courseId || lecture.courseId === courseId)
      )
      .map(lecture => entryById.get(lecture.id)?.entry)
      .filter(Boolean),
    loadedLectureIds
  });

  Promise.resolve(globalThis.MEQProgressStore?.ready)
    .catch(() => null)
    .then(() => loadSubject(activeSubject))
    .catch(() => {});
})();
