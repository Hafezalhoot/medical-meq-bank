(() => {
  const toolbar = document.querySelector('.toolbar');
  const typeFilter = document.getElementById('typeFilter');
  if (!toolbar || !typeFilter || document.getElementById('reviewFilter')) return;

  if (![...typeFilter.options].some(option => option.value === 'rapid')) {
    const rapidOption = document.createElement('option');
    rapidOption.value = 'rapid';
    rapidOption.textContent = 'Rapid recall';
    typeFilter.appendChild(rapidOption);
  }

  const reviewFilter = document.createElement('select');
  reviewFilter.id = 'reviewFilter';
  reviewFilter.className = 'control review-filter';
  reviewFilter.setAttribute('aria-label', 'Review status filter');
  reviewFilter.title = 'Show questions by your saved revision rating';
  reviewFilter.innerHTML = `
    <option value="all">All statuses</option>
    <option value="unrated">Unrated</option>
    <option value="mastered">Mastered</option>
    <option value="review">Review</option>
    <option value="weak">Weak</option>`;

  const savedLevel = storage.get('medicalBankReviewFilterV1') || 'all';
  reviewFilter.value = [...reviewFilter.options].some(option => option.value === savedLevel) ? savedLevel : 'all';
  reviewFilter.dataset.level = reviewFilter.value;
  toolbar.insertBefore(reviewFilter, document.getElementById('randomBtn'));

  const topicFilter = document.getElementById('topicFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const rapidInapplicableControls = [topicFilter, priorityFilter, reviewFilter].filter(Boolean);
  let rapidModeActive = false;

  const optionExists = (control, value) => [...control.options].some(option => option.value === value);

  const setControlApplicability = rapidMode => {
    if (rapidMode) {
      if (activeSubtopic !== 'all') {
        activeSubtopic = 'all';
        renderSubtopicNav();
      }
      if (!rapidModeActive) {
        rapidInapplicableControls.forEach(control => {
          control.dataset.rapidPreviousValue = control.value;
          control.value = 'all';
          control.disabled = true;
          control.classList.add('rapid-inapplicable');
          control.dataset.rapidPreviousTitle = control.title || '';
          control.title = 'This filter is not used for Rapid Recall cards.';
        });
        rapidModeActive = true;
      }
      return;
    }

    if (rapidModeActive) {
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
    }
  };

  const prepareRapidItems = () => {
    document.querySelectorAll('.lecture').forEach(lecture => {
      const lectureId = lecture.dataset.lecture || '';
      const lectureTitle = lecture.querySelector('.lecture-title')?.textContent?.trim() || '';
      lecture.querySelectorAll('.rapid-item').forEach((item, index) => {
        const question = item.querySelector('strong')?.textContent?.trim() || '';
        const answer = item.querySelector('.rapid-answer')?.textContent?.trim() || '';
        item.dataset.type = 'rapid';
        item.dataset.lecture = lectureId;
        item.dataset.search = `${lectureTitle} ${question} ${answer}`.toLowerCase();
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
        item.setAttribute('aria-label', `Rapid Recall ${index + 1}: ${question.replace(/^\d+\.\s*/, '')}`);
      });
    });
  };

  const syncAccessibility = () => {
    document.querySelectorAll('.status').forEach(button => {
      const selected = button.classList.contains('active');
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.setAttribute('aria-label', `${button.textContent.trim()} rating`);
    });
    document.querySelectorAll('.study-item').forEach(item => {
      const toggle = item.querySelector('.toggle');
      if (toggle) toggle.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    });
    document.querySelectorAll('.rapid-item').forEach(item => {
      item.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    });
    document.querySelectorAll('.nav-toggle').forEach(button => {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
  };

  const updateReviewLabels = (counts, rapidMode) => {
    const labels = {all: 'All statuses', unrated: 'Unrated', mastered: 'Mastered', review: 'Review', weak: 'Weak'};
    [...reviewFilter.options].forEach(option => {
      option.textContent = rapidMode && option.value === 'all'
        ? 'Status not used for Rapid Recall'
        : `${labels[option.value]} (${counts[option.value] || 0})`;
    });
    reviewFilter.dataset.level = rapidMode ? 'all' : reviewFilter.value;
  };

  applyFilters = function () {
    prepareRapidItems();

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

    document.querySelectorAll('.study-item').forEach(item => {
      const subOk = activeSubtopic === 'all' || (item.dataset.subtopics || '').split(' ').includes(activeSubtopic);
      const baseShow = !rapidMode &&
        (!q || item.dataset.search.includes(q)) &&
        (lf === 'all' || item.dataset.lecture === lf) &&
        (tf === 'all' || item.dataset.type === tf) &&
        (topic === 'all' || item.dataset.topic === topic) &&
        (prio === 'all' || item.dataset.priority === prio) && subOk;
      const statusKey = item.querySelector('.status')?.dataset.key;
      const storedLevel = statusKey ? state[statusKey] : '';
      const level = ['mastered', 'review', 'weak'].includes(storedLevel) ? storedLevel : 'unrated';
      if (baseShow) {
        counts.all += 1;
        counts[level] += 1;
      }
      const show = baseShow && (rf === 'all' || level === rf);
      item.classList.toggle('hidden', !show);
      if (show) visibleStudyItems += 1;
    });

    const showRapidInsideAll = tf === 'all' && !q && topic === 'all' && prio === 'all' && rf === 'all' && activeSubtopic === 'all';
    document.querySelectorAll('.rapid-item').forEach(item => {
      const requested = rapidMode || showRapidInsideAll;
      const show = requested &&
        (lf === 'all' || item.dataset.lecture === lf) &&
        (!q || item.dataset.search.includes(q));
      item.classList.toggle('hidden', !show);
      if (show) visibleRapidItems += 1;
    });

    updateReviewLabels(counts, rapidMode);

    document.querySelectorAll('.lecture').forEach(lecture => {
      const lectureAllowed = lf === 'all' || lecture.dataset.lecture === lf;
      const anyStudy = [...lecture.querySelectorAll('.study-item')].some(item => !item.classList.contains('hidden'));
      const anyRapid = [...lecture.querySelectorAll('.rapid-item')].some(item => !item.classList.contains('hidden'));
      lecture.classList.toggle('hidden', !(lectureAllowed && (anyStudy || anyRapid)));
    });

    document.querySelectorAll('.content-section').forEach(section => {
      if (section.dataset.sectionType === 'rapid') {
        const anyRapid = [...section.querySelectorAll('.rapid-item')].some(item => !item.classList.contains('hidden'));
        section.classList.toggle('hidden', !anyRapid);
        return;
      }
      const anyStudy = [...section.querySelectorAll('.study-item')].some(item => !item.classList.contains('hidden'));
      section.classList.toggle('hidden', !anyStudy);
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
    syncAccessibility();
  };

  reviewFilter.addEventListener('change', () => {
    storage.set('medicalBankReviewFilterV1', reviewFilter.value);
    applyFilters();
  });

  typeFilter.addEventListener('change', () => {
    setControlApplicability(typeFilter.value === 'rapid');
  }, true);

  document.addEventListener('click', event => {
    const rapidItem = event.target.closest('.rapid-item');
    if (rapidItem) setTimeout(() => {
      rapidItem.setAttribute('aria-expanded', rapidItem.classList.contains('open') ? 'true' : 'false');
    }, 0);

    if (event.target.closest('.status, .toggle, .nav-toggle')) setTimeout(() => {
      if (event.target.closest('.status')) applyFilters();
      else syncAccessibility();
    }, 0);
  });

  document.addEventListener('keydown', event => {
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
        syncAccessibility();
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
      item.scrollIntoView({behavior: 'smooth', block: 'center'});
      item.animate([{outline: '5px solid #f79009'}, {outline: '0 solid transparent'}], {duration: 1300});
    };
  }

  // On a fresh phone or portrait tablet, keep both long sidebars collapsed so
  // questions start much closer to the top. Any explicit user choice persists.
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