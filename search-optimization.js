(() => {
  const search = document.getElementById('search');
  if (!search || search.dataset.optimizedSearch === '1') return;

  const FILTER_DELAY_MS = 160;
  let timer = 0;
  let composing = false;

  search.dataset.optimizedSearch = '1';
  search.dataset.filterDelay = String(FILTER_DELAY_MS);

  const runSearch = () => {
    window.clearTimeout(timer);
    timer = 0;
    if (typeof applyFilters === 'function') applyFilters();
    if (typeof syncQuickButtons === 'function') syncQuickButtons();
    search.dispatchEvent(new CustomEvent('meq:search-applied', {bubbles: true}));
  };

  const scheduleSearch = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(runSearch, FILTER_DELAY_MS);
  };

  // The original application registered an immediate bubble-phase listener.
  // A target capture listener runs first and prevents that expensive full-bank
  // render while preserving normal text entry and all other keyboard behavior.
  search.addEventListener('input', event => {
    event.stopImmediatePropagation();
    if (!composing) scheduleSearch();
  }, true);

  search.addEventListener('compositionstart', () => {
    composing = true;
    window.clearTimeout(timer);
  });

  search.addEventListener('compositionend', () => {
    composing = false;
    scheduleSearch();
  });

  search.addEventListener('search', scheduleSearch);
})();
