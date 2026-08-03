(() => {
  if (globalThis.MEQProgressResilience || typeof storage === 'undefined') return;

  const DB_NAME = 'medical-meq-bank';
  const DB_VERSION = 1;
  const STORE_NAME = 'progress-snapshots';
  const SNAPSHOT_KEY = 'browser-progress-v1';
  const RESTORE_GUARD = 'medicalBankIndexedRestoreAttemptedV1';
  const MEDICAL_PREFIX = 'medicalBank';
  const STATUS_KEY = 'medicalBankStatusV2';
  const SNAPSHOT_DELAY_MS = 180;

  let databasePromise = null;
  let snapshotTimer = 0;

  const isValidStatus = value => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const parsed = JSON.parse(value);
      return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
    } catch (error) {
      return false;
    }
  };

  const openDatabase = () => {
    if (!('indexedDB' in globalThis)) {
      return Promise.reject(new Error('IndexedDB is unavailable'));
    }
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, {keyPath: 'key'});
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

  const runTransaction = async (mode, action) => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;

      try {
        result = action(store);
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }

      transaction.addEventListener('complete', () => resolve(result?.result), {once: true});
      transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction aborted')), {once: true});
      transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed')), {once: true});
    });
  };

  const collectStorage = () => {
    const snapshot = {};
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(MEDICAL_PREFIX)) continue;
        const value = localStorage.getItem(key);
        if (typeof value === 'string') snapshot[key] = value;
      }
    } catch (error) {
      return {};
    }
    return snapshot;
  };

  const snapshotNow = async () => {
    window.clearTimeout(snapshotTimer);
    snapshotTimer = 0;
    const values = collectStorage();
    if (!isValidStatus(values[STATUS_KEY])) return false;

    await runTransaction('readwrite', store => store.put({
      key: SNAPSHOT_KEY,
      updatedAt: new Date().toISOString(),
      storage: values
    }));
    return true;
  };

  const readSnapshot = async () => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      request.addEventListener('success', () => resolve(request.result || null), {once: true});
      request.addEventListener('error', () => reject(request.error || new Error('Could not read progress snapshot')), {once: true});
    });
  };

  const scheduleSnapshot = () => {
    window.clearTimeout(snapshotTimer);
    snapshotTimer = window.setTimeout(() => {
      snapshotNow().catch(error => console.warn('Could not mirror MEQ progress:', error));
    }, SNAPSHOT_DELAY_MS);
  };

  const restoreCorruptStatus = async () => {
    let currentStatus;
    try {
      currentStatus = localStorage.getItem(STATUS_KEY);
    } catch (error) {
      return false;
    }

    // Missing status can represent a deliberate reset or cleared browser data.
    // Recover only a present but malformed value, which is unambiguously corrupt.
    if (currentStatus === null || isValidStatus(currentStatus)) return false;
    if (sessionStorage.getItem(RESTORE_GUARD) === '1') return false;

    sessionStorage.setItem(RESTORE_GUARD, '1');
    const snapshot = await readSnapshot();
    const values = snapshot?.storage;
    if (!values || typeof values !== 'object' || !isValidStatus(values[STATUS_KEY])) {
      return false;
    }

    [...Array(localStorage.length)]
      .map((_, index) => localStorage.key(index))
      .filter(key => key && key.startsWith(MEDICAL_PREFIX))
      .forEach(key => localStorage.removeItem(key));

    Object.entries(values).forEach(([key, value]) => {
      if (key.startsWith(MEDICAL_PREFIX) && typeof value === 'string') {
        localStorage.setItem(key, value);
      }
    });

    location.reload();
    return true;
  };

  const originalSet = storage.set.bind(storage);
  storage.set = (key, value) => {
    const result = originalSet(key, value);
    if (typeof key === 'string' && key.startsWith(MEDICAL_PREFIX)) scheduleSnapshot();
    return result;
  };

  const ready = (async () => {
    try {
      const restored = await restoreCorruptStatus();
      if (!restored) {
        sessionStorage.removeItem(RESTORE_GUARD);
        scheduleSnapshot();
      }
      return {available: true, restored};
    } catch (error) {
      console.warn('Progress resilience is unavailable:', error);
      return {available: false, restored: false, error: String(error)};
    }
  })();

  window.addEventListener('pagehide', () => {
    snapshotNow().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') snapshotNow().catch(() => {});
  });

  globalThis.MEQProgressResilience = Object.freeze({
    ready,
    snapshotNow,
    readSnapshot,
    scheduleSnapshot,
    isValidStatus
  });
})();
