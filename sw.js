// Akash Fitness PWA Service Worker — Network-First for HTML/App Shell, Never Cache APIs
const CACHE_NAME = 'akash-fitness-shell-v20260901-v6';

// Assets to precache (static UI shell fallbacks)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache Supabase API, RPC, REST, Auth, or WebSockets
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rpc/') ||
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/') ||
    event.request.headers.get('Upgrade') === 'websocket'
  ) {
    return; // Pass through to network directly
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Navigation requests (HTML documents) — Network First, fallback to cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Static assets (scripts, styles, images) — Network First with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
