(() => {
  const toolbar = document.querySelector('.toolbar');
  const searchInput = document.getElementById('search');
  const lectureFilter = document.getElementById('lectureFilter');
  const typeFilter = document.getElementById('typeFilter');
  const topicFilter = document.getElementById('topicFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const reviewFilter = document.getElementById('reviewFilter');

  if (!toolbar || !searchInput || !lectureFilter || !typeFilter ||
      !topicFilter || !priorityFilter || !reviewFilter ||
      document.getElementById('mobileFiltersToggle')) return;

  toolbar.id ||= 'studyToolbar';
  const mobileViewport = window.matchMedia('(max-width: 700px)');
  const secondaryControls = [topicFilter, priorityFilter, reviewFilter];
  secondaryControls.forEach(control => control.classList.add('mobile-secondary-control'));

  const toggle = document.createElement('button');
  toggle.id = 'mobileFiltersToggle';
  toggle.type = 'button';
  toggle.className = 'mobile-filter-toggle';
  toggle.setAttribute('aria-controls', toolbar.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `
    <span>More filters</span>
    <span class="mobile-filter-count" aria-label="Active filters" hidden>0</span>`;
  toolbar.insertBefore(toggle, topicFilter);

  const chips = document.createElement('div');
  chips.id = 'activeFilterChips';
  chips.className = 'active-filter-chips';
  chips.setAttribute('aria-label', 'Active filters');
  chips.setAttribute('aria-live', 'polite');
  chips.hidden = true;
  toolbar.insertAdjacentElement('afterend', chips);

  const resetButton = document.createElement('button');
  resetButton.id = 'resetFiltersBtn';
  resetButton.type = 'button';
  resetButton.className = 'reset-filters-button';
  resetButton.textContent = 'Reset filters';

  const cleanOptionLabel = control => {
    const label = control.selectedOptions?.[0]?.textContent?.trim() || control.value;
    return label.replace(/\s+\(\d+\)$/, '');
  };

  const activeSubtopicLabel = () => {
    if (typeof activeSubtopic === 'undefined' || activeSubtopic === 'all') return '';
    const activeButton = document.querySelector('.nav-toggle.active, .subtopic-nav .active');
    return activeButton?.textContent?.trim() || activeSubtopic;
  };

  const getActiveFilters = () => {
    const result = [];
    const searchValue = searchInput.value.trim();
    if (searchValue) result.push({key: 'search', label: `Search: ${searchValue}`});
    if (lectureFilter.value !== 'all') {
      result.push({key: 'lecture', label: `Lecture: ${cleanOptionLabel(lectureFilter)}`});
    }
    if (typeFilter.value !== 'all') {
      result.push({key: 'type', label: `Type: ${cleanOptionLabel(typeFilter)}`});
    }
    if (topicFilter.value !== 'all') {
      result.push({key: 'topic', label: `Topic: ${cleanOptionLabel(topicFilter)}`});
    }
    if (priorityFilter.value !== 'all') {
      result.push({key: 'priority', label: `Priority: ${cleanOptionLabel(priorityFilter)}`});
    }
    if (reviewFilter.value !== 'all') {
      result.push({key: 'review', label: `Status: ${cleanOptionLabel(reviewFilter)}`});
    }
    const subtopicLabel = activeSubtopicLabel();
    if (subtopicLabel) result.push({key: 'subtopic', label: `Subtopic: ${subtopicLabel}`});
    return result;
  };

  const createChip = filter => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.dataset.filter = filter.key;
    chip.setAttribute('aria-label', `Remove ${filter.label}`);

    const text = document.createElement('span');
    text.className = 'filter-chip-text';
    text.textContent = filter.label;

    const remove = document.createElement('span');
    remove.className = 'filter-chip-remove';
    remove.setAttribute('aria-hidden', 'true');
    remove.textContent = '×';

    chip.append(text, remove);
    return chip;
  };

  let refreshQueued = false;
  let lastFilterSignature = '';

  const refresh = () => {
    refreshQueued = false;
    const activeFilters = getActiveFilters();
    const signature = activeFilters.map(filter => `${filter.key}:${filter.label}`).join('\u001f');
    const countBadge = toggle.querySelector('.mobile-filter-count');
    if (countBadge) {
      countBadge.textContent = String(activeFilters.length);
      countBadge.hidden = activeFilters.length === 0;
    }

    if (!activeFilters.length) {
      if (lastFilterSignature || chips.childElementCount) chips.replaceChildren();
      lastFilterSignature = '';
      chips.hidden = true;
      return;
    }

    // Avoid replacing interactive controls when filters did not change. A
    // replacement between pointer down and pointer up would cancel the click.
    if (signature === lastFilterSignature && chips.contains(resetButton)) {
      chips.hidden = false;
      return;
    }

    const label = document.createElement('span');
    label.className = 'active-filter-label';
    label.textContent = 'Active:';
    chips.replaceChildren(label, ...activeFilters.map(createChip), resetButton);
    lastFilterSignature = signature;
    chips.hidden = false;
  };

  const scheduleRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refresh);
  };

  const setExpanded = expanded => {
    const next = Boolean(expanded && mobileViewport.matches);
    toolbar.classList.toggle('mobile-filters-expanded', next);
    toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    const label = toggle.querySelector('span:first-child');
    if (label) label.textContent = next ? 'Hide filters' : 'More filters';
  };

  const dispatchChange = control => {
    control.dispatchEvent(new Event('change', {bubbles: true}));
  };

  const clearFilter = key => {
    switch (key) {
      case 'search':
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', {bubbles: true}));
        break;
      case 'lecture':
        lectureFilter.value = 'all';
        dispatchChange(lectureFilter);
        break;
      case 'type':
        typeFilter.value = 'all';
        dispatchChange(typeFilter);
        break;
      case 'topic':
        topicFilter.value = 'all';
        dispatchChange(topicFilter);
        break;
      case 'priority':
        priorityFilter.value = 'all';
        dispatchChange(priorityFilter);
        break;
      case 'review':
        reviewFilter.value = 'all';
        if (typeof storage !== 'undefined') storage.set('medicalBankReviewFilterV1', 'all');
        dispatchChange(reviewFilter);
        break;
      case 'subtopic':
        if (typeof activeSubtopic !== 'undefined') activeSubtopic = 'all';
        if (typeof renderSubtopicNav === 'function') renderSubtopicNav();
        if (typeof applyFilters === 'function') applyFilters();
        break;
      default:
        return;
    }
    scheduleRefresh();
  };

  const resetFilters = () => {
    searchInput.value = '';
    lectureFilter.value = 'all';

    // Leaving Rapid Recall first restores controls disabled by that mode.
    if (typeFilter.value === 'rapid') {
      typeFilter.value = 'all';
      dispatchChange(typeFilter);
    } else {
      typeFilter.value = 'all';
    }

    topicFilter.disabled = false;
    priorityFilter.disabled = false;
    reviewFilter.disabled = false;
    topicFilter.value = 'all';
    priorityFilter.value = 'all';
    reviewFilter.value = 'all';
    if (typeof storage !== 'undefined') storage.set('medicalBankReviewFilterV1', 'all');

    if (typeof activeSubtopic !== 'undefined') activeSubtopic = 'all';
    if (typeof renderSubtopicNav === 'function') renderSubtopicNav();
    if (typeof applyFilters === 'function') applyFilters();

    setExpanded(false);
    scheduleRefresh();
    try {
      searchInput.focus({preventScroll: true});
    } catch (error) {
      searchInput.focus();
    }
    if (typeof showToast === 'function') showToast('Filters reset.');
  };

  toggle.addEventListener('click', () => {
    setExpanded(!toolbar.classList.contains('mobile-filters-expanded'));
  });

  resetButton.addEventListener('click', event => {
    event.stopPropagation();
    resetFilters();
  });

  chips.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const chip = event.target.closest('.filter-chip');
    if (chip?.dataset.filter) clearFilter(chip.dataset.filter);
  });

  toolbar.addEventListener('input', scheduleRefresh);
  toolbar.addEventListener('change', scheduleRefresh);
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.nav-toggle, .quick-button, .quick-btn')) {
      setTimeout(scheduleRefresh, 0);
    }
  });

  mobileViewport.addEventListener?.('change', event => {
    if (!event.matches) setExpanded(false);
  });

  // Keep chips synchronized when any existing feature reapplies filters.
  if (typeof applyFilters === 'function' && !applyFilters.__mobileFilterSync) {
    const originalApplyFilters = applyFilters;
    const synchronizedApplyFilters = function (...args) {
      const result = originalApplyFilters.apply(this, args);
      scheduleRefresh();
      return result;
    };
    synchronizedApplyFilters.__mobileFilterSync = true;
    applyFilters = synchronizedApplyFilters;
  }

  refresh();
})();
