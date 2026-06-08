// Sound It — Service Worker for Push Notifications
// Must be at the root scope: /service-worker.js

const CACHE_NAME = 'soundit-v2';
const urlsToCache = [
  '/',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

// ========== INSTALL & ACTIVATE ==========

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ========== PUSH NOTIFICATIONS ==========

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Sound It',
      body: event.data.text()
    };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/android-chrome-192x192.png',
    badge: data.badge || '/android-chrome-192x192.png',
    tag: data.tag || data.data?.notification_id?.toString() || 'soundit-notification',
    requireInteraction: true,
    actions: data.actions || [],
    data: data.data || {}
  };

  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Sound It', options)
  );

  // Update badge count
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge().catch(() => {});
  }
});

// ========== NOTIFICATION CLICK ==========

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') {
    return;
  }

  let url = data.action_url || '/';

  if (action === 'accept' && data.category === 'booking') {
    url = `/dashboard/artist/bookings?action=accept&id=${data.payload?.booking_id || ''}`;
  } else if (action === 'decline' && data.category === 'booking') {
    url = `/dashboard/artist/bookings?action=decline&id=${data.payload?.booking_id || ''}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NOTIFICATION_CLICK', url, data });
            client.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );

  // Clear badge
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }
});
