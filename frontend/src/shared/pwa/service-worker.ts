// File: frontend/src/shared/pwa/service-worker.ts
// Production Service Worker — Sprint 6 Frozen Contract
// Cache strategies:
//   - Static assets (js/css/img/fonts): CacheFirst (fast, versioned cache)
//   - API requests (/api/): NetworkFirst with cache fallback
//   - Offline fallback: cached index.html shell
// Features: skipWaiting() + clientsClaim() for immediate activation

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// -- Cache versioning: bump on every deploy to invalidate old caches --
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `pms-static-${CACHE_VERSION}`;
const API_CACHE = `pms-api-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Static asset URL patterns (CacheFirst strategy)
const STATIC_ASSET_PATTERN = /\.(js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|eot)(\?|$)/;

// API URL pattern (NetworkFirst strategy)
const API_URL_PATTERN = /^\/api\//;

// URLs to pre-cache during install
const PRECACHE_URLS: readonly string[] = [
  '/',
  '/offline.html',
];

// -- Install: pre-cache offline fallback, then activate immediately --
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Pre-cache the offline fallback page
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch {
        // If offline.html doesn't exist yet, cache just the root
        await cache.add('/');
      }
    }),
  );
  // Skip waiting to activate new SW immediately
  self.skipWaiting();
});

// -- Activate: clean up old versioned caches, claim clients --
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.reduce<Promise<boolean>[]>((deletions, name) => {
          if (
            name !== STATIC_CACHE &&
            name !== API_CACHE &&
            name.startsWith('pms-')
          ) {
            deletions.push(caches.delete(name));
          }
          return deletions;
        }, []),
      ),
    ),
  );
  // Claim all open clients immediately
  self.clients.claim();
});

// -- Fetch: route to appropriate cache strategy --
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Strategy 1: CacheFirst for static assets (same-origin only)
  if (
    url.origin === self.location.origin &&
    STATIC_ASSET_PATTERN.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy 2: NetworkFirst for API requests
  if (API_URL_PATTERN.test(url.pathname)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Strategy 3: NetworkFirst for same-origin navigation (HTML pages)
  if (
    url.origin === self.location.origin &&
    request.mode === 'navigate'
  ) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default: network only (third-party resources)
});

// -- Sync event: background sync for meter readings --
self.addEventListener('sync', (event) => {
  if (event.tag === 'meter-sync') {
    event.waitUntil(notifyClientsToSync());
  }
});

// -- Cache Strategy Implementations --

/** CacheFirst: serve from cache, fall back to network and cache the response */
async function cacheFirst(
  request: Request,
  cacheName: string,
): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed, no cache — return a basic error response
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** NetworkFirst: try network, fall back to cache, then offline page */
async function networkFirst(
  request: Request,
  cacheName: string,
): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No network and no cached data' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/** NetworkFirst for navigation: try network, fall back to offline page */
async function networkFirstWithOfflineFallback(
  request: Request,
): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache the navigation response for offline use
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed — try cached page, then offline fallback
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Serve offline fallback page
    const offlinePage = await caches.match(OFFLINE_PAGE);
    if (offlinePage) {
      return offlinePage;
    }
    // Last resort: return a minimal offline HTML
    return new Response(
      '<!DOCTYPE html><html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } },
    );
  }
}

/** Notify all clients to trigger background sync */
async function notifyClientsToSync(): Promise<void> {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_METER_READINGS' });
  }
}
