/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

// Всё приложение кладём в кэш: открывается без интернета.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('message', e => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

// Пуш с сервера: { title, body, url, tag }
self.addEventListener('push', e => {
  let d: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { d = e.data?.json() ?? {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Лайф Сити', {
    body: d.body || '', tag: d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './#/day' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data?.url as string) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await (c as WindowClient).navigate(url).catch(() => {}); return (c as WindowClient).focus(); } }
    return self.clients.openWindow(url);
  })());
});
