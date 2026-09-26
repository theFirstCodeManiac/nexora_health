export interface ServiceWorkerCacheStats {
  registered: boolean;
  activeState: string;
  coreAssetsCount: number;
  apiRoutesCached: string[];
  runtimeAssetsCount: number;
}

const CORE_CACHE_NAME = 'nexora-core-assets-v2';
const API_CACHE_NAME = 'nexora-critical-api-v2';
const RUNTIME_CACHE_NAME = 'nexora-runtime-assets-v2';

export async function registerNexoraServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw-offline.js', {
      scope: '/',
    });

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.warn('Service worker registration skipped or restricted in frame:', error);
    return null;
  }
}

export async function warmUpCriticalApiCaches(
  token: string,
  role: 'worker' | 'supervisor'
): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    // 1. Direct Cache Storage write so even if SW controller is still claiming, CacheStorage has the API responses
    const apiCache = await caches.open(API_CACHE_NAME);
    const endpoints = ['/api/bootstrap', '/api/auth/session'];

    await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Nexora-Role': role,
            },
          });
          if (response.ok) {
            await apiCache.put(endpoint, response.clone());
          }
        } catch {
          // Ignore network error when offline
        }
      })
    );

    // 2. Also pre-cache core shell URLs into CORE_CACHE_NAME
    const coreCache = await caches.open(CORE_CACHE_NAME);
    const coreUrls = [
      '/',
      '/index.html',
      '/icon.svg',
      '/apple-touch-icon.png',
      '/pwa-192x192.png',
      '/pwa-512x512.png',
      '/pwa-maskable-512x512.png',
    ];
    await Promise.all(
      coreUrls.map(async (url) => {
        try {
          const existing = await coreCache.match(url);
          if (!existing) {
            const res = await fetch(url);
            if (res.ok) await coreCache.put(url, res.clone());
          }
        } catch {
          // Ignore offline error
        }
      })
    );

    // 3. Notify active Service Worker if controlling the page
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'WARM_API_CACHE',
        token,
        role,
      });
    }
  } catch (err) {
    console.warn('Cache warm-up warning:', err);
  }
}

export async function getServiceWorkerCacheStats(): Promise<ServiceWorkerCacheStats> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return {
      registered: false,
      activeState: 'Unsupported',
      coreAssetsCount: 0,
      apiRoutesCached: [],
      runtimeAssetsCount: 0,
    };
  }

  try {
    const reg =
      'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    const swState = reg?.active
      ? 'Active & Controlling'
      : reg?.installing || reg?.waiting
        ? 'Installing'
        : 'CacheStorage Ready';

    const [coreCache, apiCache, runtimeCache] = await Promise.all([
      caches.open(CORE_CACHE_NAME),
      caches.open(API_CACHE_NAME),
      caches.open(RUNTIME_CACHE_NAME),
    ]);

    const [coreKeys, apiKeys, runtimeKeys] = await Promise.all([
      coreCache.keys(),
      apiCache.keys(),
      runtimeCache.keys(),
    ]);

    const apiRoutesCached = apiKeys.map((req) => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return req.url;
      }
    });

    return {
      registered: Boolean(reg),
      activeState: swState,
      coreAssetsCount: coreKeys.length,
      apiRoutesCached,
      runtimeAssetsCount: runtimeKeys.length,
    };
  } catch {
    return {
      registered: false,
      activeState: 'Restricted',
      coreAssetsCount: 0,
      apiRoutesCached: [],
      runtimeAssetsCount: 0,
    };
  }
}
