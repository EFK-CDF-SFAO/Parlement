const CACHE_VERSION = 'v3';
const CACHE_NAME = 'cdf-parlement-' + CACHE_VERSION;

// JSON data files use network-first (always try fresh data)
const DATA_EXTENSIONS = ['.json'];

self.addEventListener('install', (event) => {
  console.log('[SW] Install ' + CACHE_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate ' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return;
  }

  const isData = DATA_EXTENSIONS.some(ext => url.pathname.endsWith(ext));

  if (isData) {
    // Network-first for JSON data
    event.respondWith(networkFirst(event.request));
  } else {
    // Network-first for everything (avoid stale cache issues)
    event.respondWith(networkFirst(event.request));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
