// v4 - Minimal SW: clean up old caches, don't intercept requests
// This ensures the PWA install works without breaking any page functionality

self.addEventListener('install', (event) => {
  console.log('[SW] v4 installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] v4 activated - cleaning old caches');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map(n => caches.delete(n)));
    }).then(() => self.clients.claim())
  );
});

// No fetch handler = all requests go directly to the network
// This avoids any caching issues while still enabling PWA install
