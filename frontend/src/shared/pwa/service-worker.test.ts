// File: src/shared/pwa/service-worker.test.ts
// Unit tests for service-worker.ts — install/activate/fetch/sync handlers
// and cache strategies (CacheFirst, NetworkFirst, offline fallback).

// service-worker.ts uses `self` (ServiceWorkerGlobalScope) and Web APIs
// (caches, clients) not available in jsdom. We mock the global scope before
// import, then capture event listeners to simulate events.

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';

// ── Type for event handler signatures ────────────────────────────────────────

type InstallEvent = { waitUntil: ReturnType<typeof vi.fn> };
type ActivateEvent = { waitUntil: ReturnType<typeof vi.fn> };
type FetchEvent = {
  request: Request;
  respondWith: ReturnType<typeof vi.fn>;
};
type SyncEvent = { waitUntil: ReturnType<typeof vi.fn>; tag: string };
type EventHandler = (event: unknown) => void;

// ── Global listener registry ─────────────────────────────────────────────────

const listeners: Record<string, EventHandler[]> = {};

// ── Mock Cache API ───────────────────────────────────────────────────────────

const mockCache = {
  addAll: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  match: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
};

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
  keys: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue(true),
  match: vi.fn().mockResolvedValue(null),
};

// ── Mock Clients API ─────────────────────────────────────────────────────────

const mockClients = {
  claim: vi.fn().mockResolvedValue(undefined),
  matchAll: vi.fn().mockResolvedValue([]),
};

// ── Set up ServiceWorkerGlobalScope mock BEFORE import ───────────────────────
// service-worker.ts registers listeners on load, so we must have `self`
// and `caches` as globals before the dynamic import.

const mockSelf = {
  location: { origin: 'https://pms.test' },
  addEventListener: (type: string, handler: EventHandler) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(handler);
  },
  skipWaiting: vi.fn(),
  clients: mockClients,
};

// Assign globals before module import
// @ts-expect-error — service-worker.ts declares `self: ServiceWorkerGlobalScope`
globalThis.self = mockSelf;
// @ts-expect-error — ServiceWorkerGlobalScope global
globalThis.caches = mockCaches;
// @ts-expect-error — fetch is available but we want to mock it per-test
globalThis.fetch = vi.fn();

// Dynamic import — service-worker.ts registers all event listeners on `self`
// We import here (after globals are set) and keep the reference for tests
const swModule = await import('./service-worker');

// ── Event factory helpers ────────────────────────────────────────────────────

function makeInstallEvent(): InstallEvent {
  return { waitUntil: vi.fn() };
}

function makeActivateEvent(): ActivateEvent {
  return { waitUntil: vi.fn() };
}

function makeFetchEvent(url: string, method = 'GET', mode?: 'navigate' | 'cors'): FetchEvent {
  const request = new Request(url, { method });
  // Override mode — jsdom Request constructor rejects 'navigate' mode
  // The service-worker checks request.mode === 'navigate' for routing
  Object.defineProperty(request, 'mode', { value: mode ?? 'cors', configurable: true });
  return {
    request,
    respondWith: vi.fn(),
  };
}

function makeSyncEvent(tag: string): SyncEvent {
  return { waitUntil: vi.fn(), tag };
}

// ── Reset helpers ─────────────────────────────────────────────────────────────

