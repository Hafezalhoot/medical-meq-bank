(() => {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || document.getElementById('reviewFilter')) return;

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
  reviewFilter.value = [...reviewFilter.options].some(o => o.value === savedLevel) ? savedLevel : 'all';
  reviewFilter.dataset.level = reviewFilter.value;
  toolbar.insertBefore(reviewFilter, document.getElementById('randomBtn'));

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
    document.querySelectorAll('.nav-toggle').forEach(button => {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
  };

  applyFilters = function () {
    const q = $('search').value.toLowerCase().trim();
    const lf = $('lectureFilter').value;
    const tf = $('typeFilter').value;
    const topic = $('topicFilter').value;
    const prio = $('priorityFilter').value;
    const rf = reviewFilter.value;
    let visible = 0;
    const counts = {all: 0, unrated: 0, mastered: 0, review: 0, weak: 0};

    document.querySelectorAll('.study-item').forEach(it => {
      const subOk = activeSubtopic === 'all' || (it.dataset.subtopics || '').split(' ').includes(activeSubtopic);
      const baseShow = (!q || it.dataset.search.includes(q)) &&
        (lf === 'all' || it.dataset.lecture === lf) &&
        (tf === 'all' || it.dataset.type === tf) &&
        (topic === 'all' || it.dataset.topic === topic) &&
        (prio === 'all' || it.dataset.priority === prio) && subOk;
      const statusKey = it.querySelector('.status')?.dataset.key;
      const storedLevel = statusKey ? state[statusKey] : '';
      const level = ['mastered', 'review', 'weak'].includes(storedLevel) ? storedLevel : 'unrated';
      if (baseShow) { counts.all++; counts[level]++; }
      const show = baseShow && (rf === 'all' || level === rf);
      it.classList.toggle('hidden', !show);
      if (show) visible++;
    });

    const labels = {all: 'All statuses', unrated: 'Unrated', mastered: 'Mastered', review: 'Review', weak: 'Weak'};
    [...reviewFilter.options].forEach(option => {
      option.textContent = `${labels[option.value]} (${counts[option.value] || 0})`;
    });
    reviewFilter.dataset.level = rf;

    document.querySelectorAll('.lecture').forEach(lecture => {
      const lectureAllowed = lf === 'all' || lecture.dataset.lecture === lf;
      const any = [...lecture.querySelectorAll('.study-item')].some(item => !item.classList.contains('hidden'));
      lecture.classList.toggle('hidden', !(lectureAllowed && any));
    });

    document.querySelectorAll('.content-section').forEach(section => {
      const any = [...section.querySelectorAll('.study-item')].some(item => !item.classList.contains('hidden'));
      if (section.dataset.sectionType === 'rapid') {
        const clean = tf === 'all' && !q && topic === 'all' && prio === 'all' && rf === 'all' && activeSubtopic === 'all';
        section.classList.toggle('hidden', !clean);
      } else {
        section.classList.toggle('hidden', !any);
      }
    });

    const noSubjectLectures = visibleLectures().length === 0;
    $('empty').classList.toggle('show', visible === 0);
    const messages = {
      unrated: 'No unrated items match the current filters.',
      mastered: 'No mastered items match the current filters.',
      review: 'No items marked for review match the current filters.',
      weak: 'No weak items match the current filters.'
    };
    $('emptyMessage').textContent = noSubjectLectures
      ? `No lectures have been added to ${subjects.find(s => s.id === activeSubject)?.label || 'this subject'} yet.`
      : messages[rf] || 'No study items match the current filters.';
    syncQuickButtons();
    syncAccessibility();
  };

  reviewFilter.addEventListener('change', () => {
    storage.set('medicalBankReviewFilterV1', reviewFilter.value);
    applyFilters();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('.status, .toggle, .nav-toggle')) setTimeout(() => {
      if (event.target.closest('.status')) applyFilters();
      else syncAccessibility();
    }, 0);
  });

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
