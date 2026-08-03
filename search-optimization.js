(() => {
  const search = document.getElementById('search');
  if (!search || search.dataset.optimizedSearch === '1') return;

  const FILTER_DELAY_MS = 300;
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

  // The original application registered an immediate listener on the search
  // element. Capturing on document guarantees interception before the event
  // reaches that target listener, regardless of registration order.
  document.addEventListener('input', event => {
    if (event.target !== search) return;
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