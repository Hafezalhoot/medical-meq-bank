(() => {
  const toolbar = document.querySelector('.toolbar');
  const searchInput = document.getElementById('search');
  const lectureFilter = document.getElementById('lectureFilter');
  const typeFilter = document.getElementById('typeFilter');
  const topicFilter = document.getElementById('topicFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const reviewFilter = document.getElementById('reviewFilter');
  const randomButton = document.getElementById('randomBtn');
  const revealButton = document.getElementById('revealBtn');

  if (!toolbar || !searchInput || !lectureFilter || !typeFilter ||
      !topicFilter || !priorityFilter || !reviewFilter ||
      document.getElementById('mobileFiltersToggle')) return;

  toolbar.id ||= 'studyToolbar';
  const mobileViewport = window.matchMedia('(max-width: 700px)');
  const body = document.body;

  const shell = document.createElement('div');
  shell.className = 'mobile-filter-shell';
  toolbar.parentNode?.insertBefore(shell, toolbar);
  shell.appendChild(toolbar);

  const sheetControls = [
    lectureFilter,
    typeFilter,
    topicFilter,
    priorityFilter,
    reviewFilter,
    randomButton,
    revealButton
  ].filter(Boolean);
  sheetControls.forEach(control => control.classList.add('mobile-sheet-control'));

  const sheetHeader = document.createElement('div');
  sheetHeader.className = 'mobile-filter-sheet-header';
  const sheetTitle = document.createElement('strong');
  sheetTitle.id = 'mobileFilterSheetTitle';
  sheetTitle.textContent = 'Study filters';
  const closeButton = document.createElement('button');
  closeButton.id = 'closeMobileFiltersBtn';
  closeButton.type = 'button';
  closeButton.className = 'mobile-filter-close';
  closeButton.setAttribute('aria-label', 'Close study filters');
  closeButton.textContent = 'Done';
  sheetHeader.append(sheetTitle, closeButton);
  toolbar.prepend(sheetHeader);

  const toggle = document.createElement('button');
  toggle.id = 'mobileFiltersToggle';
  toggle.type = 'button';
  toggle.className = 'mobile-filter-toggle';
  toggle.setAttribute('aria-controls', toolbar.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `
    <span class="mobile-filter-toggle-label">Filters</span>
    <span class="mobile-filter-count" aria-label="Active filters" hidden>0</span>`;
  toolbar.insertBefore(toggle, lectureFilter);

  const resetButton = document.createElement('button');
  resetButton.id = 'resetFiltersBtn';
  resetButton.type = 'button';
  resetButton.className = 'reset-filters-button';
  resetButton.textContent = 'Reset';

  const applyButton = document.createElement('button');
  applyButton.id = 'applyMobileFiltersBtn';
  applyButton.type = 'button';
  applyButton.className = 'apply-mobile-filters-button';
  applyButton.textContent = 'Show results';

  const footer = document.createElement('div');
  footer.className = 'mobile-filter-footer';
  footer.append(resetButton, applyButton);
  toolbar.appendChild(footer);

  const backdrop = document.createElement('div');
  backdrop.id = 'mobileFilterBackdrop';
  backdrop.className = 'mobile-filter-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  body.appendChild(backdrop);

  const chips = document.createElement('div');
  chips.id = 'activeFilterChips';
  chips.className = 'active-filter-chips';
  chips.setAttribute('aria-label', 'Active filters');
  chips.setAttribute('aria-live', 'polite');
  chips.hidden = true;
  shell.insertAdjacentElement('afterend', chips);

  const chipsResetButton = document.createElement('button');
  chipsResetButton.id = 'resetFilterChipsBtn';
  chipsResetButton.type = 'button';
  chipsResetButton.className = 'reset-filter-chips-button';
  chipsResetButton.textContent = 'Clear all';

  const cleanOptionLabel = control => {
    const label = control.selectedOptions?.[0]?.textContent?.trim() || control.value;
    return label.replace(/\s+\(\d+\)$/, '');
  };

  const activeSubtopicLabel = () => {
    if (typeof activeSubtopic === 'undefined' || activeSubtopic === 'all') return '';
    const activeButton = document.querySelector('.subtopic-link.active, .subtopic-nav .active');
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
  let lockedScrollY = 0;
  let bodyStyleSnapshot = null;
  let lastFocusedElement = null;

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

    if (signature === lastFilterSignature && chips.contains(chipsResetButton)) {
      chips.hidden = false;
      return;
    }

    const label = document.createElement('span');
    label.className = 'active-filter-label';
    label.textContent = 'Active filters';
    chips.replaceChildren(label, ...activeFilters.map(createChip), chipsResetButton);
    lastFilterSignature = signature;
    chips.hidden = false;
  };

  const scheduleRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refresh);
  };

  const lockPageScroll = () => {
    if (bodyStyleSnapshot) return;
    lockedScrollY = window.scrollY;
    bodyStyleSnapshot = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  };

  const unlockPageScroll = () => {
    if (!bodyStyleSnapshot) return;
    const snapshot = bodyStyleSnapshot;
    bodyStyleSnapshot = null;
    body.style.position = snapshot.position;
    body.style.top = snapshot.top;
    body.style.left = snapshot.left;
    body.style.right = snapshot.right;
    body.style.width = snapshot.width;
    body.style.overflow = snapshot.overflow;
    window.scrollTo(0, lockedScrollY);
  };

  const focusableElements = () => [...toolbar.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden;
  });

  const setExpanded = (expanded, {restoreFocus = true} = {}) => {
    const next = Boolean(expanded && mobileViewport.matches);
    const wasExpanded = toolbar.classList.contains('mobile-filters-expanded');
    if (next === wasExpanded) return;

    if (next) {
      shell.style.minHeight = `${Math.ceil(toolbar.getBoundingClientRect().height)}px`;
      lastFocusedElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : toggle;
      toolbar.classList.add('mobile-filters-expanded');
      body.classList.add('mobile-filters-open');
      toolbar.setAttribute('role', 'dialog');
      toolbar.setAttribute('aria-modal', 'true');
      toolbar.setAttribute('aria-labelledby', sheetTitle.id);
      toggle.setAttribute('aria-expanded', 'true');
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add('show'));
      lockPageScroll();
      requestAnimationFrame(() => {
        try {
          closeButton.focus({preventScroll: true});
        } catch (error) {
          closeButton.focus();
        }
      });
      return;
    }

    toolbar.classList.remove('mobile-filters-expanded');
    body.classList.remove('mobile-filters-open');
    toolbar.removeAttribute('role');
    toolbar.removeAttribute('aria-modal');
    toolbar.removeAttribute('aria-labelledby');
    toggle.setAttribute('aria-expanded', 'false');
    backdrop.classList.remove('show');
    backdrop.hidden = true;
    shell.style.minHeight = '';
    unlockPageScroll();

    if (wasExpanded && restoreFocus) {
      const target = lastFocusedElement?.isConnected ? lastFocusedElement : toggle;
      requestAnimationFrame(() => {
        try {
          target.focus({preventScroll: true});
        } catch (error) {
          target.focus();
        }
      });
    }
  };

  const trapFocus = event => {
    if (!toolbar.classList.contains('mobile-filters-expanded')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setExpanded(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = focusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const selectValue = (control, preferred = 'all') => {
    const options = [...control.options];
    const target = options.find(option => option.value === preferred) || options[0];
    control.value = target?.value || '';
    return control.value;
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
        selectValue(lectureFilter);
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
    searchInput.dispatchEvent(new Event('input', {bubbles: true}));
    selectValue(lectureFilter);

    if (typeFilter.value === 'rapid') {
      selectValue(typeFilter);
      dispatchChange(typeFilter);
    } else {
      selectValue(typeFilter);
    }

    topicFilter.disabled = false;
    priorityFilter.disabled = false;
    reviewFilter.disabled = false;
    selectValue(topicFilter);
    selectValue(priorityFilter);
    selectValue(reviewFilter);
    if (typeof updateTopicOptions === 'function') {
      updateTopicOptions();
      selectValue(topicFilter);
    }
    if (typeof storage !== 'undefined') storage.set('medicalBankReviewFilterV1', 'all');

    if (typeof activeSubtopic !== 'undefined') activeSubtopic = 'all';
    if (typeof renderSubtopicNav === 'function') renderSubtopicNav();
    if (typeof applyFilters === 'function') applyFilters();

    setExpanded(false, {restoreFocus: false});
    scheduleRefresh();
    requestAnimationFrame(() => {
      try {
        searchInput.focus({preventScroll: true});
      } catch (error) {
        searchInput.focus();
      }
    });
    if (typeof showToast === 'function') showToast('Filters reset.');
  };

  toggle.addEventListener('click', () => setExpanded(true));
  closeButton.addEventListener('click', () => setExpanded(false));
  applyButton.addEventListener('click', () => setExpanded(false));
  backdrop.addEventListener('click', () => setExpanded(false));
  resetButton.addEventListener('click', resetFilters);
  chipsResetButton.addEventListener('click', resetFilters);
  document.addEventListener('keydown', trapFocus);

  chips.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const chip = event.target.closest('.filter-chip');
    if (chip?.dataset.filter) clearFilter(chip.dataset.filter);
  });

  toolbar.addEventListener('input', scheduleRefresh);
  toolbar.addEventListener('change', scheduleRefresh);
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.nav-toggle, .quick-button, .quick-btn, .quick-view-btn, .quick-reset')) {
      setTimeout(scheduleRefresh, 0);
    }
  });
  document.addEventListener('meq:lectures-loaded', scheduleRefresh);

  const handleViewportChange = event => {
    if (!event.matches) setExpanded(false, {restoreFocus: false});
  };
  if (typeof mobileViewport.addEventListener === 'function') {
    mobileViewport.addEventListener('change', handleViewportChange);
  } else if (typeof mobileViewport.addListener === 'function') {
    mobileViewport.addListener(handleViewportChange);
  }

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
