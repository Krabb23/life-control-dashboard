const CACHE_NAME = 'life-control-dashboard-pwa-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      const indexResponse = await fetch('./index.html');
      const indexHtml = await indexResponse.clone().text();
      await cache.put('./index.html', indexResponse);
      const assetUrls = [...indexHtml.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((match) => match[1]);
      await cache.addAll([...new Set(assetUrls)]);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok || response.type === 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        if (event.request.mode === 'navigate') {
          return (await caches.match('./index.html')) || (await caches.match('./'));
        }

        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })(),
  );
});
