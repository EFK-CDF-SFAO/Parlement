const CACHE_NAME = 'cdf-parlement-v2';
const STATIC_CACHE = 'cdf-static-v2';
const DATA_CACHE = 'cdf-data-v2';

// Base path - adapts to GitHub Pages subdirectory
const BASE_PATH = self.registration.scope;

const STATIC_FILES = [
  '',
  'home.html',
  'home_de.html',
  'home_it.html',
  'objects.html',
  'objects_de.html',
  'objects_it.html',
  'debates.html',
  'debates_de.html',
  'debates_it.html',
  'stats.html',
  'stats_de.html',
  'stats_it.html',
  'styles.css',
  'session-animation.css',
  'home.js',
  'home_de.js',
  'home_it.js',
  'app.js',
  'app_de.js',
  'app_it.js',
  'debates.js',
  'debates_de.js',
  'debates_it.js',
  'stats.js',
  'stats_de.js',
  'stats_it.js',
  'favicon.svg',
  'manifest.json'
];

const DATA_FILES = [
  'cdf_efk_data.json',
  'debates_data.json',
  'sessions.json',
  'rapports_cdf.json',
  'rapports_matches.json'
];

const STATIC_ASSETS = STATIC_FILES.map(f => BASE_PATH + f);
const DATA_URLS = DATA_FILES.map(f => BASE_PATH + f);

self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { cache: 'reload' });
        })).catch(err => {
          console.warn('[SW] Certaines ressources n\'ont pas pu être mises en cache:', err);
        });
      }),
      caches.open(DATA_CACHE).then((cache) => {
        console.log('[SW] Mise en cache des données');
        return Promise.all(
          DATA_URLS.map(url => 
            fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(() => console.warn(`[SW] Impossible de mettre en cache: ${url}`))
          )
        );
      })
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (DATA_URLS.some(dataUrl => url.pathname.endsWith(dataUrl.replace('/', '')))) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  } else {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    return new Response('Contenu non disponible hors-ligne', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Données non disponibles hors-ligne' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
