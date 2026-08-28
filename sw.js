// ============================================================
// POLYGAME PWA SERVICE WORKER (NETWORK-FIRST WITH CACHE PURGE)
// ============================================================

const CACHE_NAME = 'polygame-pwa-v1.5.198';

// Install: Skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: Purge ALL old cache versions to enforce latest site updates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim().catch(() => {});
    })
  );
});

// Fetch: Pure Network-First strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  if (!url.startsWith('http://') && !url.startsWith('https://')) return;
  if (url.includes('supabase.co') || url.includes('polygon-rpc') || req.method !== 'GET') return;

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
