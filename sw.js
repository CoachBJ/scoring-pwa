// PROD SW (root)
const CACHE = 'scoring-prod-v4'; // bump on each release
const ASSETS = [
  '/scoring-pwa/',
  '/scoring-pwa/index.html',
  '/scoring-pwa/style.css',
  '/scoring-pwa/app.js',
  '/scoring-pwa/manifest.webmanifest',
  '/scoring-pwa/icon-192.png',
  '/scoring-pwa/icon-512.png',
  '/scoring-pwa/icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // SPA navigation fallback to index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/scoring-pwa/index.html').then((r) => r || fetch(e.request))
    );
    return;
  }

  // Cache-first, then update cache
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
