const APP_VERSION = '2026.10.21.4';
const CACHE_NAME = `medical-meq-bank-${APP_VERSION}`;
const USER_LESSON_CACHE = 'medical-meq-bank-user-lessons-v1';
const OFFLINE_PAGE = './offline/Medical_MEQ_Review_Bank_Offline.html';
const LECTURE_ASSETS = /*__LECTURE_ASSETS__*/ [];
const REQUIRED_ASSETS = [
  './',
  './index.html',
  './404.html',
  './app.css',
  './app.js',
  './progress-resilience.js',
  './lecture-loader.js',
  './pwa-client.js',
  './review-filter.css',
  './review-filter.js',
  './responsive-sidebars.js',
  './mobile-filters.css',
  './mobile-filters.js',
  './search-optimization.js',
  './print-manager.css',
  './print-manager.js',
  './back-to-top.css',
  './back-to-top.js',
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  ...LECTURE_ASSETS
].map(asset => /\.(?:css|js)$/.test(asset) ? asset + '?v=' + APP_VERSION : asset);
const OPTIONAL_ASSETS = [];

self.addEventListener('install', event => {
  const isFirstInstall = !self.registration.active;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(REQUIRED_ASSETS);
    await Promise.allSettled(OPTIONAL_ASSETS.map(asset => cache.add(asset)));
    if (isFirstInstall) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldReleases = keys.filter(key =>
      key.startsWith('medical-meq-bank-') &&
      key !== CACHE_NAME && key !== USER_LESSON_CACHE
    );
    // Migrate previously saved source lectures/figures before retiring an
    // older release. Never migrate old CSS or JS into the new application.
    const personal = await caches.open(USER_LESSON_CACHE);
    for (const release of oldReleases) {
      const old = await caches.open(release);
      for (const request of await old.keys()) {
        const path = new URL(request.url).pathname;
        if (!(/^\/lectures\/(?:data|search)\//.test(path) ||
              /^\/assets\/lectures\//.test(path))) continue;
        if (await personal.match(request)) continue;
        const response = await old.match(request);
        if (response?.ok) await personal.put(request, response);
      }
    }
    await Promise.all(oldReleases.map(release => caches.delete(release)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const isSafeAppResponse = response => {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const contentType = response.headers.get('content-type') || '';
  return !contentType.includes('text/html') || response.url.endsWith('.html');
};

const networkOnlyVersion = async request => {
  try {
    return await fetch(request, {cache: 'no-store'});
  } catch (error) {
    return new Response(JSON.stringify({version: APP_VERSION, offline: true}), {
      status: 503,
      headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}
    });
  }
};

const handleNavigation = async request => {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('./index.html', response.clone());
      return response;
    }
  } catch (error) {
    // Fall through to the shell or standalone offline page.
  }
  return (await caches.match('./index.html')) ||
    (await caches.match(OFFLINE_PAGE)) ||
    new Response('Medical MEQ Bank is unavailable offline.', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8'}
    });
};

const handleAsset = async request => {
  // A prior service worker may still be controlling this tab while the
  // server returns newer HTML. Never search all caches for a CSS/JS file.
  const releaseCache = await caches.open(CACHE_NAME);
  const cached = await releaseCache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isSafeAppResponse(response)) {
      await releaseCache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Personal downloaded lecture data remains available when disconnected.
    const path = new URL(request.url).pathname;
    if (/^\/lectures\/(?:data|search)\//.test(path) ||
        /^\/assets\/lectures\//.test(path)) {
      const personal = await caches.open(USER_LESSON_CACHE);
      const response = await personal.match(request);
      if (response) return response;
    }
    throw error;
  }
};

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(networkOnlyVersion(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleAsset(request));
});
