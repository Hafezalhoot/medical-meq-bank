(() => {
  const searchInput = document.getElementById('search');
  if (!searchInput || searchInput.dataset.meqSearchOptimized === '1') return;
  searchInput.dataset.meqSearchOptimized = '1';

  const SEARCH_DELAY_MS = 320;
  const MAX_RESULTS = 50;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let timer = 0;
  let internalDispatch = false;
  const indexPromises = new Map();

  const createResultsPanel = () => {
    const existing = document.getElementById('globalSearchResults');
    if (existing) return existing;

    const panel = document.createElement('section');
    panel.id = 'globalSearchResults';
    panel.className = 'global-search-results';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'globalSearchTitle');

    const head = document.createElement('div');
    head.className = 'global-search-head';
    const title = document.createElement('h2');
    title.id = 'globalSearchTitle';
    title.textContent = 'Search across this subject';
    const status = document.createElement('span');
    status.id = 'globalSearchStatus';
    status.className = 'global-search-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    head.append(title, status);

    const list = document.createElement('div');
    list.id = 'globalSearchList';
    list.className = 'global-search-list';
    panel.append(head, list);

    const anchor = document.getElementById('dataAlert') || document.querySelector('.toolbar');
    anchor?.insertAdjacentElement('afterend', panel);
    return panel;
  };

  const panel = createResultsPanel();
  const resultList = panel?.querySelector('#globalSearchList');
  const resultStatus = panel?.querySelector('#globalSearchStatus');

  const flattenLoadedLecture = lecture => {
    const rows = [];
    const add = (type, id, label, payload, topic = '', priority = '') => {
      rows.push({
        lectureId: lecture.id,
        lectureTitle: lecture.title,
        courseId: lecture.courseId || globalThis.MEQCourseRegistry?.courseForSubject?.(lecture.subjectKey) || '',
        subjectKey: lecture.subjectKey,
        type,
        id,
        label,
        topic,
        priority,
        text: [lecture.title, lecture.subject, label, JSON.stringify(payload), topic, priority]
          .join(' ')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
      });
    };
    lecture.cases?.forEach(item => add('case', item.id, item.title, item, item.topic, item.priority));
    lecture.coreShorts?.forEach(item => add('core', item.id, item.q, item, item.topic, item.priority));
    lecture.imageQuestions?.forEach(item => add('image', item.id, item.title, item, item.topic, item.priority));
    lecture.detailedShorts?.forEach(item => add('extra', item.id, item.q, item, item.topic, item.priority));
    lecture.rapid?.forEach((pair, index) => add('rapid', `rapid-${index + 1}`, String(pair?.[0] || ''), pair));
    return rows;
  };

  const fallbackIndex = () => ({
    version: 1,
    items: Array.isArray(lectures) ? lectures.flatMap(flattenLoadedLecture) : []
  });

  const activeCourseId = () => globalThis.MEQCourseRegistry?.activeCourse || '';
  const indexScopeKey = (courseId, subjectKey) => `${courseId}::${subjectKey}`;

  const loadIndex = (subjectKey, courseId = activeCourseId()) => {
    if (!subjectKey || !courseId) return Promise.resolve({version: 1, courseId, subjectKey, items: []});
    const scopeKey = indexScopeKey(courseId, subjectKey);
    if (indexPromises.has(scopeKey)) return indexPromises.get(scopeKey);
    if (location.protocol === 'file:') {
      const local = fallbackIndex();
      return Promise.resolve({
        version: 1,
        courseId,
        subjectKey,
        items: local.items.filter(item =>
          item.courseId === courseId && item.subjectKey === subjectKey
        )
      });
    }

    const filename = `${encodeURIComponent(courseId)}--${encodeURIComponent(subjectKey)}.json`;
    const promise = fetch(`./lectures/search/${filename}`, {
      credentials: 'same-origin'
    })
      .then(response => {
        if (response.status === 404) return {version: 1, courseId, subjectKey, items: []};
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      })
      .then(data => {
        if (
          !data ||
          data.version !== 1 ||
          data.courseId !== courseId ||
          data.subjectKey !== subjectKey ||
          !Array.isArray(data.items)
        ) {
          throw new Error('Invalid course/subject search index');
        }
        return data;
      })
      .catch(error => {
        console.warn('Could not load course/subject search index:', error);
        indexPromises.delete(scopeKey);
        const local = fallbackIndex();
        return {
          version: 1,
          courseId,
          subjectKey,
          items: local.items.filter(item =>
            item.courseId === courseId && item.subjectKey === subjectKey
          )
        };
      });
    indexPromises.set(scopeKey, promise);
    return promise;
  };

  const typeLabel = type => ({
    case: 'MEQ case',
    core: 'Short question',
    image: 'Image question',
    extra: 'Detailed practice',
    rapid: 'Rapid recall'
  }[type] || 'Study item');

  const openResult = async item => {
    const loader = globalThis.MEQLectureLoader;
    try {
      if (loader?.loadLecture && !loader.isLoaded(item.lectureId)) {
        await loader.loadLecture(item.lectureId, {refresh: false});
      }
      if (typeof selectLecture === 'function') {
        selectLecture(item.lectureId, false);
      } else {
        const filter = document.getElementById('lectureFilter');
        if (filter) filter.value = item.lectureId;
        render?.();
        applyFilters?.();
      }
      window.setTimeout(() => {
        const candidates = [...document.querySelectorAll(
          `.study-item[data-lecture="${CSS.escape(item.lectureId)}"], .rapid-item`
        )];
        const first = candidates.find(node => !node.classList.contains('hidden'));
        first?.scrollIntoView({behavior: reduceMotion?.matches ? 'auto' : 'smooth', block: 'center'});
      }, 0);
    } catch (error) {
      console.warn('Could not open search result:', error);
    }
  };

  const renderResults = async query => {
    if (!panel || !resultList || !resultStatus) return;
    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    if (normalized.length < 2 || !words.length) {
      panel.hidden = true;
      resultList.replaceChildren();
      resultStatus.textContent = '';
      return;
    }

    const subjectKey = typeof activeSubject === 'string' ? activeSubject : '';
    const courseId = activeCourseId();
    const data = await loadIndex(subjectKey, courseId);
    const matches = data.items
      .filter(item =>
        item &&
        item.courseId === courseId &&
        item.subjectKey === subjectKey &&
        typeof item.text === 'string' &&
        words.every(word => item.text.includes(word))
      )
      .sort((a, b) => {
        const aStarts = String(a.label || '').toLowerCase().startsWith(normalized) ? 1 : 0;
        const bStarts = String(b.label || '').toLowerCase().startsWith(normalized) ? 1 : 0;
        return bStarts - aStarts ||
          String(a.lectureTitle || '').localeCompare(String(b.lectureTitle || '')) ||
          String(a.label || '').localeCompare(String(b.label || ''));
      });

    const shown = matches.slice(0, MAX_RESULTS);
    resultList.replaceChildren();
    for (const item of shown) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'global-search-result';
      button.dataset.lecture = item.lectureId;
      button.dataset.type = item.type;

      const title = document.createElement('strong');
      title.textContent = item.label || item.id;
      const meta = document.createElement('span');
      meta.textContent = `${item.lectureTitle || item.lectureId} • ${typeLabel(item.type)}${item.topic ? ` • ${item.topic}` : ''}`;
      button.append(title, meta);
      button.addEventListener('click', () => openResult(item));
      resultList.appendChild(button);
    }

    resultStatus.textContent = matches.length
      ? `${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > MAX_RESULTS ? ` • showing first ${MAX_RESULTS}` : ''}`
      : 'No matching study items. Try a broader term or choose another specialty.';
    panel.hidden = false;
  };

  const originalHandler = searchInput.oninput;
  searchInput.oninput = null;

  const runSearch = () => {
    if (typeof applyFilters === 'function') applyFilters();
    if (typeof syncQuickButtons === 'function') syncQuickButtons();
    originalHandler?.call(searchInput, new Event('input'));

    internalDispatch = true;
    searchInput.dispatchEvent(new CustomEvent('meq:search-applied'));
    internalDispatch = false;

    renderResults(searchInput.value).catch(error => {
      console.warn('Could not render global search results:', error);
    });
  };

  searchInput.addEventListener('input', event => {
    if (internalDispatch || event.type === 'meq:search-applied') return;
    window.clearTimeout(timer);
    timer = window.setTimeout(runSearch, SEARCH_DELAY_MS);
  });

  const refreshSearchForScopeChange = () => {
    if (searchInput.value.trim()) {
      window.clearTimeout(timer);
      timer = window.setTimeout(runSearch, 0);
    }
  };
  document.getElementById('subjectSelector')?.addEventListener('change', refreshSearchForScopeChange);
  document.addEventListener('meq:course-changed', refreshSearchForScopeChange);

  globalThis.MEQSearch = Object.freeze({
    loadIndex,
    renderResults
  });
})();
