(() => {
  if (globalThis.MEQProgressStore || typeof storage === 'undefined') return;

  const DB_NAME = 'medical-meq-bank';
  const DB_VERSION = 2;
  const SNAPSHOT_STORE = 'progress-snapshots';
  const ITEM_STORE = 'progress-items';
  const SNAPSHOT_KEY = 'browser-progress-v2';
  const LEGACY_SNAPSHOT_KEY = 'browser-progress-v1';
  const RESTORE_GUARD = 'medicalBankIndexedRestoreAttemptedV2';
  const MEDICAL_PREFIX = 'medicalBank';
  const STATUS_KEY = 'medicalBankStatusV2';
  const VALID_LEVELS = new Set(['mastered', 'review', 'weak', '']);

  let databasePromise = null;

  const isProgressObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(value).every(([key, level]) =>
      typeof key === 'string' &&
      key.includes('::') &&
      VALID_LEVELS.has(level)
    );
  };

  const parseLegacyStatus = raw => {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      return isProgressObject(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  };

  const isValidStatus = value => parseLegacyStatus(value) !== null;

  const openDatabase = () => {
    if (!('indexedDB' in globalThis)) {
      return Promise.reject(new Error('IndexedDB is unavailable'));
    }
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE, {keyPath: 'key'});
        }
        if (!database.objectStoreNames.contains(ITEM_STORE)) {
          database.createObjectStore(ITEM_STORE, {keyPath: 'key'});
        }
      });
      request.addEventListener('success', () => resolve(request.result), {once: true});
      request.addEventListener('error', () => reject(request.error || new Error('Could not open IndexedDB')), {once: true});
      request.addEventListener('blocked', () => reject(new Error('IndexedDB upgrade was blocked')), {once: true});
    }).catch(error => {
      databasePromise = null;
      throw error;
    });

    return databasePromise;
  };

  const transaction = async (storeName, mode, action) => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try {
        result = action(store, tx);
      } catch (error) {
        tx.abort();
        reject(error);
        return;
      }
      tx.addEventListener('complete', () => resolve(result), {once: true});
      tx.addEventListener('abort', () => reject(tx.error || new Error('IndexedDB transaction aborted')), {once: true});
      tx.addEventListener('error', () => reject(tx.error || new Error('IndexedDB transaction failed')), {once: true});
    });
  };

  const requestResult = request => new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {once: true});
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed')), {once: true});
  });

  const exportAll = async () => {
    const database = await openDatabase();
    const tx = database.transaction(ITEM_STORE, 'readonly');
    const records = await requestResult(tx.objectStore(ITEM_STORE).getAll());
    const out = {};
    for (const record of records || []) {
      if (record && typeof record.key === 'string' && VALID_LEVELS.has(record.value) && record.value) {
        out[record.key] = record.value;
      }
    }
    return out;
  };

  const replaceAll = async incoming => {
    if (!isProgressObject(incoming)) throw new Error('Progress payload is invalid');
    await transaction(ITEM_STORE, 'readwrite', store => {
      store.clear();
      const updatedAt = new Date().toISOString();
      for (const [key, value] of Object.entries(incoming)) {
        if (!value) continue;
        store.put({key, value, updatedAt});
      }
    });
    for (const key of Object.keys(state)) delete state[key];
    Object.entries(incoming).forEach(([key, value]) => {
      if (value) state[key] = value;
    });
    updateStatus?.();
    return true;
  };

  const set = async (key, value) => {
    if (typeof key !== 'string' || !key.includes('::') || !VALID_LEVELS.has(value)) {
      throw new Error('Invalid progress item');
    }
    if (value) state[key] = value;
    else delete state[key];

    await transaction(ITEM_STORE, 'readwrite', store => {
      if (value) store.put({key, value, updatedAt: new Date().toISOString()});
      else store.delete(key);
    });
    return value;
  };

  const clear = async () => replaceAll({});

  const collectPreferences = () => {
    const snapshot = {};
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(MEDICAL_PREFIX) || key === STATUS_KEY) continue;
        const value = localStorage.getItem(key);
        if (typeof value === 'string') snapshot[key] = value;
      }
    } catch (error) {
      return {};
    }
    return snapshot;
  };

  const readSnapshot = async () => {
    const database = await openDatabase();
    const tx = database.transaction(SNAPSHOT_STORE, 'readonly');
    const store = tx.objectStore(SNAPSHOT_STORE);
    const current = await requestResult(store.get(SNAPSHOT_KEY));
    if (current) return current;
    return requestResult(store.get(LEGACY_SNAPSHOT_KEY));
  };

  const snapshotNow = async () => {
    const progress = await exportAll();
    const preferences = collectPreferences();
    await transaction(SNAPSHOT_STORE, 'readwrite', store => {
      store.put({
        key: SNAPSHOT_KEY,
        updatedAt: new Date().toISOString(),
        preferences,
        progress
      });
    });
    return true;
  };

  const legacyFromSnapshot = snapshot => {
    if (isProgressObject(snapshot?.progress)) return snapshot.progress;
    const raw = snapshot?.storage?.[STATUS_KEY];
    return parseLegacyStatus(raw);
  };

  const restoreCorruptLegacyStatus = async () => {
    let currentStatus;
    try {
      currentStatus = localStorage.getItem(STATUS_KEY);
    } catch (error) {
      return false;
    }

    if (currentStatus === null || isValidStatus(currentStatus)) return false;
    if (sessionStorage.getItem(RESTORE_GUARD) === '1') return false;

    sessionStorage.setItem(RESTORE_GUARD, '1');
    const recovered = legacyFromSnapshot(await readSnapshot());
    if (!recovered) return false;

    localStorage.setItem(STATUS_KEY, JSON.stringify(recovered));
    location.reload();
    return true;
  };

  const hydrate = async () => {
    const restored = await restoreCorruptLegacyStatus();
    if (restored) return {restored: true, migrated: false};

    let stored = await exportAll();
    let migrated = false;
    if (!Object.keys(stored).length) {
      let legacyRaw = null;
      try { legacyRaw = localStorage.getItem(STATUS_KEY); } catch (error) { /* no-op */ }
      const legacy = parseLegacyStatus(legacyRaw);
      if (legacy && Object.keys(legacy).length) {
        await replaceAll(legacy);
        stored = await exportAll();
        migrated = true;
      }
    }

    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, stored);

    try {
      localStorage.removeItem(STATUS_KEY);
    } catch (error) {
      console.warn('Could not remove migrated legacy progress:', error);
    }

    sessionStorage.removeItem(RESTORE_GUARD);
    return {restored: false, migrated};
  };

  const ready = (async () => {
    try {
      const result = await hydrate();
      await snapshotNow();
      document.dispatchEvent(new CustomEvent('meq:progress-ready', {
        detail: {count: Object.keys(state).length, migrated: result.migrated}
      }));
      return {available: true, ...result};
    } catch (error) {
      console.warn('IndexedDB progress store is unavailable:', error);
      return {available: false, restored: false, migrated: false, error: String(error)};
    }
  })();

  window.addEventListener('pagehide', () => {
    snapshotNow().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') snapshotNow().catch(() => {});
  });

  globalThis.MEQProgressStore = Object.freeze({
    ready,
    set,
    clear,
    exportAll,
    replaceAll,
    snapshotNow,
    readSnapshot,
    isProgressObject,
    isValidStatus
  });

  // Compatibility alias for older integrations and backups.
  globalThis.MEQProgressResilience = globalThis.MEQProgressStore;
})();
