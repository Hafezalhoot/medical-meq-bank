(() => {
  const toolbar = document.querySelector('.toolbar');
  const typeFilter = document.getElementById('typeFilter');
  if (!toolbar || !typeFilter || document.getElementById('reviewFilter')) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const validLevels = new Set(['mastered', 'review', 'weak']);

  if (![...typeFilter.options].some(option => option.value === 'rapid')) {
    const rapidOption = document.createElement('option');
    rapidOption.value = 'rapid';
    rapidOption.textContent = 'Rapid recall';
    typeFilter.appendChild(rapidOption);
  }

  const reviewFilter = document.createElement('select');
  reviewFilter.id = 'reviewFilter';
  reviewFilter.className = 'control review-filter';
  const reviewLabel = document.createElement('label');
  reviewLabel.className = 'sr-only';
  reviewLabel.htmlFor = 'reviewFilter';
  reviewLabel.textContent = 'Review status';
  reviewFilter.setAttribute('aria-label', 'Review status filter');
  reviewFilter.title = 'Show questions by your saved revision rating';
  reviewFilter.innerHTML = `
    <option value="all">All statuses</option>
    <option value="unrated">Unrated</option>
    <option value="mastered">Mastered</option>
    <option value="review">Review</option>
    <option value="weak">Weak</option>`;

  const savedLevel = storage.get('medicalBankReviewFilterV1') || 'all';
  reviewFilter.value = [...reviewFilter.options].some(option => option.value === savedLevel)
    ? savedLevel
    : 'all';
  reviewFilter.dataset.level = reviewFilter.value;
  toolbar.insertBefore(reviewLabel, document.getElementById('randomBtn'));
  toolbar.insertBefore(reviewFilter, document.getElementById('randomBtn'));

  const topicFilter = document.getElementById('topicFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const rapidInapplicableControls = [topicFilter, priorityFilter, reviewFilter].filter(Boolean);
  let rapidModeActive = false;
  let domCache = null;

  const optionExists = (control, value) => [...control.options].some(option => option.value === value);

  const getDomCache = () => {
    const studyItems = [...document.querySelectorAll('.study-item')];
    const rapidItems = [...document.querySelectorAll('.rapid-item')];
    const lectures = [...document.querySelectorAll('.lecture')];
    const sections = [...document.querySelectorAll('.content-section')];

    const changed = !domCache ||
      domCache.studyItems.length !== studyItems.length ||
      domCache.rapidItems.length !== rapidItems.length ||
      domCache.lectures.length !== lectures.length ||
      domCache.sections.length !== sections.length ||
      domCache.studyItems[0] !== studyItems[0] ||
      domCache.rapidItems[0] !== rapidItems[0] ||
      domCache.lectures[0] !== lectures[0];

    if (changed) domCache = {studyItems, rapidItems, lectures, sections};
    return domCache;
  };

  const setControlApplicability = rapidMode => {
    if (rapidMode) {
      if (activeSubtopic !== 'all') {
        activeSubtopic = 'all';
        renderSubtopicNav();
      }
      if (!rapidModeActive) {
        rapidInapplicableControls.forEach(control => {
          control.dataset.rapidPreviousValue = control.value;
          control.dataset.rapidPreviousTitle = control.title || '';
          control.value = 'all';
          control.disabled = true;
          control.classList.add('rapid-inapplicable');
          control.title = 'This filter is not used for Rapid Recall cards.';
        });
        rapidModeActive = true;
      }
      return;
    }

    if (!rapidModeActive) return;
    rapidInapplicableControls.forEach(control => {
      control.disabled = false;
      control.classList.remove('rapid-inapplicable');
      const previous = control.dataset.rapidPreviousValue || 'all';
      control.value = optionExists(control, previous) ? previous : 'all';
      control.title = control.dataset.rapidPreviousTitle || '';
      delete control.dataset.rapidPreviousValue;
      delete control.dataset.rapidPreviousTitle;
    });
    rapidModeActive = false;
  };

  const prepareRapidItems = ({lectures}) => {
    lectures.forEach(lecture => {
      const lectureId = lecture.dataset.lecture || '';
      const lectureTitle = lecture.querySelector('.lecture-title')?.textContent?.trim() || '';
      lecture.querySelectorAll('.rapid-item:not([data-rapid-prepared="1"])').forEach((item, index) => {
        const question = item.querySelector('strong')?.textContent?.trim() || '';
        const answer = item.querySelector('.rapid-answer')?.textContent?.trim() || '';
        item.dataset.type = 'rapid';
        item.dataset.lecture = lectureId;
        item.dataset.search = `${lectureTitle} ${question} ${answer}`.toLowerCase();
        item.dataset.rapidPrepared = '1';
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
        item.setAttribute('aria-label', `Rapid Recall ${index + 1}: ${question.replace(/^\d+\.\s*/, '')}`);
      });
    });
  };

  const syncAccessibility = ({studyItems, rapidItems}) => {
    document.querySelectorAll('.status').forEach(button => {
      const selected = button.classList.contains('active');
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.setAttribute('aria-label', `${button.textContent.trim()} rating`);
    });
    studyItems.forEach(item => {
      const toggle = item.querySelector('.toggle');
      if (toggle) toggle.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    });
    rapidItems.forEach(item => {
      item.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    });
    document.querySelectorAll('.nav-toggle').forEach(button => {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
  };

  const updateReviewLabels = (counts, rapidMode) => {
    const labels = {
      all: 'All statuses',
      unrated: 'Unrated',
      mastered: 'Mastered',
      review: 'Review',
      weak: 'Weak'
    };
    [...reviewFilter.options].forEach(option => {
      option.textContent = rapidMode && option.value === 'all'
        ? 'Status not used for Rapid Recall'
        : `${labels[option.value]} (${counts[option.value] || 0})`;
    });
    reviewFilter.dataset.level = rapidMode ? 'all' : reviewFilter.value;
  };

  applyFilters = function () {
    const dom = getDomCache();
    prepareRapidItems(dom);

    const q = $('search').value.toLowerCase().trim();
    const lf = $('lectureFilter').value;
    const tf = typeFilter.value;
    const rapidMode = tf === 'rapid';
    setControlApplicability(rapidMode);

    const topic = topicFilter?.value || 'all';
    const prio = priorityFilter?.value || 'all';
    const rf = reviewFilter.value;
    let visibleStudyItems = 0;
    let visibleRapidItems = 0;
    const counts = {all: 0, unrated: 0, mastered: 0, review: 0, weak: 0};

    dom.studyItems.forEach(item => {
      const searchText = item.dataset.search || '';
      const subtopics = item.dataset.subtopics || '';
      const subOk = activeSubtopic === 'all' || subtopics.split(' ').includes(activeSubtopic);
      const baseShow = !rapidMode &&
        (!q || searchText.includes(q)) &&
        (lf === 'all' || item.dataset.lecture === lf) &&
        (tf === 'all' || item.dataset.type === tf) &&
        (topic === 'all' || item.dataset.topic === topic) &&
        (prio === 'all' || item.dataset.priority === prio) &&
        subOk;
      const statusKey = item.querySelector('.status')?.dataset.key;
      const storedLevel = statusKey ? state[statusKey] : '';
      const level = validLevels.has(storedLevel) ? storedLevel : 'unrated';
      if (baseShow) {
        counts.all += 1;
        counts[level] += 1;
      }
      const show = baseShow && (rf === 'all' || level === rf);
      item.classList.toggle('hidden', !show);
      if (show) visibleStudyItems += 1;
    });

    // Rapid Recall is part of "All types", including while searching. Topic,
    // priority, saved rating and subtopic are intentionally inapplicable to it.
    const showRapidInsideAll = tf === 'all' &&
      topic === 'all' &&
      prio === 'all' &&
      rf === 'all' &&
      activeSubtopic === 'all';

    dom.rapidItems.forEach(item => {
      const requested = rapidMode || showRapidInsideAll;
      const searchText = item.dataset.search || '';
      const show = requested &&
        (lf === 'all' || item.dataset.lecture === lf) &&
        (!q || searchText.includes(q));
      item.classList.toggle('hidden', !show);
      if (show) visibleRapidItems += 1;
    });

    updateReviewLabels(counts, rapidMode);

    dom.lectures.forEach(lecture => {
      const lectureAllowed = lf === 'all' || lecture.dataset.lecture === lf;
      const anyStudy = [...lecture.querySelectorAll('.study-item')]
        .some(item => !item.classList.contains('hidden'));
      const anyRapid = [...lecture.querySelectorAll('.rapid-item')]
        .some(item => !item.classList.contains('hidden'));
      lecture.classList.toggle('hidden', !(lectureAllowed && (anyStudy || anyRapid)));
    });

    dom.sections.forEach(section => {
      const selector = section.dataset.sectionType === 'rapid' ? '.rapid-item' : '.study-item';
      const anyVisible = [...section.querySelectorAll(selector)]
        .some(item => !item.classList.contains('hidden'));
      section.classList.toggle('hidden', !anyVisible);
    });

    const visible = visibleStudyItems + visibleRapidItems;
    const noSubjectLectures = visibleLectures().length === 0;
    $('empty').classList.toggle('show', visible === 0);
    const messages = {
      unrated: 'No unrated items match the current filters.',
      mastered: 'No mastered items match the current filters.',
      review: 'No items marked for review match the current filters.',
      weak: 'No weak items match the current filters.'
    };
    $('emptyMessage').textContent = noSubjectLectures
      ? `No lectures have been added to ${subjects.find(subject => subject.id === activeSubject)?.label || 'this subject'} yet.`
      : rapidMode
        ? 'No Rapid Recall cards match the current lecture or search.'
        : messages[rf] || 'No study items match the current filters.';

    syncQuickButtons();
    syncAccessibility(dom);
  };

  reviewFilter.addEventListener('change', () => {
    storage.set('medicalBankReviewFilterV1', reviewFilter.value);
    applyFilters();
  });

  typeFilter.addEventListener('change', () => {
    setControlApplicability(typeFilter.value === 'rapid');
  }, true);

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const rapidItem = event.target.closest('.rapid-item');
    if (rapidItem) setTimeout(() => {
      rapidItem.setAttribute('aria-expanded', rapidItem.classList.contains('open') ? 'true' : 'false');
    }, 0);

    const status = event.target.closest('.status');
    const accessibilityTarget = event.target.closest('.status, .toggle, .nav-toggle');
    if (accessibilityTarget) setTimeout(() => {
      if (status) applyFilters();
      else syncAccessibility(getDomCache());
    }, 0);
  });

  document.addEventListener('keydown', event => {
    if (!(event.target instanceof Element)) return;
    const rapidItem = event.target.closest('.rapid-item');
    if (!rapidItem || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    rapidItem.classList.toggle('open');
    rapidItem.setAttribute('aria-expanded', rapidItem.classList.contains('open') ? 'true' : 'false');
  });

  const revealButton = document.getElementById('revealBtn');
  const originalReveal = revealButton?.onclick;
  if (revealButton) {
    revealButton.onclick = event => {
      if (typeFilter.value !== 'rapid') {
        originalReveal?.call(revealButton, event);
        syncAccessibility(getDomCache());
        return;
      }
      revealAll = !revealAll;
      document.querySelectorAll('.rapid-item:not(.hidden)').forEach(item => {
        item.classList.toggle('open', revealAll);
        item.setAttribute('aria-expanded', revealAll ? 'true' : 'false');
      });
      revealButton.textContent = revealAll ? 'Hide all' : 'Reveal all';
    };
  }

  const randomButton = document.getElementById('randomBtn');
  const originalRandom = randomButton?.onclick;
  if (randomButton) {
    randomButton.onclick = event => {
      if (typeFilter.value !== 'rapid') {
        originalRandom?.call(randomButton, event);
        return;
      }
      const items = [...document.querySelectorAll('.rapid-item:not(.hidden)')]
        .filter(item => !item.closest('.lecture.hidden') && !item.closest('.content-section.hidden'));
      if (!items.length) return;
      const item = items[Math.floor(Math.random() * items.length)];
      item.classList.add('open');
      item.setAttribute('aria-expanded', 'true');
      item.scrollIntoView({
        behavior: reduceMotion?.matches ? 'auto' : 'smooth',
        block: 'center'
      });
      if (!reduceMotion?.matches && typeof item.animate === 'function') {
        item.animate(
          [{outline: '5px solid #f79009'}, {outline: '0 solid transparent'}],
          {duration: 1300}
        );
      }
    };
  }

  // On a fresh phone or portrait tablet, keep long navigation panels compact.
  const compactViewport = window.matchMedia('(max-width: 980px)').matches;
  const hasLecturePreference = storage.get('medicalBankHideLecturesV4') !== null;
  const hasSubtopicPreference = storage.get('medicalBankHideSubtopicsV4') !== null;
  if (compactViewport && !hasLecturePreference && !hasSubtopicPreference) {
    storage.set('medicalBankHideLecturesV4', '1');
    storage.set('medicalBankHideSubtopicsV4', '1');
    setSidebarState();
  }

  applyFilters();
})();
