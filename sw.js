// PROD SW (dynamic base)
const VERSION = 'v10';
const CACHE = `ccs-gm-${VERSION}`;

// Determine the base path from the SW scope (works on GitHub Pages and subfolders)
const ROOT = new URL(self.registration.scope).pathname.replace(/\/$/, '');

const ASSETS = [
  `${ROOT}/`,
  `${ROOT}/index.html`,
  `${ROOT}/style.css`,
  `${ROOT}/app.js`,
  `${ROOT}/manifest.webmanifest`,
  `${ROOT}/icon-192.png`,
  `${ROOT}/icon-512.png`,
  `${ROOT}/icon-180.png`,
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // SPA navigation fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(`${ROOT}/index.html`).then(r => r || fetch(e.request))
    );
    return;
  }

  // Cache-first, then update
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
