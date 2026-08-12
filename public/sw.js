const CACHE_NAME = 'chat-buddy-shell-v3';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key.startsWith('chat-buddy-') && key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (
    requestUrl.pathname === '/api' ||
    requestUrl.pathname.startsWith('/api/') ||
    requestUrl.pathname.includes('/proxy/') ||
    requestUrl.pathname.includes('/chat/completions')
  ) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cloned = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/index.html', cloned);
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || new Response('Offline', { status: 503 }))
    );
    return;
  }

  const isHashedAsset = requestUrl.pathname.startsWith('/assets/') || requestUrl.pathname.startsWith('/js/');
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then(async (response) => {
        if (!response.ok) return response;
        const cloned = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, cloned);
        return response;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(async (response) => {
      if (response.ok) {
        const cloned = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, cloned);
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) || new Response('', { status: 408, statusText: 'Offline' }))
  );
});
