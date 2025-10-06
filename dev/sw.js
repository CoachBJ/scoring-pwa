// DEV SW (scoped to /dev)
const CACHE = 'scoring-dev-v1'; // bump when you change dev files
const ASSETS = [
  '/scoring-pwa/dev/',
  '/scoring-pwa/dev/index.html',
  '/scoring-pwa/dev/manifest.webmanifest',

  // If you copied dev assets into /dev:
  '/scoring-pwa/dev/style.css',
  '/scoring-pwa/dev/app.js',
  '/scoring-pwa/dev/icon-192.png',
  '/scoring-pwa/dev/icon-512.png',
  '/scoring-pwa/dev/icon-180.png',

  // OR, if you reuse prod assets from root (comment the 4 lines above and use these):
  // '/scoring-pwa/style.css',
  // '/scoring-pwa/app.js',
  // '/scoring-pwa/icon-192.png',
  // '/scoring-pwa/icon-512.png',
  // '/scoring-pwa/icon-180.png',
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
  // SPA navigation fallback to /dev/index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/scoring-pwa/dev/index.html').then((r) => r || fetch(e.request))
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
