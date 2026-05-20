const CACHE_NAME = 'embaixada-digital-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://img.icons8.com/color/192/shield.png',
  'https://img.icons8.com/color/512/shield.png'
];

// skipWaiting on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-caching warning:', err);
      });
    })
  );
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('Deletando cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip Firebase APIs, Firestore websockets, auth requests
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  // 1. Navigation requests & index.html: Network-First Strategy
  // This ensures users always get the latest layout when online!
  if (
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If valid response, cache it
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If '/' or '/index.html' matches but with different parameters, fallback to basic index
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 2. Static assets (JS, CSS, fonts, icons): Stale-While-Revalidate Strategy
  // This loads static files fast and updates them in background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ignore network errors for background fetch
        });

      return cachedResponse || fetchPromise;
    })
  );
});
