(() => {
  const search = document.getElementById('search');
  if (!search || search.dataset.optimizedSearch === '1') return;

  const FILTER_DELAY_MS = 300;
  let timer = 0;
  let composing = false;
  let replaying = false;
  let pendingInput = null;

  search.dataset.optimizedSearch = '1';
  search.dataset.filterDelay = String(FILTER_DELAY_MS);

  const dispatchDebouncedInput = () => {
    const input = pendingInput;
    pendingInput = null;
    replaying = true;
    try {
      if (typeof InputEvent === 'function') {
        search.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          composed: true,
          data: input?.data ?? null,
          inputType: input?.inputType || 'insertText',
          isComposing: false
        }));
      } else {
        search.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
      }
    } finally {
      replaying = false;
    }
  };

  const runSearch = () => {
    window.clearTimeout(timer);
    timer = 0;
    dispatchDebouncedInput();
    search.dispatchEvent(new CustomEvent('meq:search-applied', {bubbles: true}));
  };

  const scheduleSearch = event => {
    if (event) {
      pendingInput = {
        data: typeof event.data === 'string' ? event.data : null,
        inputType: typeof event.inputType === 'string' ? event.inputType : 'insertText'
      };
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(runSearch, FILTER_DELAY_MS);
  };

  // Delay the application's original immediate input event, then replay one
  // normal bubbling input event. Existing and future listeners still receive
  // the event once, while filtering work is coalesced behind the debounce.
  document.addEventListener('input', event => {
    if (event.target !== search || replaying) return;
    event.stopImmediatePropagation();
    if (!composing) scheduleSearch(event);
  }, true);

  search.addEventListener('compositionstart', () => {
    composing = true;
    window.clearTimeout(timer);
    timer = 0;
  });

  search.addEventListener('compositionend', event => {
    composing = false;
    scheduleSearch(event);
  });

  search.addEventListener('search', event => scheduleSearch(event));
})();
