(() => {
  const APP_VERSION = '2026.10.04.2';
  const STORAGE_PREFIX = 'medicalBank';
  const STATUS_KEY = 'medicalBankStatusV2';
  const BACKUP_SCHEMA = 'medical-meq-progress';
  const BACKUP_SCHEMA_VERSION = 2;
  const LEGACY_BACKUP_SCHEMA_VERSION = 1;
  const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
  const VALID_PROGRESS_LEVELS = new Set(['mastered', 'review', 'weak', '']);
  const $p = id => document.getElementById(id);
  const OFFLINE_CACHE_NAME = `medical-meq-bank-${APP_VERSION}`;

  const sameOriginUrl = value => {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin) throw new Error('Offline cache only accepts same-origin resources');
    return url.href;
  };

  const cacheUrl = async value => {
    if (!('caches' in globalThis)) throw new Error('Cache Storage is unavailable');
    const url = sameOriginUrl(value);
    const response = await fetch(url, {credentials: 'same-origin'});
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.put(url, response.clone());
    return url;
  };

  const removeCachedUrl = async value => {
    if (!('caches' in globalThis)) return false;
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    return cache.delete(sameOriginUrl(value));
  };

  const isUrlCached = async value => {
    if (!('caches' in globalThis)) return false;
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    return Boolean(await cache.match(sameOriginUrl(value)));
  };

  const lectureUrl = lectureId => {
    const url = globalThis.MEQLectureLoader?.lectureUrl?.(lectureId);
    if (!url) throw new Error(`Unknown lecture: ${lectureId}`);
    return url;
  };

  const cacheLecture = async lectureId => {
    const url = await cacheUrl(lectureUrl(lectureId));
    document.dispatchEvent(new CustomEvent('meq:offline-lecture-cached', {detail: {lectureId, url}}));
    return url;
  };

  const removeLecture = async lectureId => {
    const removed = await removeCachedUrl(lectureUrl(lectureId));
    document.dispatchEvent(new CustomEvent('meq:offline-lecture-removed', {detail: {lectureId, removed}}));
    return removed;
  };

  const isLectureCached = lectureId => isUrlCached(lectureUrl(lectureId));
  const describeError = error =>
    error?.name === 'QuotaExceededError'
      ? 'Device storage is full. Remove an offline lecture and try again.'
      : error?.name === 'NotAllowedError'
        ? 'Offline storage is unavailable in this browser session.'
        : 'Could not save offline content. Check the connection and try again.';

  const cacheSubject = async (subjectKey, courseId = globalThis.MEQCourseRegistry?.activeCourse || '') => {
    const loader = globalThis.MEQLectureLoader;
    if (!loader) throw new Error('Lecture loader is unavailable');
    if (!courseId) throw new Error('Active course is unavailable');
    await loader.loadSubjectMetadata(subjectKey, courseId);
    const entries = loader.entriesForSubject(subjectKey, courseId);
    const cached = [];
    if (entries.length) {
      await cacheUrl(
        `./lectures/search/${encodeURIComponent(courseId)}--${encodeURIComponent(subjectKey)}.json`
      );
    }
    for (const entry of entries) {
      await cacheLecture(entry.id);
      cached.push(entry.id);
    }
    document.dispatchEvent(new CustomEvent('meq:offline-subject-cached', {
      detail: {courseId, subjectKey, lectureIds: cached}
    }));
    return cached;
  };

  globalThis.MEQOfflineCache = Object.freeze({
    cacheLecture,
    removeLecture,
    isLectureCached,
    cacheSubject,
    describeError
  });

  const heroPanel = document.querySelector('.hero-panel');
  if (heroPanel && !document.getElementById('offlineSubjectBtn')) {
    const offlineSubjectBtn = document.createElement('button');
    offlineSubjectBtn.id = 'offlineSubjectBtn';
    offlineSubjectBtn.type = 'button';
    offlineSubjectBtn.className = 'offline-subject-btn';
    offlineSubjectBtn.textContent = 'Save subject offline';
    offlineSubjectBtn.addEventListener('click', async () => {
      const subjectKey = $p('subjectSelector')?.value;
      if (!subjectKey) return;
      offlineSubjectBtn.disabled = true;
      offlineSubjectBtn.setAttribute('aria-busy', 'true');
      const original = offlineSubjectBtn.textContent;
      offlineSubjectBtn.textContent = 'Saving subject…';
      try {
        const ids = await cacheSubject(
          subjectKey,
          globalThis.MEQCourseRegistry?.activeCourse || ''
        );
        offlineSubjectBtn.textContent = ids.length
          ? `Saved ${ids.length} lecture${ids.length === 1 ? '' : 's'} offline`
          : 'No lectures to save';
        toast(ids.length ? 'Subject is ready for offline study.' : 'This subject has no lectures yet.');
      } catch (error) {
        console.warn('Could not cache subject offline:', error);
        offlineSubjectBtn.textContent = original;
        toast(describeError(error));
      } finally {
        offlineSubjectBtn.disabled = false;
        offlineSubjectBtn.removeAttribute('aria-busy');
      }
    });
    heroPanel.appendChild(offlineSubjectBtn);
  }

  const toast = message => {
    const el = $p('appToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.__meqToastTimer);
    window.__meqToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  };

  const safeStorageKeys = () => {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX) || key === STATUS_KEY) continue;
        const value = localStorage.getItem(key);
        if (typeof value === 'string') out[key] = value;
      }
    } catch (error) {
      console.warn('Could not read progress storage:', error);
    }
    return out;
  };

  const downloadJson = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const validateProgressObject = progress => {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
      throw new Error('Backup progress is invalid');
    }
    const normalized = {};
    for (const [key, value] of Object.entries(progress)) {
      if (typeof key !== 'string' || !key.includes('::') || !VALID_PROGRESS_LEVELS.has(value) || !value) {
        throw new Error('Backup progress contains an invalid item');
      }
      normalized[key] = value;
    }
    return normalized;
  };

  const parseLegacyStatus = raw => {
    if (raw == null) return {};
    if (typeof raw !== 'string') throw new Error('Invalid legacy progress payload');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error('Legacy progress status is not valid JSON');
    }
    return validateProgressObject(
      Object.fromEntries(Object.entries(parsed || {}).filter(([, value]) => value))
    );
  };

  const validatePreferences = values => {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('Backup preferences are invalid');
    }
    const normalized = {};
    for (const [key, value] of Object.entries(values)) {
      if (!key.startsWith(STORAGE_PREFIX) || key === STATUS_KEY || typeof value !== 'string') {
        throw new Error('Backup contains unsupported preference keys');
      }
      normalized[key] = value;
    }
    return normalized;
  };

  const validateBackup = (data, sourceSize) => {
    if (sourceSize > MAX_BACKUP_BYTES) throw new Error('Backup file is too large');
    if (!data || data.schema !== BACKUP_SCHEMA) throw new Error('Unsupported backup schema');

    if (data.schemaVersion === LEGACY_BACKUP_SCHEMA_VERSION) {
      if (!data.storage || typeof data.storage !== 'object' || Array.isArray(data.storage)) {
        throw new Error('Legacy backup storage is invalid');
      }
      const preferences = {};
      for (const [key, value] of Object.entries(data.storage)) {
        if (!key.startsWith(STORAGE_PREFIX) || typeof value !== 'string') {
          throw new Error('Legacy backup contains unsupported storage keys');
        }
        if (key !== STATUS_KEY) preferences[key] = value;
      }
      return {
        preferences: validatePreferences(preferences),
        progress: parseLegacyStatus(data.storage[STATUS_KEY])
      };
    }

    if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error('Unsupported backup schema version');
    }
    return {
      preferences: validatePreferences(data.preferences || {}),
      progress: validateProgressObject(data.progress || {})
    };
  };

  const removeMedicalStorage = () => {
    [...Array(localStorage.length)]
      .map((_, index) => localStorage.key(index))
      .filter(k => k?.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  };

  const writePreferences = values => {
    removeMedicalStorage();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  };

  const replaceBackupTransactionally = async incoming => {
    const progressStore = globalThis.MEQProgressStore;
    if (!progressStore) throw new Error('Progress store is unavailable');
    await progressStore.ready;

    const previousPreferences = safeStorageKeys();
    const previousProgress = await progressStore.exportAll();
    try {
      writePreferences(incoming.preferences);
      await progressStore.replaceAll(incoming.progress);
      await progressStore.snapshotNow();
    } catch (error) {
      try {
        writePreferences(previousPreferences);
        await progressStore.replaceAll(previousProgress);
        await progressStore.snapshotNow();
      } catch (rollbackError) {
        console.error('Progress rollback failed:', rollbackError);
        const rollbackFailure = new Error('Automatic progress rollback failed');
        rollbackFailure.name = 'ProgressRollbackError';
        rollbackFailure.cause = rollbackError;
        throw rollbackFailure;
      }
      throw error;
    }
  };

  $p('exportProgressBtn')?.addEventListener('click', async () => {
    const progressStore = globalThis.MEQProgressStore;
    if (!progressStore) {
      toast('Progress backup is unavailable in this browser.');
      return;
    }
    try {
      await progressStore.ready;
      downloadJson(`medical-meq-progress-${new Date().toISOString().slice(0, 10)}.json`, {
        schema: BACKUP_SCHEMA,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        preferences: safeStorageKeys(),
        progress: await progressStore.exportAll()
      });
      toast('Progress backup downloaded.');
    } catch (error) {
      console.warn('Could not export progress:', error);
      toast('Could not create the progress backup.');
    }
  });

  const importBtn = $p('importProgressBtn');
  const importFile = $p('importProgressFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files?.[0];
      if (!file) return;
      importBtn.disabled = true;
      try {
        if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup file is too large');
        const raw = await file.text();
        const incoming = validateBackup(JSON.parse(raw), file.size);
        await replaceBackupTransactionally(incoming);
        toast('Progress restored. Reloading…');
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        console.warn('Progress import rejected:', error);
        toast(
          error?.name === 'ProgressRollbackError'
            ? 'Progress restore failed and automatic rollback could not complete. Reload and verify your progress before continuing.'
            : 'The backup was rejected and your current progress was kept.'
        );
      } finally {
        importBtn.disabled = false;
        importFile.value = '';
      }
    });
  }

  const connectionPill = $p('connectionPill');
  const connectionText = $p('connectionText');
  const updateConnection = () => {
    const online = navigator.onLine;
    connectionPill?.classList.toggle('offline', !online);
    if (connectionText) connectionText.textContent = online ? 'Online' : 'Offline ready';
  };
  window.addEventListener('online', () => { updateConnection(); toast('Back online.'); });
  window.addEventListener('offline', () => { updateConnection(); toast('Offline mode is active.'); });
  updateConnection();

  let deferredPrompt = null;
  const installBtn = $p('installAppBtn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (installBtn && !isStandalone && isIOS) {
    installBtn.hidden = false;
    const label = installBtn.querySelector('.button-label');
    if (label) label.textContent = 'Add to Home Screen';
    else installBtn.textContent = 'Add to Home Screen';
    installBtn.addEventListener('click', () => toast('Open Share, then choose “Add to Home Screen”.'));
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn) {
      installBtn.hidden = false;
      const label = installBtn.querySelector('.button-label');
      if (label) label.textContent = 'Install App';
      else installBtn.textContent = 'Install App';
    }
  });
  if (installBtn && !isIOS) installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      toast('Installation becomes available after the page finishes loading.');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
    toast('MEQ Bank installed successfully.');
  });

  const banner = $p('updateBanner');
  const applyBtn = $p('applyUpdateBtn');
  const showUpdate = registration => {
    if (!banner) return;
    banner.classList.add('show');
    if (applyBtn) applyBtn.onclick = () => registration.waiting?.postMessage({type: 'SKIP_WAITING'});
  };

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        location.reload();
      }
    });
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', {scope: './'});
        if (registration.waiting) showUpdate(registration);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
          });
        });
        setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
        window.addEventListener('focus', () => registration.update().catch(() => {}));
      } catch (error) {
        console.warn('Service worker registration failed', error);
      }
    });
  }
})();
