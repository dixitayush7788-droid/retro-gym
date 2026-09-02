// Akash Fitness PWA Service Worker — network-first app shell, never cache Supabase/API.
const CACHE_NAME = 'akash-fitness-shell-v20260902-canonical-v1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './nexus-member-ui.js',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Never cache Supabase, API, RPC, Auth, WebSocket
  if (
    u.hostname.includes('supabase.co') ||
    u.pathname.includes('/rpc/') ||
    u.pathname.includes('/rest/') ||
    u.pathname.includes('/auth/') ||
    e.request.headers.get('Upgrade') === 'websocket'
  ) {
    return;
  }
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r && r.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r && r.status === 200) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, r.clone()));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
