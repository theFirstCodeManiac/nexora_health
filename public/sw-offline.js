const CORE_CACHE_NAME = 'nexora-core-assets-v2';
const API_CACHE_NAME = 'nexora-critical-api-v2';
const RUNTIME_CACHE_NAME = 'nexora-runtime-assets-v2';

const CORE_PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/manifest.webmanifest',
];

const CRITICAL_GET_API_PATHS = ['/api/bootstrap', '/api/auth/session'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(async (cache) => {
      for (const url of CORE_PRECACHE_URLS) {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response && response.ok) {
            await cache.put(url, response.clone());
          }
        } catch (_err) {
          // Ignore individual asset failure during install
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = [CORE_CACHE_NAME, API_CACHE_NAME, RUNTIME_CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!allowedCaches.includes(cacheName) && cacheName.startsWith('nexora-')) {
              return caches.delete(cacheName);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Listen for messages from the client to pre-warm or purge sensitive caches on sign-out
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_SENSITIVE_CACHES') {
    event.waitUntil(
      Promise.all([
        caches.delete(API_CACHE_NAME),
        caches.delete('nexora-critical-api-v1'),
      ])
    );
  }

  if (event.data.type === 'WARM_API_CACHE' && event.data.token) {
    const token = event.data.token;
    event.waitUntil(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        for (const apiPath of CRITICAL_GET_API_PATHS) {
          try {
            const req = new Request(apiPath, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(apiPath, res.clone());
            }
          } catch (_err) {
            // Ignore warm-up error if already offline
          }
        }
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP/HTTPS requests or Vite internal dev client requests
  if (!url.protocol.startsWith('http')) return;
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.includes('__vite_ping')
  ) {
    return;
  }

  // Only cache GET requests
  if (request.method !== 'GET') return;

  // 1. Critical GET API Routes (/api/bootstrap, /api/auth/session) -> NetworkFirst with Cache Fallback
  // Require Authorization header on request so unauthenticated callers cannot read cached PHI
  if (CRITICAL_GET_API_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(
      (async () => {
        const hasAuthHeader = request.headers.has('Authorization');
        const cache = await caches.open(API_CACHE_NAME);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && hasAuthHeader) {
            await cache.put(url.pathname, networkResponse.clone());
          }
          return networkResponse;
        } catch (_err) {
          if (!hasAuthHeader) {
            return new Response(
              JSON.stringify({ error: 'Authentication required for offline cache access.' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }
          const cachedResponse =
            (await cache.match(url.pathname)) || (await cache.match(request));
          if (cachedResponse) {
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Nexora-Offline-Cache', 'HIT');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers,
            });
          }
          return new Response(
            JSON.stringify({
              error: 'Offline and no cached API snapshot found.',
              offline: true,
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }
      })()
    );
    return;
  }

  // 2. HTML Navigation Requests -> NetworkFirst with /index.html Offline Shell Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const coreCache = await caches.open(CORE_CACHE_NAME);
            await coreCache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch (_err) {
          const coreCache = await caches.open(CORE_CACHE_NAME);
          const cachedShell =
            (await coreCache.match('/index.html')) || (await coreCache.match('/'));
          if (cachedShell) return cachedShell;
          return new Response('NEXORA Offline Shell unavailable', { status: 503 });
        }
      })()
    );
    return;
  }

  // 3. Core Application Assets (JS, TS/TSX modules, CSS, Fonts, Icons, Manifest) -> NetworkFirst with Cache Fallback
  const isStaticOrModuleAsset =
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticOrModuleAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE_NAME);
        try {
          const networkRes = await fetch(request);
          if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
            await cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch (_err) {
          const cached =
            (await cache.match(request)) ||
            (await (await caches.open(CORE_CACHE_NAME)).match(url.pathname));
          if (cached) {
            return cached;
          }
          return new Response('Offline asset unavailable', { status: 504 });
        }
      })()
    );
  }
});
