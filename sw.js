// Simple PWA cache for offline use
const CACHE = 'scoring-v33';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((resp) => {
        const respClone = resp.clone();
        caches.open(CACHE).then((cache) => {
          // Only cache same-origin GETs
          try {
            if (request.url.startsWith(self.location.origin)) {
              cache.put(request, respClone);
            }
          } catch(_) {}
        });
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
