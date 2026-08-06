// ============================================================
// POLYGAME PWA SERVICE WORKER (NETWORK-FIRST WITH CACHE FALLBACK)
// ============================================================

const CACHE_NAME = 'polygame-pwa-v1.4.325';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './pgt-token-icon.jpg',
  './src/js/app.js',
  './src/js/core/config.js',
  './src/js/core/state.js',
  './src/js/core/db-sync.js',
  './src/js/core/ui.js',
  './drift.js',
  './game.js',
  './invaders.js',
  './space.js'
];

// Install: Cache static core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[PWA SW] Pre-cache warning:", err);
      });
    })
  );
});

// Activate: Purge old cache versions and unregister
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.registration.unregister()).then(() => self.clients.claim())
  );
});

// Fetch: Network-First strategy (always get fresh site updates, fallback to cache if offline)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Bypass non-HTTP/HTTPS schemes (e.g., chrome-extension://, moz-extension://, data:, blob:)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  // Bypass API requests & WebSocket / Supabase REST connections completely
  if (url.includes('supabase.co') || url.includes('polygon-rpc') || url.includes('eth') || req.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
