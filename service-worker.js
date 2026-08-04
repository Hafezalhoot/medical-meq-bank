const APP_VERSION = '2026.08.04.2';
const CACHE_NAME = `medical-meq-bank-${APP_VERSION}`;
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
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  OFFLINE_PAGE,
  ...LECTURE_ASSETS
];

self.addEventListener('install', event => {
  const isFirstInstall = !self.registration.active;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(REQUIRED_ASSETS);
    if (isFirstInstall) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
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
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isSafeAppResponse(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
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