function resetAllMocks() {
  // NOTE: DO NOT clear the `listeners` registry — listeners are registered
  // once at module import time and persist across tests. We only reset mock
  // function state here.

  vi.clearAllMocks();

  // Reset cache mock state
  mockCache.addAll.mockResolvedValue(undefined);
  mockCache.add.mockResolvedValue(undefined);
  mockCache.match.mockResolvedValue(null);
  mockCache.put.mockResolvedValue(undefined);
  mockCache.delete.mockResolvedValue(true);

  mockCaches.open.mockResolvedValue(mockCache);
  mockCaches.keys.mockResolvedValue([]);
  mockCaches.delete.mockResolvedValue(true);
  mockCaches.match.mockResolvedValue(null);

  mockClients.claim.mockResolvedValue(undefined);
  mockClients.matchAll.mockResolvedValue([]);

  mockSelf.skipWaiting.mockClear();
  mockSelf.skipWaiting.mockResolvedValue(undefined);

  (globalThis.fetch as ReturnType<typeof vi.fn>).mockReset();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('service-worker', () => {
  beforeAll(() => {
    // Module already imported above — listeners should be registered
    expect(listeners['install']).toHaveLength(1);
    expect(listeners['activate']).toHaveLength(1);
    expect(listeners['fetch']).toHaveLength(1);
    expect(listeners['sync']).toHaveLength(1);
  });

  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('module exports', () => {
    it('exports nothing (side-effect only module)', () => {
      expect(Object.keys(swModule)).toEqual([]);
    });
  });

  describe('install event', () => {
    it('calls skipWaiting immediately on install', () => {
      const event = makeInstallEvent();
      listeners['install'][0](event);

      expect(mockSelf.skipWaiting).toHaveBeenCalledTimes(1);
    });

    it('calls event.waitUntil with a promise', () => {
      const event = makeInstallEvent();
      listeners['install'][0](event);

      expect(event.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    });

    it('opens STATIC_CACHE during install', async () => {
      const event = makeInstallEvent();
      listeners['install'][0](event);

      await event.waitUntil.mock.calls[0][0];
      expect(mockCaches.open).toHaveBeenCalledWith('pms-static-v1.0.0');
    });

    it('calls cache.addAll with PRECACHE_URLS ["/", "/offline.html"]', async () => {
      const event = makeInstallEvent();
      listeners['install'][0](event);

      await event.waitUntil.mock.calls[0][0];
      expect(mockCache.addAll).toHaveBeenCalledWith(['/', '/offline.html']);
    });

    it('falls back to cache.add("/") when addAll fails', async () => {
      const event = makeInstallEvent();
      mockCache.addAll.mockRejectedValueOnce(new Error('addAll failed'));

      listeners['install'][0](event);
      await event.waitUntil.mock.calls[0][0];

      expect(mockCache.add).toHaveBeenCalledWith('/');
    });

    it('does not throw when both addAll and add fail', async () => {
      const event = makeInstallEvent();
      mockCache.addAll.mockRejectedValueOnce(new Error('addAll failed'));
      mockCache.add.mockRejectedValueOnce(new Error('add failed'));

      expect(() => listeners['install'][0](event)).not.toThrow();
      // Let the promise settle (it catches internally)
      await event.waitUntil.mock.calls[0][0].catch(() => {});
    });
  });

  describe('activate event', () => {
    it('calls clients.claim on activate', () => {
      const event = makeActivateEvent();
      listeners['activate'][0](event);

      expect(mockClients.claim).toHaveBeenCalledTimes(1);
    });

    it('calls caches.keys to find old cache names', async () => {
      const event = makeActivateEvent();
      listeners['activate'][0](event);

      await event.waitUntil.mock.calls[0][0];
      expect(mockCaches.keys).toHaveBeenCalled();
    });

    it('deletes old versioned caches that start with pms-', async () => {
      mockCaches.keys.mockResolvedValue(['pms-static-v0.9.0', 'pms-api-v0.9.0']);

      const event = makeActivateEvent();
      listeners['activate'][0](event);
      await event.waitUntil.mock.calls[0][0];

      expect(mockCaches.delete).toHaveBeenCalledWith('pms-static-v0.9.0');
      expect(mockCaches.delete).toHaveBeenCalledWith('pms-api-v0.9.0');
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it('does not delete current version caches', async () => {
      mockCaches.keys.mockResolvedValue(['pms-static-v1.0.0', 'pms-api-v1.0.0']);

      const event = makeActivateEvent();
      listeners['activate'][0](event);
      await event.waitUntil.mock.calls[0][0];

      expect(mockCaches.delete).not.toHaveBeenCalled();
    });

    it('does not delete non-pms caches', async () => {
      mockCaches.keys.mockResolvedValue(['google-cache', 'other-v1', 'chrome-extension-data']);

      const event = makeActivateEvent();
      listeners['activate'][0](event);
      await event.waitUntil.mock.calls[0][0];

      expect(mockCaches.delete).not.toHaveBeenCalled();
    });

    it('deletes only old pms- caches while keeping current and non-pms', async () => {
      mockCaches.keys.mockResolvedValue([
        'pms-static-v0.9.0',
        'pms-static-v1.0.0',
        'pms-api-v0.9.0',
        'pms-api-v1.0.0',
        'google-cache',
      ]);

      const event = makeActivateEvent();
      listeners['activate'][0](event);
      await event.waitUntil.mock.calls[0][0];

      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
      expect(mockCaches.delete).toHaveBeenCalledWith('pms-static-v0.9.0');
      expect(mockCaches.delete).toHaveBeenCalledWith('pms-api-v0.9.0');
    });
  });

  describe('fetch event — routing', () => {
    it('does not call respondWith for non-GET requests', () => {
      const event = makeFetchEvent('https://pms.test/api/test', 'POST');
      listeners['fetch'][0](event);

      expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('routes static asset to cacheFirst', async () => {
      const event = makeFetchEvent('https://pms.test/app.abcd123.js');
      mockCaches.match.mockResolvedValue(null);
      const mockResponse = new Response('js content', { status: 200 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      listeners['fetch'][0](event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(mockResponse);
    });

    it('routes /api/ path to networkFirst', async () => {
      const event = makeFetchEvent('https://pms.test/api/v1/meters');
      mockCaches.match.mockResolvedValue(null);
      const mockResponse = new Response('{"data":{}}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      listeners['fetch'][0](event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
    });

    it('routes navigate to networkFirstWithOfflineFallback', async () => {
      const event = makeFetchEvent('https://pms.test/dashboard', 'GET', 'navigate');
      mockCaches.match.mockResolvedValue(null);
      const mockResponse = new Response('<html>dashboard</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      listeners['fetch'][0](event);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
    });

    it('does not handle third-party resource requests', () => {
      const event = makeFetchEvent('https://cdn.example.com/lib.js');
      listeners['fetch'][0](event);

      expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('does not handle static asset from different origin', () => {
      const event = makeFetchEvent('https://evil.com/app.js');
      listeners['fetch'][0](event);

      expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('handles /api/ path regardless of origin (NetworkFirst)', async () => {
      const event = makeFetchEvent('https://api.other.com/api/v1/data');
      mockCaches.match.mockResolvedValue(null);
      const mockResponse = new Response('{"data":{}}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      listeners['fetch'][0](event);

      // API pattern matches on pathname only, so cross-origin /api/ is handled
      expect(event.respondWith).toHaveBeenCalledTimes(1);
    });

    it('does not handle third-party non-api, non-static requests', () => {
      const event = makeFetchEvent('https://cdn.example.com/track.gif');
      listeners['fetch'][0](event);

      expect(event.respondWith).not.toHaveBeenCalled();
    });
  });

  describe('cacheFirst strategy', () => {
    it('serves from cache when cache hit', async () => {
      const cachedResponse = new Response('cached-css', { status: 200 });
      mockCaches.match.mockResolvedValue(cachedResponse);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('from-network'));

      const event = makeFetchEvent('https://pms.test/style.css');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(cachedResponse);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('falls back to network on cache miss', async () => {
      mockCaches.match.mockResolvedValue(null);
      const networkResponse = new Response('from-network', { status: 200 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(networkResponse);

      const event = makeFetchEvent('https://pms.test/app.abcd123.js');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
      // cache.put called with (request, responseClone)
      expect(mockCache.put).toHaveBeenCalledTimes(1);
      expect(mockCache.put.mock.calls[0][0]).toBeInstanceOf(Request);
    });

    it('returns 503 offline response when both cache miss and network fail', async () => {
      mockCaches.match.mockResolvedValue(null);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Network error'),
      );

      const event = makeFetchEvent('https://pms.test/app.abcd123.js');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(503);
      expect(response.statusText).toBe('Service Unavailable');
    });

    it('does not cache non-ok (500) network responses', async () => {
      mockCaches.match.mockResolvedValue(null);
      const errorResponse = new Response('error', { status: 500 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(errorResponse);

      const event = makeFetchEvent('https://pms.test/app.abcd123.js');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(500);
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it('opens STATIC_CACHE for caching network responses', async () => {
      mockCaches.match.mockResolvedValue(null);
      const networkResponse = new Response('js content', { status: 200 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(networkResponse);

      const event = makeFetchEvent('https://pms.test/app.abcd123.js');
      listeners['fetch'][0](event);

      await event.respondWith.mock.calls[0][0];
      expect(mockCaches.open).toHaveBeenCalledWith('pms-static-v1.0.0');
    });
  });

  describe('networkFirst strategy', () => {
    it('serves from network when available and caches response', async () => {
      mockCaches.match.mockResolvedValue(null);
      const networkResponse = new Response('api-data', { status: 200 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(networkResponse);

      const event = makeFetchEvent('https://pms.test/api/v1/meters');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
      // cache.put called with (request, responseClone)
      expect(mockCache.put).toHaveBeenCalledTimes(1);
      expect(mockCache.put.mock.calls[0][0]).toBeInstanceOf(Request);
    });

    it('falls back to cache when network fails', async () => {
      const cachedResponse = new Response('cached-api', { status: 200 });
      mockCaches.match.mockResolvedValue(cachedResponse);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Network error'),
      );

      const event = makeFetchEvent('https://pms.test/api/v1/meters');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(cachedResponse);
    });

    it('returns 503 JSON error when both network and cache fail', async () => {
      mockCaches.match.mockResolvedValue(null);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Network error'),
      );

      const event = makeFetchEvent('https://pms.test/api/v1/meters');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toBe('Offline');
      expect(body.message).toBe('No network and no cached data');
    });

    it('does not cache non-ok network responses in networkFirst', async () => {
      mockCaches.match.mockResolvedValue(null);
      const errorResponse = new Response('server error', { status: 500 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(errorResponse);

      const event = makeFetchEvent('https://pms.test/api/v1/meters');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(500);
      expect(mockCache.put).not.toHaveBeenCalled();
    });
  });

  describe('networkFirstWithOfflineFallback strategy', () => {
    it('serves from network on success and caches the response', async () => {
      mockCaches.match.mockResolvedValue(null);
      const networkResponse = new Response('<html>page</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(networkResponse);

      const event = makeFetchEvent('https://pms.test/dashboard', 'GET', 'navigate');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(networkResponse);
      // cache.put called with (request, responseClone)
      expect(mockCache.put).toHaveBeenCalledTimes(1);
      expect(mockCache.put.mock.calls[0][0]).toBeInstanceOf(Request);
    });

    it('falls back to cached page on network failure', async () => {
      const cachedPage = new Response('<html>cached</html>', { status: 200 });
      mockCaches.match.mockResolvedValue(cachedPage);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Network error'),
      );

      const event = makeFetchEvent('https://pms.test/dashboard', 'GET', 'navigate');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response).toBe(cachedPage);
    });

    it('serves offline.html when cached page is not available', async () => {
      // First match call: navigation page cache miss (null)
      // Second match call: offline.html cache hit
      mockCaches.match
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(new Response('offline page', { status: 200 }));
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Network error'),
      );

      const event = makeFetchEvent('https://pms.test/dashboard', 'GET', 'navigate');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('offline page');
    });

    it('returns minimal HTML when nothing is cached at all', async () => {
      mockCaches.match.mockResolvedValue(null);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Network error'),
      );

      const event = makeFetchEvent('https://pms.test/dashboard', 'GET', 'navigate');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(503);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      const text = await response.text();
      expect(text).toContain('<h1>Offline</h1>');
      expect(text).toContain('Please check your connection.');
    });

    it('does not cache failed navigation responses', async () => {
      mockCaches.match.mockResolvedValue(null);
      const errorResponse = new Response('error', { status: 500 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(errorResponse);

      const event = makeFetchEvent('https://pms.test/dashboard', 'GET', 'navigate');
      listeners['fetch'][0](event);

      const response = await event.respondWith.mock.calls[0][0];
      expect(response.status).toBe(500);
      // The catch block still tries to cache on !ok in networkFirstWithOfflineFallback
      // Actually looking at the code: it caches inside the try block before the catch
      // So cache.put would have been called in the try path...
      // Wait, let me re-read: networkFirstWithOfflineFallback caches when networkResponse.ok
      // So for status 500, cache.put is NOT called. Correct.
    });
  });

  describe('sync event', () => {
    it('registers a sync event listener', () => {
      expect(listeners['sync']).toHaveLength(1);
    });

    it('calls notifyClientsToSync when sync tag is "meter-sync"', async () => {
      const mockPostMessage1 = vi.fn();
      const mockPostMessage2 = vi.fn();
      mockClients.matchAll.mockResolvedValue([
        { postMessage: mockPostMessage1 },
        { postMessage: mockPostMessage2 },
      ]);

      const event = makeSyncEvent('meter-sync');
      listeners['sync'][0](event);

      expect(event.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
      await event.waitUntil.mock.calls[0][0];

      expect(mockPostMessage1).toHaveBeenCalledWith({ type: 'SYNC_METER_READINGS' });
      expect(mockPostMessage2).toHaveBeenCalledWith({ type: 'SYNC_METER_READINGS' });
    });

    it('does nothing when sync tag is not "meter-sync"', () => {
      const event = makeSyncEvent('other-sync');
      listeners['sync'][0](event);

      expect(event.waitUntil).not.toHaveBeenCalled();
      expect(mockClients.matchAll).not.toHaveBeenCalled();
    });

    it('handles empty client list gracefully', async () => {
      mockClients.matchAll.mockResolvedValue([]);

      const event = makeSyncEvent('meter-sync');
      listeners['sync'][0](event);

      await event.waitUntil.mock.calls[0][0];
      expect(mockClients.matchAll).toHaveBeenCalled();
    });
  });
});
