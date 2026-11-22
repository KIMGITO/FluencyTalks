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
    // A call: the server sends this again every few seconds while it rings, and each one sounds and vibrates
    // again (renotify on the same tag), so it rings rather than buzzing once.
    await self.registration.showNotification(n.title || 'The Fluency Talks', {
      body: n.body || 'You have a new notification.',
      ...(n.call ? { vibrate: [600, 300, 600, 300, 600], silent: false, actions: [{ action: 'answer', title: 'Answer' }] } : {}),
      icon: '/favicon.png',
      badge: '/favicon.png',
      // Several events about one post replace each other rather than stacking up.
      tag: n.tag || undefined,
      renotify: !!n.tag,
      // An incoming call stays on screen until it's dealt with, and a missed call replaces it (same tag).
      requireInteraction: !!n.call,
      data: { url: n.url || '/notifications', call: !!n.call },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = new URL(d.url || '/notifications', self.location.origin);
  // "Answer" opens the call and joins it straight away; tapping the banner itself opens the ringing screen.
  if (d.call && e.action === 'answer') target.searchParams.set('answer', '1');
  const url = target.href;
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = open.find((c) => new URL(c.url).origin === self.location.origin);
    if (mine) { await mine.focus(); return mine.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
