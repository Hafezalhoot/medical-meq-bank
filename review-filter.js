(() => {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || document.getElementById('reviewFilter')) return;

  const reviewFilter = document.createElement('select');
  reviewFilter.id = 'reviewFilter';
  reviewFilter.className = 'control review-filter';
  reviewFilter.setAttribute('aria-label', 'Review level filter');
  reviewFilter.title = 'Show questions by your saved revision rating';
  reviewFilter.innerHTML = `
    <option value="all">All review levels</option>
    <option value="unrated">Unrated</option>
    <option value="mastered">Mastered</option>
    <option value="review">Review</option>
    <option value="weak">Weak</option>`;

  const savedLevel = storage.get('medicalBankReviewFilterV1') || 'all';
  reviewFilter.value = [...reviewFilter.options].some(o => o.value === savedLevel) ? savedLevel : 'all';
  reviewFilter.dataset.level = reviewFilter.value;
  toolbar.insertBefore(reviewFilter, document.getElementById('randomBtn'));

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
      const level = (statusKey && state[statusKey]) || 'unrated';
      if (baseShow) { counts.all++; counts[level]++; }
      const show = baseShow && (rf === 'all' || level === rf);
      it.classList.toggle('hidden', !show);
      if (show) visible++;
    });

    const labels = {all: 'All review levels', unrated: 'Unrated', mastered: 'Mastered', review: 'Review', weak: 'Weak'};
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
    const reviewName = {unrated: 'unrated', mastered: 'mastered', review: 'marked for review', weak: 'weak'}[rf];
    $('emptyMessage').textContent = noSubjectLectures
      ? `No lectures have been added to ${subjects.find(s => s.id === activeSubject)?.label || 'this subject'} yet.`
      : reviewName ? `No ${reviewName} items match the current filters.` : 'No study items match the current filters.';
    syncQuickButtons();
  };

  reviewFilter.addEventListener('change', () => {
    storage.set('medicalBankReviewFilterV1', reviewFilter.value);
    applyFilters();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('.status')) setTimeout(applyFilters, 0);
  });

  applyFilters();
})();
