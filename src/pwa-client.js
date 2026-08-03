(() => {
  const APP_VERSION = '2026.08.02.1';
  const STORAGE_PREFIX = 'medicalBank';
  const STATUS_KEY = 'medicalBankStatusV2';
  const BACKUP_SCHEMA = 'medical-meq-progress';
  const BACKUP_SCHEMA_VERSION = 1;
  const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
  const VALID_PROGRESS_LEVELS = new Set(['mastered', 'review', 'weak', '']);
  const $p = id => document.getElementById(id);

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
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
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

  const validateStatusValue = raw => {
    if (raw == null) return;
    if (typeof raw !== 'string') throw new Error('Invalid status payload');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error('Progress status is not valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Progress status must be an object');
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key !== 'string' || !key.includes('::') || !VALID_PROGRESS_LEVELS.has(value)) {
        throw new Error('Progress status contains an invalid item');
      }
    }
  };

  const validateBackup = (data, sourceSize) => {
    if (sourceSize > MAX_BACKUP_BYTES) throw new Error('Backup file is too large');
    if (!data || data.schema !== BACKUP_SCHEMA || data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error('Unsupported backup schema');
    }
    if (!data.storage || typeof data.storage !== 'object' || Array.isArray(data.storage)) {
      throw new Error('Backup storage is invalid');
    }
    const normalized = {};
    for (const [key, value] of Object.entries(data.storage)) {
      if (!key.startsWith(STORAGE_PREFIX) || typeof value !== 'string') {
        throw new Error('Backup contains unsupported storage keys');
      }
      normalized[key] = value;
    }
    validateStatusValue(normalized[STATUS_KEY]);
    return normalized;
  };

  const removeMedicalStorage = () => {
    [...Array(localStorage.length)]
      .map((_, index) => localStorage.key(index))
      .filter(k => k?.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  };

  const writeStorage = values => {
    removeMedicalStorage();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  };

  const replaceStorageTransactionally = async incoming => {
    const previous = safeStorageKeys();
    try {
      writeStorage(incoming);
      const written = safeStorageKeys();
      if (JSON.stringify(written) !== JSON.stringify(incoming)) {
        throw new Error('Backup verification failed after writing');
      }
      validateStatusValue(written[STATUS_KEY]);
      await globalThis.MEQProgressResilience?.snapshotNow?.();
    } catch (error) {
      try {
        writeStorage(previous);
        await globalThis.MEQProgressResilience?.snapshotNow?.();
      } catch (rollbackError) {
        console.error('Progress rollback failed:', rollbackError);
      }
      throw error;
    }
  };

  $p('exportProgressBtn')?.addEventListener('click', () => {
    downloadJson(`medical-meq-progress-${new Date().toISOString().slice(0, 10)}.json`, {
      schema: BACKUP_SCHEMA,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      storage: safeStorageKeys()
    });
    toast('Progress backup downloaded.');
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
        const raw = await file.text();
        const incoming = validateBackup(JSON.parse(raw), new Blob([raw]).size);
        await replaceStorageTransactionally(incoming);
        toast('Progress restored. Reloading…');
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        console.warn('Progress import rejected:', error);
        toast('The backup was rejected and your current progress was kept.');
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
    installBtn.textContent = '＋ Add to Home Screen';
    installBtn.addEventListener('click', () => toast('Open Share, then choose “Add to Home Screen”.'));
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn) {
      installBtn.hidden = false;
      installBtn.textContent = '⬇ Install App';
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
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
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
