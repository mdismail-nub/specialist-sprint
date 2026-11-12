const CACHE_VERSION = "v2";
const SHELL_CACHE = `cp-tracker-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `cp-tracker-assets-${CACHE_VERSION}`;
const FONT_CACHE = `cp-tracker-fonts-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/log",
  "/roadmap",
  "/problems",
  "/contests",
  "/analytics",
  "/settings",
  "/manifest.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/icons/icon-72x72.png",
  "/icons/icon-96x96.png",
  "/icons/icon-128x128.png",
  "/icons/icon-144x144.png",
  "/icons/icon-152x152.png",
  "/icons/icon-192x192.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-192x192.png",
  "/icons/maskable-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "no-cache" });
            if (response && response.ok) {
              await cache.put(url, response.clone());
            }
          } catch {
            // Ignore individual precache failures when offline
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const validCaches = new Set([SHELL_CACHE, ASSET_CACHE, FONT_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!validCaches.has(key)) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never intercept Vite dev-server module transform requests or HMR endpoints.
  // Caching /node_modules/.vite/deps/* across dev server restarts can mix ?v= hashes
  // and cause duplicate React instances in development mode.
  if (
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/__vite") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.startsWith("/src/")
  ) {
    return;
  }

  // 1. Google Fonts: Cache-First
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FONT_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === "opaque")) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Only handle same-origin requests from here on
  if (url.origin !== self.location.origin) return;

  // 2. Navigation requests (HTML pages / routes): Network-First with App Shell fallback
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            await cache.put(url.pathname, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const exactMatch =
            (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/"));
          if (exactMatch) return exactMatch;
          return new Response(
            "<!doctype html><html><head><meta charset='utf-8'><title>CP Tracker (Offline)</title></head><body><h1>CP Tracker is offline</h1><p>Please reconnect once to finish caching the application shell.</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // 3. Icons & Manifest: Cache-First
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(url.pathname, response.clone());
          }
          return response;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // 4. Production Static Assets (/assets/*, CSS, JS bundles): Network-First with Offline Cache Fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return Response.error();
      }
    })(),
  );
});
