// Service worker: web push only. It caches nothing, so it cannot serve a stale app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch { /* a malformed payload still shows something */ }
  e.waitUntil((async () => {
    // Already looking at the app: the bell has it, so a banner would only repeat it.
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (open.some((c) => c.focused && c.visibilityState === 'visible')) return;
    await self.registration.showNotification(n.title || 'The Fluency Talks', {
      body: n.body || 'You have a new notification.',
      icon: '/favicon.png',
      badge: '/favicon.png',
      // Several events about one post replace each other rather than stacking up.
      tag: n.tag || undefined,
      renotify: !!n.tag,
      data: { url: n.url || '/notifications' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/notifications', self.location.origin).href;
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = open.find((c) => new URL(c.url).origin === self.location.origin);
    if (mine) { await mine.focus(); return mine.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
