/* ------------------------------------------------------------------
   Service worker — Web Push handler
------------------------------------------------------------------- */

/* Push received */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Bright Future', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Bright Future';
  const options = {
    body: data.body || '',
    icon: data.icon || '/school-logo.png',
    badge: data.icon || '/school-logo.png',
    tag: data.tag || 'bright-future',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* Notification clicked */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an existing tab if it's already open
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      // Otherwise open a new one
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* Take control ASAP */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));