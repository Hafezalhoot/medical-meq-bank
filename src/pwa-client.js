(() => {
  const APP_VERSION = '2026.08.02.1';
  const $p = id => document.getElementById(id);
  const toast = message => {
    const el = $p('appToast'); if(!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(window.__meqToastTimer);
    window.__meqToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  };
  const safeStorageKeys = () => {
    const out = {};
    try {
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && k.startsWith('medicalBank')) out[k] = localStorage.getItem(k);
      }
    } catch(e) {}
    return out;
  };
  const downloadJson = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const exportBtn = $p('exportProgressBtn');
  if(exportBtn) exportBtn.addEventListener('click', () => {
    const payload = {schema:'medical-meq-progress', schemaVersion:1, appVersion:APP_VERSION, exportedAt:new Date().toISOString(), storage:safeStorageKeys()};
    downloadJson(`medical-meq-progress-${new Date().toISOString().slice(0,10)}.json`, payload);
    toast('Progress backup downloaded.');
  });
  const importBtn = $p('importProgressBtn'), importFile = $p('importProgressFile');
  if(importBtn && importFile){
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files && importFile.files[0]; if(!file) return;
      try {
        const data = JSON.parse(await file.text());
        if(!data || data.schema !== 'medical-meq-progress' || !data.storage || typeof data.storage !== 'object') throw new Error('Invalid backup file');
        [...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).filter(k=>k&&k.startsWith('medicalBank')).forEach(k=>localStorage.removeItem(k));
        Object.entries(data.storage).forEach(([k,v]) => { if(k.startsWith('medicalBank') && typeof v === 'string') localStorage.setItem(k,v); });
        toast('Progress restored. Reloading…'); setTimeout(() => location.reload(), 700);
      } catch(e){ toast('This is not a valid MEQ Bank backup file.'); }
      importFile.value = '';
    });
  }
  const connectionPill = $p('connectionPill'), connectionText = $p('connectionText');
  const updateConnection = () => {
    const online = navigator.onLine;
    if(connectionPill) connectionPill.classList.toggle('offline', !online);
    if(connectionText) connectionText.textContent = online ? 'Online' : 'Offline ready';
  };
  window.addEventListener('online', () => { updateConnection(); toast('Back online.'); });
  window.addEventListener('offline', () => { updateConnection(); toast('Offline mode is active.'); });
  updateConnection();

  let deferredPrompt = null;
  const installBtn = $p('installAppBtn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if(installBtn && !isStandalone && isIOS){
    installBtn.hidden = false; installBtn.textContent = '＋ Add to Home Screen';
    installBtn.addEventListener('click', () => toast('Open Share, then choose “Add to Home Screen”.'));
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredPrompt = event;
    if(installBtn){ installBtn.hidden = false; installBtn.textContent = '⬇ Install App'; }
  });
  if(installBtn && !isIOS) installBtn.addEventListener('click', async () => {
    if(!deferredPrompt){ toast('Installation becomes available after the page finishes loading.'); return; }
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if(installBtn) installBtn.hidden = true; toast('MEQ Bank installed successfully.'); });

  const banner = $p('updateBanner'), applyBtn = $p('applyUpdateBtn');
  const showUpdate = registration => {
    if(!banner) return; banner.classList.add('show');
    if(applyBtn) applyBtn.onclick = () => registration.waiting && registration.waiting.postMessage({type:'SKIP_WAITING'});
  };
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if(!refreshing){ refreshing = true; location.reload(); } });
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', {scope:'./'});
        if(registration.waiting) showUpdate(registration);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing; if(!worker) return;
          worker.addEventListener('statechange', () => { if(worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration); });
        });
        setInterval(() => registration.update().catch(()=>{}), 30 * 60 * 1000);
        window.addEventListener('focus', () => registration.update().catch(()=>{}));
      } catch(e){ console.warn('Service worker registration failed', e); }
    });
  }
})();
