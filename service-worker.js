const APP_VERSION = '2026.08.03.17';
const CACHE_NAME = `medical-meq-bank-${APP_VERSION}`;
const OFFLINE_PAGE = './offline/Medical_MEQ_Review_Bank_Offline.html';
const LECTURE_ASSETS = /*__LECTURE_ASSETS__*/ [];

const REQUIRED_ASSETS = [
  './index.html',
  './app.css',
  './app.js',
  './progress-resilience.js',
  './lecture-loader.js',
  './pwa-client.js',
  OFFLINE_PAGE,
  ...LECTURE_ASSETS
];

const OPTIONAL_ASSETS = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

const APP_SHELL_PATHS = new Set(['/', '/index.html']);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(REQUIRED_ASSETS);
    await Promise.allSettled(
      OPTIONAL_ASSETS.map(asset => cache.add(asset))
    );
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('medical-meq-bank-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const isSafeAppResponse = response => {
  if (!response || !response.ok || response.redirected) return false;
  try {
    return new URL(response.url).origin === self.location.origin;
  } catch (error) {
    return false;
  }
};

const isAppShellNavigation = url => {
  const normalized = url.pathname.endsWith('/') && url.pathname !== '/'
    ? url.pathname.slice(0, -1)
    : url.pathname;
  return APP_SHELL_PATHS.has(normalized || '/');
};

const networkOnlyVersion = async request => {
  try {
    return await fetch(new Request(request, {cache: 'no-store'}));
  } catch (error) {
    return new Response(
      JSON.stringify({error: 'VERSION_UNAVAILABLE'}),
      {status: 503, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}}
    );
  }
};

const handleNavigation = async request => {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (isSafeAppResponse(response) && isAppShellNavigation(url)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('./index.html', response.clone());
    }
    return response;
  } catch (error) {
    return (
      await caches.match(request) ||
      await caches.match('./index.html') ||
      await caches.match(OFFLINE_PAGE) ||
      new Response('Offline', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}})
    );
  }
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
