(() => {
  if (
    typeof storage === 'undefined' ||
    typeof setSidebarState !== 'function' ||
    typeof toggleSidebar !== 'function'
  ) return;

  const compactViewport = window.matchMedia('(max-width: 980px)');
  const keys = {
    lectures: 'medicalBankHideLecturesV4',
    subtopics: 'medicalBankHideSubtopicsV4'
  };
  const originalGet = storage.get;
  const originalSet = storage.set;

  const readPreference = key => originalGet.call(storage, key);
  const hiddenFor = key => {
    const value = readPreference(key);
    if (value === '1') return true;
    if (value === '0') return false;
    return compactViewport.matches;
  };

  setSidebarState = function () {
    const layout = document.getElementById('mainLayout');
    const lectureButton = document.getElementById('toggleLectures');
    const subtopicButton = document.getElementById('toggleSubtopics');
    if (!layout || !lectureButton || !subtopicButton) return;

    const hideLectures = hiddenFor(keys.lectures);
    const hideSubtopics = hiddenFor(keys.subtopics);
    layout.classList.toggle('hide-lectures', hideLectures);
    layout.classList.toggle('hide-subtopics', hideSubtopics);

    lectureButton.classList.toggle('active', !hideLectures);
    subtopicButton.classList.toggle('active', !hideSubtopics);
    lectureButton.setAttribute('aria-pressed', hideLectures ? 'false' : 'true');
    subtopicButton.setAttribute('aria-pressed', hideSubtopics ? 'false' : 'true');
  };

  toggleSidebar = function (kind) {
    const key = kind === 'lectures' ? keys.lectures : keys.subtopics;
    originalSet.call(storage, key, hiddenFor(key) ? '0' : '1');
    setSidebarState();
  };

  // The older review-filter bootstrap checks for saved values and otherwise
  // writes compact defaults into storage. During that synchronous bootstrap,
  // present a temporary non-null value while the responsive state itself reads
  // the real storage through originalGet. The original getter is restored
  // before the next task, so only explicit user clicks become preferences.
  storage.get = function (key) {
    const value = originalGet.call(storage, key);
    if ((key === keys.lectures || key === keys.subtopics) && value === null) {
      return '0';
    }
    return value;
  };
  window.setTimeout(() => {
    storage.get = originalGet;
  }, 0);

  compactViewport.addEventListener?.('change', setSidebarState);
  setSidebarState();
})();
