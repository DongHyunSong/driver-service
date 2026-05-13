const CACHE_NAME = 'drvpay-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/checkin.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/employer.js',
  '/js/driver.js',
  '/manifest.json'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 네트워크 우선
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // 정적 자산은 캐시 우선
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

// ── Push Notification Handler ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Driver Attendance', body: 'You have a new notification.' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'schedule-notify',
    renotify: true,
    requireInteraction: false,
    data: data.data || {}
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification Click Handler ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const driverId = event.notification.data?.driverId;
  const targetUrl = driverId ? `/checkin/${driverId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/checkin/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
